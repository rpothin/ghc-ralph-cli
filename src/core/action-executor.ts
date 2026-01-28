/**
 * Action Executor
 *
 * Executes parsed actions from AI responses.
 * This component bridges the gap between AI intent and filesystem reality.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { debug, info, warn } from '../utils/index.js';
import type {
  Action,
  CreateAction,
  EditAction,
  DeleteAction,
  ExecuteAction,
  CompleteAction,
  StuckAction,
  ParseResult,
} from './response-parser.js';

const execAsync = promisify(exec);

/**
 * Result of executing a single action
 */
export interface ActionResult {
  /** The action that was executed */
  action: Action;
  /** Whether the action succeeded */
  success: boolean;
  /** Human-readable description of what happened */
  message: string;
  /** Output from command execution (for EXECUTE actions) */
  output?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of executing all actions from a response
 */
export interface ExecutionResult {
  /** Results for each action */
  results: ActionResult[];
  /** Whether all actions succeeded */
  allSucceeded: boolean;
  /** Whether a COMPLETE action was found */
  taskComplete: boolean;
  /** Completion reason if task is complete */
  completionReason?: string;
  /** Whether a STUCK action was found */
  taskStuck: boolean;
  /** Stuck details if task is stuck */
  stuckDetails?: {
    attempted: string;
    blocker: string;
    suggestion?: string;
  };
  /** Summary of executed actions */
  summary: string;
}

/**
 * Action executor configuration
 */
export interface ActionExecutorConfig {
  /** Working directory for file operations */
  cwd: string;
  /** Whether to actually execute actions (false = dry run) */
  execute: boolean;
  /** Timeout for shell commands in ms */
  commandTimeout: number;
  /** File safeguard manager for deletion protection */
  fileSafeguard?: {
    canDelete: (path: string) => boolean;
  };
}

const DEFAULT_CONFIG: ActionExecutorConfig = {
  cwd: process.cwd(),
  execute: true,
  commandTimeout: 30000, // 30 seconds
};

/**
 * Action Executor class
 */
export class ActionExecutor {
  private config: ActionExecutorConfig;
  private failedCommands: string[] = [];

  constructor(config: Partial<ActionExecutorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Reset the failed commands tracking (call at start of each iteration)
   */
  resetFailedCommands(): void {
    this.failedCommands = [];
  }

  /**
   * Get list of failed commands in current iteration
   */
  getFailedCommands(): string[] {
    return [...this.failedCommands];
  }

  /**
   * Check if there were command failures in this iteration
   */
  hasFailedCommands(): boolean {
    return this.failedCommands.length > 0;
  }

  /**
   * Execute all actions from a parsed response
   */
  async executeAll(parseResult: ParseResult): Promise<ExecutionResult> {
    const results: ActionResult[] = [];
    let taskComplete = false;
    let completionReason: string | undefined;
    let taskStuck = false;
    let stuckDetails: { attempted: string; blocker: string; suggestion?: string } | undefined;

    for (const action of parseResult.actions) {
      const result = await this.executeAction(action);
      results.push(result);

      // Track failed EXECUTE commands for honesty checking
      if (action.type === 'EXECUTE' && !result.success) {
        const executeAction = action as ExecuteAction;
        this.failedCommands.push(executeAction.command);
      }

      if (action.type === 'COMPLETE' && result.success) {
        taskComplete = true;
        completionReason = (action as CompleteAction).reason;
        
        // Warn if COMPLETE is used despite failed commands in this iteration
        if (this.failedCommands.length > 0) {
          warn(`⚠️ Task marked complete despite ${this.failedCommands.length} failed command(s):`);
          for (const cmd of this.failedCommands) {
            warn(`   • ${cmd}`);
          }
          warn('This may indicate false completion - verify the implementation!');
        }
      }

      if (action.type === 'STUCK' && result.success) {
        taskStuck = true;
        const stuckAction = action as StuckAction;
        stuckDetails = {
          attempted: stuckAction.attempted,
          blocker: stuckAction.blocker,
        };
        if (stuckAction.suggestion) {
          stuckDetails.suggestion = stuckAction.suggestion;
        }
      }

      // Stop on first failure (except for COMPLETE/STUCK which are informational)
      if (!result.success && action.type !== 'COMPLETE' && action.type !== 'STUCK') {
        warn(`Action failed: ${result.error}`);
        // Continue with remaining actions? For now, we'll continue
      }
    }

    const allSucceeded = results.every((r) => r.success);
    const summary = this.buildSummary(results);

    const executionResult: ExecutionResult = {
      results,
      allSucceeded,
      taskComplete,
      taskStuck,
      summary,
    };

    if (completionReason) {
      executionResult.completionReason = completionReason;
    }

    if (stuckDetails) {
      executionResult.stuckDetails = stuckDetails;
    }

    return executionResult;
  }

  /**
   * Execute a single action
   */
  async executeAction(action: Action): Promise<ActionResult> {
    debug(`Executing action: ${action.type}`);

    if (!this.config.execute) {
      return {
        action,
        success: true,
        message: `[DRY RUN] Would execute ${action.type}`,
      };
    }

    try {
      switch (action.type) {
        case 'CREATE':
          return await this.executeCreate(action);
        case 'EDIT':
          return await this.executeEdit(action);
        case 'DELETE':
          return await this.executeDelete(action);
        case 'EXECUTE':
          return await this.executeCommand(action);
        case 'COMPLETE':
          return this.executeComplete(action);
        case 'STUCK':
          return this.executeStuck(action);
        default:
          return {
            action,
            success: false,
            message: `Unknown action type`,
            error: `Unknown action type: ${(action as Action).type}`,
          };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        action,
        success: false,
        message: `Failed to execute ${action.type}`,
        error: errorMsg,
      };
    }
  }

  /**
   * Execute a CREATE action
   */
  private async executeCreate(action: CreateAction): Promise<ActionResult> {
    const fullPath = path.resolve(this.config.cwd, action.path);

    // Security: ensure path is within cwd
    if (!fullPath.startsWith(this.config.cwd)) {
      return {
        action,
        success: false,
        message: `Cannot create file outside working directory`,
        error: `Path escapes working directory: ${action.path}`,
      };
    }

    // Create parent directories if needed
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    await fs.writeFile(fullPath, action.content, 'utf-8');

    // Make executable if it's a script
    if (action.path.endsWith('.sh') || action.content.startsWith('#!/')) {
      await fs.chmod(fullPath, 0o755);
    }

    info(`Created: ${action.path}`);
    return {
      action,
      success: true,
      message: `Created ${action.path}`,
    };
  }

  /**
   * Execute an EDIT action
   */
  private async executeEdit(action: EditAction): Promise<ActionResult> {
    const fullPath = path.resolve(this.config.cwd, action.path);

    // Security: ensure path is within cwd
    if (!fullPath.startsWith(this.config.cwd)) {
      return {
        action,
        success: false,
        message: `Cannot edit file outside working directory`,
        error: `Path escapes working directory: ${action.path}`,
      };
    }

    // Read current content
    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch {
      return {
        action,
        success: false,
        message: `File not found: ${action.path}`,
        error: `Cannot edit non-existent file: ${action.path}`,
      };
    }

    // Find and replace the old content
    if (!content.includes(action.oldContent)) {
      return {
        action,
        success: false,
        message: `Old content not found in ${action.path}`,
        error: `The specified old content was not found in the file`,
      };
    }

    const newFileContent = content.replace(action.oldContent, action.newContent);
    await fs.writeFile(fullPath, newFileContent, 'utf-8');

    info(`Edited: ${action.path}`);
    return {
      action,
      success: true,
      message: `Edited ${action.path}`,
    };
  }

  /**
   * Execute a DELETE action
   */
  private async executeDelete(action: DeleteAction): Promise<ActionResult> {
    const fullPath = path.resolve(this.config.cwd, action.path);

    // Security: ensure path is within cwd
    if (!fullPath.startsWith(this.config.cwd)) {
      return {
        action,
        success: false,
        message: `Cannot delete file outside working directory`,
        error: `Path escapes working directory: ${action.path}`,
      };
    }

    // Check file safeguard
    if (this.config.fileSafeguard && !this.config.fileSafeguard.canDelete(action.path)) {
      return {
        action,
        success: false,
        message: `Cannot delete protected file: ${action.path}`,
        error: `File is protected by safeguard (existed before session)`,
      };
    }

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return {
        action,
        success: false,
        message: `File not found: ${action.path}`,
        error: `Cannot delete non-existent file`,
      };
    }

    await fs.unlink(fullPath);

    info(`Deleted: ${action.path}`);
    return {
      action,
      success: true,
      message: `Deleted ${action.path}`,
    };
  }

  /**
   * Execute an EXECUTE action (shell command)
   */
  private async executeCommand(action: ExecuteAction): Promise<ActionResult> {
    info(`Executing: ${action.command}`);

    try {
      const { stdout, stderr } = await execAsync(action.command, {
        cwd: this.config.cwd,
        timeout: this.config.commandTimeout,
        maxBuffer: 1024 * 1024, // 1MB
      });

      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');

      return {
        action,
        success: true,
        message: `Executed: ${action.command}`,
        output: output.trim(),
      };
    } catch (err) {
      const execError = err as { stdout?: string; stderr?: string; message?: string };
      const output = (execError.stdout ?? '') + (execError.stderr ? `\nSTDERR:\n${execError.stderr}` : '');

      return {
        action,
        success: false,
        message: `Command failed: ${action.command}`,
        output: output.trim(),
        error: execError.message ?? 'Command execution failed',
      };
    }
  }

  /**
   * Execute a COMPLETE action (just marks completion)
   */
  private executeComplete(action: CompleteAction): ActionResult {
    info(`Task complete: ${action.reason}`);
    return {
      action,
      success: true,
      message: `Task marked complete: ${action.reason}`,
    };
  }

  /**
   * Execute a STUCK action (signals inability to proceed)
   */
  private executeStuck(action: StuckAction): ActionResult {
    warn(`Agent stuck: ${action.blocker}`);
    info(`  Attempted: ${action.attempted}`);
    if (action.suggestion) {
      info(`  Suggestion: ${action.suggestion}`);
    }
    return {
      action,
      success: true, // STUCK is a valid action, not a failure
      message: `Agent stuck - blocker: ${action.blocker}`,
    };
  }

  /**
   * Build a human-readable summary of executed actions
   */
  private buildSummary(results: ActionResult[]): string {
    const parts: string[] = [];

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    for (const result of succeeded) {
      const icon = '✓';
      parts.push(`${icon} ${result.message}`);
    }

    for (const result of failed) {
      const icon = '✗';
      parts.push(`${icon} ${result.message}: ${result.error}`);
    }

    if (parts.length === 0) {
      return 'No actions executed';
    }

    return parts.join('\n');
  }
}

/**
 * Create an action executor with custom configuration
 */
export function createActionExecutor(
  config?: Partial<ActionExecutorConfig>
): ActionExecutor {
  return new ActionExecutor(config);
}

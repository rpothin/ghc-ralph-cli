/**
 * Run Command
 *
 * Execute an agentic coding loop
 */

import fs from 'node:fs/promises';
import type { Command } from 'commander';
import { info, success, error, warn, debug, spinner, heading, code, dim } from '../utils/index.js';
import { CopilotAgent } from '../integrations/index.js';
import { LoopEngine } from '../core/index.js';
import type { Task } from '../types/index.js';

export interface RunOptions {
  task?: string;
  file?: string;
  maxIterations: string;
  maxTokens?: string;
  model?: string;
  dryRun?: boolean;
}

/**
 * Format elapsed time as human-readable string
 */
function formatElapsedTime(startTime: Date): string {
  const elapsed = Date.now() - startTime.getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Read task content from a file
 */
async function readTaskFromFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.trim();
  } catch {
    throw new Error(`Failed to read task file: ${filePath}`);
  }
}

/**
 * Create a task object from options
 */
async function createTask(options: RunOptions): Promise<Task> {
  let content: string;
  let title: string;

  if (options.file) {
    content = await readTaskFromFile(options.file);
    title = options.file;
  } else if (options.task) {
    content = options.task;
    title = options.task.substring(0, 50) + (options.task.length > 50 ? '...' : '');
  } else {
    throw new Error('No task provided');
  }

  return {
    id: `task-${Date.now()}`,
    title,
    content,
    status: 'pending',
    source: options.file ? 'local' : 'local',
  };
}

/**
 * Handle graceful shutdown on Ctrl+C
 */
function setupSignalHandlers(engine: LoopEngine): void {
  let shutdownRequested = false;

  const handler = (): void => {
    if (shutdownRequested) {
      warn('Force quit - exiting immediately');
      process.exit(1);
    }

    shutdownRequested = true;
    warn('Shutdown requested - completing current iteration...');
    engine.stop();
  };

  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Execute an agentic coding loop')
    .option('-t, --task <description>', 'Task to execute (inline)')
    .option('-f, --file <path>', 'Read task from file')
    .option('-n, --max-iterations <number>', 'Maximum loop iterations', '10')
    .option('--max-tokens <number>', 'Maximum token budget', '100000')
    .option('-m, --model <model>', 'Copilot model to use', 'gpt-4')
    .option('--dry-run', 'Show what would happen without executing')
    .action(async (options: RunOptions) => {
      if (!options.task && !options.file) {
        error('Please provide a task with --task or --file');
        process.exit(1);
      }

      const maxIterations = parseInt(options.maxIterations, 10);
      const maxTokens = options.maxTokens ? parseInt(options.maxTokens, 10) : 100000;

      // Create task
      let task: Task;
      try {
        task = await createTask(options);
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      // Show configuration
      console.log('');
      console.log(heading('🤖 Ralph CLI - Run'));
      console.log('');
      console.log(`  ${dim('Task:')} ${task.title}`);
      console.log(`  ${dim('Model:')} ${code(options.model ?? 'gpt-4')}`);
      console.log(`  ${dim('Max iterations:')} ${maxIterations}`);
      console.log(`  ${dim('Max tokens:')} ${maxTokens.toLocaleString()}`);

      if (options.dryRun) {
        console.log('');
        warn('Dry run mode - no changes will be made');
        console.log('');
        console.log(dim('Task content:'));
        console.log(task.content);
        console.log('');
        success('Dry run complete - no actions taken');
        return;
      }

      console.log('');

      // Create agent and engine
      const agent = new CopilotAgent({
        model: options.model ?? 'gpt-4',
        maxTokensPerRequest: 4096,
      });

      const engine = new LoopEngine(agent, {
        maxIterations,
        maxTokens,
      });

      // Setup signal handlers for graceful shutdown
      setupSignalHandlers(engine);

      // Setup event listeners
      const events = engine.getEvents();
      const startTime = new Date();

      events.on('iterationStart', (iteration, state) => {
        debug(
          `Iteration ${iteration}/${maxIterations} - Tokens: ${state.tokensUsed.toLocaleString()}`
        );
      });

      events.on('iterationEnd', (record, _state) => {
        const status = record.success ? '✓' : '✗';
        info(
          `Iteration ${record.iteration}: ${status} (${record.tokensUsed.toLocaleString()} tokens)`
        );
        if (record.summary) {
          console.log(`  ${dim(record.summary)}`);
        }
      });

      events.on('error', (err) => {
        error(`Loop error: ${err.message}`);
      });

      // Run the loop
      const loopSpinner = spinner('Running agentic loop...');
      loopSpinner.start();

      try {
        const finalState = await engine.start(task);

        loopSpinner.stop();
        console.log('');

        // Print summary
        console.log(heading('📊 Summary'));
        console.log('');
        console.log(`  ${dim('Status:')} ${finalState.status}`);
        console.log(`  ${dim('Iterations:')} ${finalState.iteration}/${maxIterations}`);
        console.log(`  ${dim('Tokens used:')} ${finalState.tokensUsed.toLocaleString()}`);
        console.log(`  ${dim('Elapsed time:')} ${formatElapsedTime(startTime)}`);

        const successfulIterations = finalState.iterations.filter((i) => i.success).length;
        console.log(`  ${dim('Successful iterations:')} ${successfulIterations}`);

        console.log('');

        if (finalState.status === 'completed') {
          success('Loop completed successfully');
        } else if (finalState.status === 'stopped') {
          warn('Loop was stopped by user');
        } else if (finalState.status === 'failed') {
          error('Loop failed');
          process.exit(1);
        }
      } catch (err) {
        loopSpinner.fail('Loop failed');
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Progress Tracker
 *
 * Creates and maintains Markdown-based progress artifacts.
 * Uses in-memory accumulation to preserve full task history across a run.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getLocalStateDir } from '../utils/paths.js';
import { debug } from '../utils/output.js';
import type { FullLoopState, IterationRecord } from './loop-state.js';

/**
 * Progress file name
 */
const PROGRESS_FILE = 'progress.md';

/**
 * Session data for JSON output
 */
export interface SessionData {
  startedAt: string;
  taskId: string;
  taskTitle: string;
  status: string;
  iteration: number;
  maxIterations: number;
  tokensUsed: number;
  elapsedMs: number;
  iterations: Array<{
    number: number;
    startedAt: string;
    endedAt?: string;
    tokensUsed: number;
    success: boolean;
    summary?: string;
    error?: string;
  }>;
  lastCheckpoint?: string;
}

/**
 * Completed task result for history tracking
 */
export interface TaskResult {
  taskId: string;
  taskTitle: string;
  status: 'completed' | 'failed' | 'stuck';
  attempt: number;
  iterationCount: number;
  tokensUsed: number;
  startedAt: Date;
  completedAt: Date;
  summary?: string;
  error?: string;
  iterations: IterationRecord[];
}

/**
 * Run session tracking all tasks in a multi-task execution
 */
export interface RunSession {
  startTime: Date;
  branch?: string | undefined;
  totalTasks?: number | undefined;
  completedTasks: TaskResult[];
  currentTask?: {
    taskId: string;
    taskTitle: string;
    taskNumber: number;
    state: FullLoopState;
  } | undefined;
}

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Format elapsed time
 */
function formatElapsed(startDate: Date, endDate?: Date): string {
  const end = endDate ?? new Date();
  const ms = end.getTime() - startDate.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Progress Tracker class
 * 
 * Maintains in-memory accumulation of all task results across a run,
 * persisting full history to the progress file after each task.
 */
export class ProgressTracker {
  private projectRoot: string | undefined;
  private maxIterations: number;
  private session: RunSession | null = null;

  constructor(projectRoot?: string, maxIterations: number = 10) {
    this.projectRoot = projectRoot;
    this.maxIterations = maxIterations;
  }

  /**
   * Get the current session (for context like task numbers in commit messages)
   */
  getSession(): RunSession | null {
    return this.session;
  }

  /**
   * Get the count of completed tasks in the session
   */
  getCompletedTaskCount(): number {
    return this.session?.completedTasks.length ?? 0;
  }

  /**
   * Start a new run session for multi-task execution
   */
  startSession(branch?: string, totalTasks?: number): void {
    this.session = {
      startTime: new Date(),
      branch,
      totalTasks,
      completedTasks: [],
    };
    debug(`Started progress tracking session${branch ? ` on branch ${branch}` : ''}`);
  }

  /**
   * Set the current task being processed (for live progress display)
   */
  setCurrentTask(taskNumber: number, state: FullLoopState): void {
    if (!this.session) {
      this.startSession();
    }
    
    this.session!.currentTask = {
      taskId: state.task.id,
      taskTitle: state.task.title,
      taskNumber,
      state,
    };
  }

  /**
   * Record a completed task result and persist to file
   */
  async recordTaskCompletion(
    state: FullLoopState,
    status: 'completed' | 'failed' | 'stuck',
    attempt: number,
    summary?: string,
    error?: string
  ): Promise<void> {
    if (!this.session) {
      this.startSession();
    }

    const result: TaskResult = {
      taskId: state.task.id,
      taskTitle: state.task.title,
      status,
      attempt,
      iterationCount: state.iteration,
      tokensUsed: state.tokensUsed,
      startedAt: state.startedAt,
      completedAt: new Date(),
      iterations: [...state.iterations],
    };

    if (summary) result.summary = summary;
    if (error) result.error = error;

    this.session!.completedTasks.push(result);
    this.session!.currentTask = undefined;

    // Persist full history to file
    await this.saveFullSession();
  }

  /**
   * Save the full session history to progress file
   */
  private async saveFullSession(): Promise<void> {
    if (!this.session) return;

    const filePath = this.getProgressFilePath();
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    const content = this.generateFullSessionMarkdown();
    await fs.writeFile(filePath, content, 'utf-8');

    debug(`Progress saved with ${this.session.completedTasks.length} task(s) to ${filePath}`);
  }

  /**
   * Generate full session markdown with all task history
   */
  private generateFullSessionMarkdown(): string {
    if (!this.session) return '';

    let md = `# Ralph Progress Log\n\n`;
    md += `## Run Session\n\n`;
    md += `- **Started**: ${formatDate(this.session.startTime)}\n`;
    
    if (this.session.branch) {
      md += `- **Branch**: ${this.session.branch}\n`;
    }
    
    if (this.session.totalTasks) {
      md += `- **Total Tasks**: ${this.session.totalTasks}\n`;
    }
    
    md += `- **Completed**: ${this.session.completedTasks.length}\n`;
    md += `- **Elapsed**: ${formatElapsed(this.session.startTime)}\n`;
    md += `\n---\n\n`;

    // Output all completed tasks with full iteration history
    for (let i = 0; i < this.session.completedTasks.length; i++) {
      const task = this.session.completedTasks[i];
      if (!task) continue;
      
      const taskNum = i + 1;
      const statusEmoji = task.status === 'completed' ? '✅' : task.status === 'stuck' ? '🔄' : '❌';
      
      md += `## Task ${taskNum}: ${task.taskTitle}\n\n`;
      md += `- **ID**: ${task.taskId}\n`;
      md += `- **Status**: ${statusEmoji} ${task.status}\n`;
      md += `- **Attempt**: ${task.attempt}\n`;
      md += `- **Iterations**: ${task.iterationCount}\n`;
      md += `- **Tokens Used**: ${task.tokensUsed.toLocaleString()}\n`;
      md += `- **Started**: ${formatDate(task.startedAt)}\n`;
      md += `- **Completed**: ${formatDate(task.completedAt)}\n`;
      md += `- **Duration**: ${formatElapsed(task.startedAt, task.completedAt)}\n`;
      
      if (task.summary) {
        md += `- **Summary**: ${task.summary}\n`;
      }
      
      if (task.error) {
        md += `- **Error**: ${task.error}\n`;
      }
      
      // Include iteration log for this task
      if (task.iterations.length > 0) {
        md += `\n### Iteration Log\n\n`;
        for (const iter of task.iterations) {
          md += this.formatIteration(iter);
        }
      }
      
      md += `\n---\n\n`;
    }

    // Include current task if in progress
    if (this.session.currentTask) {
      const { taskNumber, state } = this.session.currentTask;
      md += `## Task ${taskNumber}: ${state.task.title} (In Progress)\n\n`;
      md += `- **ID**: ${state.task.id}\n`;
      md += `- **Status**: 🔄 ${this.formatStatus(state.status)}\n`;
      md += `- **Iterations**: ${state.iteration}/${this.maxIterations}\n`;
      md += `- **Tokens Used**: ${state.tokensUsed.toLocaleString()}\n`;
      md += `- **Started**: ${formatDate(state.startedAt)}\n`;
      
      if (state.lastCheckpoint) {
        md += `- **Last Checkpoint**: \`${state.lastCheckpoint}\`\n`;
      }
      
      if (state.iterations.length > 0) {
        md += `\n### Iteration Log\n\n`;
        for (const iter of state.iterations) {
          md += this.formatIteration(iter);
        }
      }
    }

    return md;
  }

  /**
   * Get the progress file path
   */
  getProgressFilePath(): string {
    return path.join(getLocalStateDir(this.projectRoot), PROGRESS_FILE);
  }

  /**
   * Generate Markdown content for the progress file
   */
  generateMarkdown(state: FullLoopState): string {
    const { task, iteration, tokensUsed, startedAt, status, iterations, lastCheckpoint } = state;

    let md = `# Ralph Progress Log\n\n`;
    md += `## Current Session\n\n`;
    md += `- **Started**: ${formatDate(startedAt)}\n`;
    md += `- **Task**: ${task.title}\n`;
    md += `- **Status**: ${this.formatStatus(status)}\n`;
    md += `- **Iterations**: ${iteration}/${this.maxIterations}\n`;
    md += `- **Tokens Used**: ${tokensUsed.toLocaleString()}\n`;
    md += `- **Elapsed**: ${formatElapsed(startedAt)}\n`;

    if (lastCheckpoint) {
      md += `- **Last Checkpoint**: \`${lastCheckpoint}\`\n`;
    }

    md += `\n### Task Details\n\n`;
    md += `\`\`\`\n${task.content}\n\`\`\`\n`;

    if (iterations.length > 0) {
      md += `\n### Iteration Log\n\n`;

      for (const iter of iterations) {
        md += this.formatIteration(iter);
      }
    }

    return md;
  }

  /**
   * Format status for display
   */
  private formatStatus(status: string): string {
    switch (status) {
      case 'running':
        return '🔄 In Progress';
      case 'completed':
        return '✅ Completed';
      case 'failed':
        return '❌ Failed';
      case 'stopped':
        return '⏹️ Stopped';
      case 'paused':
        return '⏸️ Paused';
      default:
        return status;
    }
  }

  /**
   * Format an iteration for the log
   */
  private formatIteration(iter: IterationRecord): string {
    const time = iter.startedAt.toLocaleTimeString();
    const status = iter.success ? '✓' : '✗';

    let md = `#### Iteration ${iter.iteration} (${time}) ${status}\n\n`;
    md += `- **Tokens**: ${iter.tokensUsed.toLocaleString()}\n`;

    if (iter.summary) {
      md += `- **Summary**: ${iter.summary}\n`;
    }

    if (iter.error) {
      md += `- **Error**: ${iter.error}\n`;
    }

    if (iter.endedAt) {
      const duration = iter.endedAt.getTime() - iter.startedAt.getTime();
      md += `- **Duration**: ${Math.floor(duration / 1000)}s\n`;
    }

    md += `\n`;
    return md;
  }

  /**
   * Save progress to file
   */
  async save(state: FullLoopState): Promise<void> {
    const filePath = this.getProgressFilePath();
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    const content = this.generateMarkdown(state);
    await fs.writeFile(filePath, content, 'utf-8');

    debug(`Progress saved to ${filePath}`);
  }

  /**
   * Load session data from progress file (if exists)
   */
  async load(): Promise<SessionData | null> {
    const filePath = this.getProgressFilePath();

    try {
      await fs.access(filePath);
      // For now, return null - parsing would require more complex logic
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get session data as JSON
   */
  toJSON(state: FullLoopState): SessionData {
    const result: SessionData = {
      startedAt: formatDate(state.startedAt),
      taskId: state.task.id,
      taskTitle: state.task.title,
      status: state.status,
      iteration: state.iteration,
      maxIterations: this.maxIterations,
      tokensUsed: state.tokensUsed,
      elapsedMs: Date.now() - state.startedAt.getTime(),
      iterations: state.iterations.map((iter) => {
        const iterResult: {
          number: number;
          startedAt: string;
          endedAt?: string;
          tokensUsed: number;
          success: boolean;
          summary?: string;
          error?: string;
        } = {
          number: iter.iteration,
          startedAt: formatDate(iter.startedAt),
          tokensUsed: iter.tokensUsed,
          success: iter.success,
        };
        if (iter.endedAt) iterResult.endedAt = formatDate(iter.endedAt);
        if (iter.summary) iterResult.summary = iter.summary;
        if (iter.error) iterResult.error = iter.error;
        return iterResult;
      }),
    };

    if (state.lastCheckpoint) {
      result.lastCheckpoint = state.lastCheckpoint;
    }

    return result;
  }

  /**
   * Check if a session exists
   */
  async hasSession(): Promise<boolean> {
    try {
      await fs.access(this.getProgressFilePath());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear progress file
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.getProgressFilePath());
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Load previous task results from progress file for context injection.
   * Returns a formatted summary of previous task attempts.
   */
  async loadPreviousTaskResults(): Promise<string> {
    const filePath = this.getProgressFilePath();

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract iteration log section if it exists
      const iterationLogMatch = content.match(/### Iteration Log\n\n([\s\S]*?)(?=\n## |$)/);
      const taskResultsMatch = content.match(/### Task Results\n\n([\s\S]*?)(?=\n## |$)/);
      
      const parts: string[] = [];
      
      if (iterationLogMatch?.[1]) {
        parts.push('## Previous Iteration Progress\n' + iterationLogMatch[1].trim());
      }
      
      if (taskResultsMatch?.[1]) {
        parts.push('## Previous Task Results\n' + taskResultsMatch[1].trim());
      }
      
      return parts.join('\n\n');
    } catch {
      return '';
    }
  }

  /**
   * Append a task result to the progress file.
   * Used to track multi-task execution progress.
   */
  async appendTaskResult(
    task: { id: string; title: string },
    status: 'completed' | 'failed' | 'stuck',
    attempt: number,
    summary?: string,
    error?: string
  ): Promise<void> {
    const filePath = this.getProgressFilePath();
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    const timestamp = new Date().toISOString();
    const statusEmoji = status === 'completed' ? '✅' : status === 'stuck' ? '🔄' : '❌';
    
    let entry = `\n#### ${statusEmoji} Task: ${task.title}\n\n`;
    entry += `- **ID**: ${task.id}\n`;
    entry += `- **Status**: ${status}\n`;
    entry += `- **Attempt**: ${attempt}\n`;
    entry += `- **Timestamp**: ${timestamp}\n`;
    
    if (summary) {
      entry += `- **Summary**: ${summary}\n`;
    }
    
    if (error) {
      entry += `- **Error**: ${error}\n`;
    }
    
    entry += '\n';

    try {
      // Check if file exists
      let content = '';
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch {
        // File doesn't exist, create with header
        content = '# Ralph Progress Log\n\n## Task Results\n';
      }

      // If Task Results section doesn't exist, add it
      if (!content.includes('## Task Results')) {
        content += '\n## Task Results\n';
      }

      // Append the entry at the end
      content += entry;

      await fs.writeFile(filePath, content, 'utf-8');
      debug(`Appended task result for ${task.id} to ${filePath}`);
    } catch (err) {
      debug(`Failed to append task result: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * Checkpoint Manager
 *
 * Manages automatic git commits after each loop iteration
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { debug, warn } from '../utils/index.js';

const execAsync = promisify(exec);

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  /** Whether to auto-commit after each iteration (default: true) */
  autoCommit: boolean;
  /** Prefix for commit messages (default: 'ghcralph:') */
  messagePrefix: string;
  /** Working directory */
  cwd: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CheckpointConfig = {
  autoCommit: true,
  messagePrefix: 'ghcralph:',
  cwd: process.cwd(),
};

/**
 * Checkpoint record
 */
export interface Checkpoint {
  /** Iteration number */
  iteration: number;
  /** Commit hash */
  commitHash: string;
  /** Commit message */
  message: string;
  /** Files modified in this commit */
  filesModified: string[];
  /** Timestamp of the commit */
  timestamp: Date;
  /** Token usage for the iteration */
  tokensUsed: number;
}

/**
 * Checkpoint Manager class
 */
export class CheckpointManager {
  private config: CheckpointConfig;
  private checkpoints: Checkpoint[] = [];

  constructor(config: Partial<CheckpointConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if auto-commit is enabled
   */
  isAutoCommitEnabled(): boolean {
    return this.config.autoCommit;
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Get the last checkpoint
   */
  getLastCheckpoint(): Checkpoint | null {
    if (this.checkpoints.length === 0) {
      return null;
    }
    const last = this.checkpoints[this.checkpoints.length - 1];
    return last ?? null;
  }

  /**
   * Check if there are any modified files to commit
   */
  async hasChangesToCommit(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.config.cwd });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get list of modified files
   */
  async getModifiedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.config.cwd });
      return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => line.substring(3).trim());
    } catch {
      return [];
    }
  }

  /**
   * Stage all modified files
   */
  async stageAllChanges(): Promise<boolean> {
    try {
      await execAsync('git add -A', { cwd: this.config.cwd });
      debug('Staged all changes');
      return true;
    } catch (err) {
      warn('Failed to stage changes: ' + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }

  /**
   * Create a checkpoint commit
   */
  async createCheckpoint(
    iteration: number,
    summary: string,
    tokensUsed: number
  ): Promise<Checkpoint | null> {
    if (!this.config.autoCommit) {
      debug('Auto-commit disabled, skipping checkpoint');
      return null;
    }

    // Check if there are changes to commit
    const hasChanges = await this.hasChangesToCommit();
    if (!hasChanges) {
      debug('No changes to commit for checkpoint');
      return null;
    }

    // Get list of modified files before staging
    const filesModified = await this.getModifiedFiles();

    // Stage all changes
    const staged = await this.stageAllChanges();
    if (!staged) {
      return null;
    }

    // Build commit message
    const truncatedSummary = summary.length > 50 
      ? summary.substring(0, 47) + '...'
      : summary;
    
    const message = `${this.config.messagePrefix} iteration ${iteration} - ${truncatedSummary}`;
    const fullMessage = `${message}\n\nTokens used: ${tokensUsed}\nFiles modified: ${filesModified.length}`;

    try {
      // Create commit
      await execAsync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, { cwd: this.config.cwd });
      
      // Get commit hash
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.config.cwd });
      const commitHash = stdout.trim();

      const checkpoint: Checkpoint = {
        iteration,
        commitHash,
        message,
        filesModified,
        timestamp: new Date(),
        tokensUsed,
      };

      this.checkpoints.push(checkpoint);
      debug(`Created checkpoint: ${commitHash.substring(0, 7)} - ${message}`);
      
      return checkpoint;
    } catch (err) {
      warn('Failed to create checkpoint commit: ' + (err instanceof Error ? err.message : String(err)));
      return null;
    }
  }

  /**
   * Rollback to a specific checkpoint
   */
  async rollbackTo(commitHash: string): Promise<boolean> {
    try {
      // Soft reset to keep changes in working directory for review
      await execAsync(`git reset --soft "${commitHash}"`, { cwd: this.config.cwd });
      debug(`Rolled back to ${commitHash.substring(0, 7)}`);
      return true;
    } catch (err) {
      warn('Failed to rollback: ' + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }

  /**
   * Hard rollback to a specific checkpoint (discard changes)
   */
  async hardRollbackTo(commitHash: string): Promise<boolean> {
    try {
      await execAsync(`git reset --hard "${commitHash}"`, { cwd: this.config.cwd });
      debug(`Hard rolled back to ${commitHash.substring(0, 7)}`);
      return true;
    } catch (err) {
      warn('Failed to hard rollback: ' + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }

  /**
   * Rollback by N iterations
   */
  async rollbackIterations(count: number = 1): Promise<boolean> {
    if (this.checkpoints.length < count) {
      warn(`Cannot rollback ${count} iterations, only ${this.checkpoints.length} checkpoints available`);
      return false;
    }

    // Get the checkpoint to rollback to
    const targetIndex = this.checkpoints.length - count - 1;
    
    if (targetIndex < 0) {
      // Rollback before first checkpoint - get parent of first checkpoint
      const firstCheckpoint = this.checkpoints[0];
      if (!firstCheckpoint) return false;
      
      try {
        const { stdout } = await execAsync(`git rev-parse "${firstCheckpoint.commitHash}^"`, { cwd: this.config.cwd });
        const parentHash = stdout.trim();
        return this.hardRollbackTo(parentHash);
      } catch {
        warn('Cannot find parent commit for rollback');
        return false;
      }
    }

    const targetCheckpoint = this.checkpoints[targetIndex];
    if (!targetCheckpoint) return false;
    
    return this.hardRollbackTo(targetCheckpoint.commitHash);
  }

  /**
   * Get the initial commit hash before Ralph started
   */
  async getInitialCommit(): Promise<string | null> {
    if (this.checkpoints.length === 0) {
      return null;
    }

    const firstCheckpoint = this.checkpoints[0];
    if (!firstCheckpoint) return null;

    try {
      const { stdout } = await execAsync(`git rev-parse "${firstCheckpoint.commitHash}^"`, { cwd: this.config.cwd });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Rollback all Ralph changes (to state before Ralph started)
   */
  async rollbackAll(): Promise<boolean> {
    const initialCommit = await this.getInitialCommit();
    if (!initialCommit) {
      warn('No checkpoints to rollback');
      return false;
    }
    
    return this.hardRollbackTo(initialCommit);
  }

  /**
   * Create a task completion checkpoint commit
   */
  async createTaskCheckpoint(
    taskTitle: string,
    taskId: string,
    summary: string
  ): Promise<Checkpoint | null> {
    if (!this.config.autoCommit) {
      debug('Auto-commit disabled, skipping task checkpoint');
      return null;
    }

    // Check if there are changes to commit
    const hasChanges = await this.hasChangesToCommit();
    if (!hasChanges) {
      debug('No changes to commit for task checkpoint');
      return null;
    }

    // Get list of modified files before staging
    const filesModified = await this.getModifiedFiles();

    // Stage all changes
    const staged = await this.stageAllChanges();
    if (!staged) {
      return null;
    }

    // Build commit message for task completion
    const truncatedTitle = taskTitle.length > 40 
      ? taskTitle.substring(0, 37) + '...'
      : taskTitle;
    
    const message = `${this.config.messagePrefix} task complete - ${truncatedTitle}`;
    const fullMessage = `${message}\n\nTask ID: ${taskId}\nSummary: ${summary}\nFiles modified: ${filesModified.length}`;

    try {
      // Create commit
      await execAsync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, { cwd: this.config.cwd });
      
      // Get commit hash
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.config.cwd });
      const commitHash = stdout.trim();

      const checkpoint: Checkpoint = {
        iteration: 0, // Task-level checkpoint, not iteration-level
        commitHash,
        message,
        filesModified,
        timestamp: new Date(),
        tokensUsed: 0,
      };

      this.checkpoints.push(checkpoint);
      debug(`Created task checkpoint: ${commitHash.substring(0, 7)} - ${message}`);
      
      return checkpoint;
    } catch (err) {
      warn('Failed to create task checkpoint commit: ' + (err instanceof Error ? err.message : String(err)));
      return null;
    }
  }

  /**
   * Create a failure checkpoint commit (preserves state for post-mortem)
   */
  async createFailureCheckpoint(
    taskTitle: string,
    taskId: string,
    attempt: number,
    error?: string
  ): Promise<Checkpoint | null> {
    if (!this.config.autoCommit) {
      debug('Auto-commit disabled, skipping failure checkpoint');
      return null;
    }

    // Check if there are changes to commit
    const hasChanges = await this.hasChangesToCommit();
    if (!hasChanges) {
      debug('No changes to commit for failure checkpoint');
      return null;
    }

    // Get list of modified files before staging
    const filesModified = await this.getModifiedFiles();

    // Stage all changes
    const staged = await this.stageAllChanges();
    if (!staged) {
      return null;
    }

    // Build commit message for task failure
    const truncatedTitle = taskTitle.length > 30 
      ? taskTitle.substring(0, 27) + '...'
      : taskTitle;
    
    const message = `${this.config.messagePrefix} task failed (attempt ${attempt}) - ${truncatedTitle}`;
    const errorInfo = error ? `\nError: ${error.substring(0, 200)}` : '';
    const fullMessage = `${message}\n\nTask ID: ${taskId}\nAttempt: ${attempt}${errorInfo}\nFiles modified: ${filesModified.length}`;

    try {
      // Create commit
      await execAsync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, { cwd: this.config.cwd });
      
      // Get commit hash
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.config.cwd });
      const commitHash = stdout.trim();

      const checkpoint: Checkpoint = {
        iteration: 0, // Task-level checkpoint
        commitHash,
        message,
        filesModified,
        timestamp: new Date(),
        tokensUsed: 0,
      };

      this.checkpoints.push(checkpoint);
      debug(`Created failure checkpoint: ${commitHash.substring(0, 7)} - ${message}`);
      
      return checkpoint;
    } catch (err) {
      warn('Failed to create failure checkpoint commit: ' + (err instanceof Error ? err.message : String(err)));
      return null;
    }
  }
}

/**
 * Create a checkpoint manager with configuration
 */
export function createCheckpointManager(config?: Partial<CheckpointConfig>): CheckpointManager {
  return new CheckpointManager(config);
}

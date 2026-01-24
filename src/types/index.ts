/**
 * Type Definitions
 *
 * Shared TypeScript type definitions for Ralph CLI
 */

/**
 * Configuration for a Ralph session
 */
export interface RalphConfig {
  /** Source for the plan: GitHub Issues or local Markdown */
  planSource: 'github' | 'local';
  /** Maximum number of loop iterations */
  maxIterations: number;
  /** Maximum token budget for the session */
  maxTokens: number;
  /** Default Copilot model to use */
  defaultModel: string;
  /** Whether to auto-commit after each iteration */
  autoCommit: boolean;
  /** Prefix for Ralph branches */
  branchPrefix: string;
}

/**
 * Represents a task to be executed
 */
export interface Task {
  /** Unique identifier for the task */
  id: string;
  /** Task title/description */
  title: string;
  /** Detailed task content */
  content: string;
  /** Task status */
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  /** Source of the task */
  source: 'github' | 'local';
}

/**
 * Loop execution state
 */
export interface LoopState {
  /** Current iteration number */
  iteration: number;
  /** Total tokens consumed */
  tokensUsed: number;
  /** Loop start time */
  startedAt: Date;
  /** Current status */
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  /** Last checkpoint commit hash */
  lastCheckpoint?: string;
}

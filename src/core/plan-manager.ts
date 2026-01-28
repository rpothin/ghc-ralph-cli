/**
 * Plan Manager Interface
 *
 * Common interface for different plan sources (local Markdown, GitHub Issues)
 */

import type { Task } from '../types/index.js';

/**
 * Plan source type
 */
export type PlanSourceType = 'local' | 'github';

/**
 * Task filter options
 */
export interface TaskFilter {
  /** Filter by status */
  status?: 'pending' | 'in-progress' | 'completed' | 'all';
  /** Filter by label/tag */
  label?: string;
  /** Maximum number of tasks to return */
  limit?: number;
}

/**
 * Plan manager interface
 */
export interface PlanManager {
  /** The type of plan source */
  readonly sourceType: PlanSourceType;

  /**
   * Initialize the plan manager
   */
  initialize(): Promise<void>;

  /**
   * Get all tasks from the plan
   */
  getTasks(filter?: TaskFilter): Promise<Task[]>;

  /**
   * Get the next pending task
   */
  getNextTask(): Promise<Task | null>;

  /**
   * Get a specific task by ID
   */
  getTask(id: string): Promise<Task | null>;

  /**
   * Mark a task as in-progress
   */
  startTask(id: string): Promise<void>;

  /**
   * Mark a task as completed
   */
  completeTask(id: string): Promise<void>;

  /**
   * Mark a task as failed
   */
  failTask(id: string, error?: string): Promise<void>;

  /**
   * Update task progress
   */
  updateProgress(id: string, progress: string): Promise<void>;

  /**
   * Reload the plan from source (optional, for refreshing state)
   */
  reload?(): Promise<void>;
}

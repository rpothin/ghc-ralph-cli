/**
 * Loop State
 *
 * Types and utilities for managing loop execution state
 */

import type { Task, LoopState } from '../types/index.js';

/**
 * Iteration record for tracking loop progress
 */
export interface IterationRecord {
  /** Iteration number (1-based) */
  iteration: number;
  /** When this iteration started */
  startedAt: Date;
  /** When this iteration ended */
  endedAt?: Date;
  /** Tokens used in this iteration */
  tokensUsed: number;
  /** Whether the iteration succeeded */
  success: boolean;
  /** Summary of what happened */
  summary?: string;
  /** Error if the iteration failed */
  error?: string;
  /** Raw AI response (for full verbosity logging) */
  rawResponse?: string;
  /** Actions executed in this iteration (for full verbosity logging) */
  actions?: Array<{
    type: string;
    success: boolean;
    summary?: string;
  }>;
}

/**
 * Full loop execution state including history
 */
export interface FullLoopState extends LoopState {
  /** The task being executed */
  task: Task;
  /** History of all iterations */
  iterations: IterationRecord[];
  /** When the loop ended (if completed) */
  endedAt?: Date;
  /** Final result message */
  result?: string;
}

/**
 * Create initial loop state for a task
 */
export function createInitialState(task: Task): FullLoopState {
  return {
    task,
    iteration: 0,
    tokensUsed: 0,
    startedAt: new Date(),
    status: 'running',
    iterations: [],
  };
}

/**
 * Create an iteration record
 */
export function createIterationRecord(iteration: number): IterationRecord {
  return {
    iteration,
    startedAt: new Date(),
    tokensUsed: 0,
    success: false,
  };
}

/**
 * Mark an iteration as complete
 */
export function completeIteration(
  record: IterationRecord,
  success: boolean,
  tokensUsed: number,
  summary?: string,
  error?: string
): IterationRecord {
  const result: IterationRecord = {
    ...record,
    endedAt: new Date(),
    success,
    tokensUsed,
  };

  if (summary !== undefined) {
    result.summary = summary;
  }

  if (error !== undefined) {
    result.error = error;
  }

  return result;
}

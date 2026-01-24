/**
 * Loop Events
 *
 * Event emitter for loop lifecycle events
 */

import { EventEmitter } from 'node:events';
import type { Task } from '../types/index.js';
import type { FullLoopState, IterationRecord } from './loop-state.js';
import type { TokenUsage } from '../integrations/index.js';

/**
 * Warning type for threshold warnings
 */
export type WarningType = 'iteration-threshold' | 'token-threshold' | 'duration-threshold' | 'circuit-breaker';

/**
 * Loop lifecycle events
 */
export interface LoopEvents {
  /** Emitted when the loop starts */
  start: [task: Task];
  /** Emitted at the beginning of each iteration */
  iterationStart: [iteration: number, state: FullLoopState];
  /** Emitted at the end of each iteration */
  iterationEnd: [record: IterationRecord, state: FullLoopState];
  /** Emitted when the loop pauses */
  pause: [state: FullLoopState];
  /** Emitted when the loop resumes */
  resume: [state: FullLoopState];
  /** Emitted when the loop completes successfully */
  complete: [state: FullLoopState];
  /** Emitted when the loop fails */
  error: [error: Error, state: FullLoopState];
  /** Emitted when the loop is stopped */
  stop: [state: FullLoopState];
  /** Emitted when tokens are consumed */
  tokenUsage: [usage: TokenUsage, totalUsage: TokenUsage];
  /** Emitted when a warning threshold is reached */
  warning: [type: WarningType, message: string, state: FullLoopState];
}

/**
 * Type-safe event emitter for loop events
 */
export class LoopEventEmitter extends EventEmitter {
  override emit<K extends keyof LoopEvents>(event: K, ...args: LoopEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof LoopEvents>(
    event: K,
    listener: (...args: LoopEvents[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override once<K extends keyof LoopEvents>(
    event: K,
    listener: (...args: LoopEvents[K]) => void
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  override off<K extends keyof LoopEvents>(
    event: K,
    listener: (...args: LoopEvents[K]) => void
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }
}

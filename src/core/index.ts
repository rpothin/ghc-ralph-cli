/**
 * Core Loop Engine
 *
 * This module contains the core loop engine that:
 * - Manages the autonomous coding loop
 * - Tracks iterations and progress
 * - Handles checkpoints and state
 */

export { LoopEngine } from './loop-engine.js';
export type { LoopEngineConfig, LoopCompletionReason } from './loop-engine.js';

export { LoopEventEmitter } from './loop-events.js';
export type { LoopEvents } from './loop-events.js';

export { createInitialState, createIterationRecord, completeIteration } from './loop-state.js';
export type { IterationRecord, FullLoopState } from './loop-state.js';

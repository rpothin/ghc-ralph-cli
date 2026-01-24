/**
 * Loop Engine
 *
 * The core engine that runs the autonomous coding loop
 */

import type { Task } from '../types/index.js';
import type { CopilotAgent } from '../integrations/index.js';
import { type TokenUsage } from '../integrations/index.js';
import { debug, info, error as logError, warn } from '../utils/index.js';
import { LoopEventEmitter } from './loop-events.js';
import {
  createInitialState,
  createIterationRecord,
  completeIteration,
  type FullLoopState,
} from './loop-state.js';

/**
 * Loop engine configuration
 */
export interface LoopEngineConfig {
  /** Maximum number of iterations */
  maxIterations: number;
  /** Maximum token budget */
  maxTokens: number;
  /** Delay between iterations in ms */
  iterationDelayMs: number;
}

/**
 * Default engine configuration
 */
const DEFAULT_CONFIG: LoopEngineConfig = {
  maxIterations: 10,
  maxTokens: 100000,
  iterationDelayMs: 500,
};

/**
 * Loop completion reason
 */
export type LoopCompletionReason =
  | 'task-complete'
  | 'max-iterations'
  | 'max-tokens'
  | 'stopped'
  | 'paused'
  | 'error';

/**
 * LoopEngine class - the heart of Ralph CLI
 */
export class LoopEngine {
  private config: LoopEngineConfig;
  private agent: CopilotAgent;
  private events: LoopEventEmitter;
  private state: FullLoopState | null = null;
  private pauseRequested: boolean = false;
  private stopRequested: boolean = false;

  constructor(agent: CopilotAgent, config: Partial<LoopEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agent = agent;
    this.events = new LoopEventEmitter();
  }

  /**
   * Get the event emitter for subscribing to loop events
   */
  getEvents(): LoopEventEmitter {
    return this.events;
  }

  /**
   * Get the current loop state
   */
  getState(): FullLoopState | null {
    return this.state;
  }

  /**
   * Start the loop for a task
   */
  async start(task: Task): Promise<FullLoopState> {
    if (this.state?.status === 'running') {
      throw new Error('Loop is already running');
    }

    // Initialize state
    this.state = createInitialState(task);
    this.state.task.status = 'in-progress';
    this.pauseRequested = false;
    this.stopRequested = false;

    debug(`Starting loop for task: ${task.title}`);
    this.events.emit('start', task);

    try {
      // Ensure agent is initialized
      if (!this.agent.isInitialized()) {
        const initialized = await this.agent.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Copilot agent');
        }
      }

      // Run the loop
      await this.runLoop();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.state.status = 'failed';
      this.state.endedAt = new Date();
      this.events.emit('error', error, this.state);
      logError(`Loop failed: ${error.message}`);
    }

    return this.state;
  }

  /**
   * Pause the current loop
   */
  pause(): void {
    if (this.state?.status !== 'running') {
      warn('No running loop to pause');
      return;
    }

    info('Pause requested...');
    this.pauseRequested = true;
  }

  /**
   * Resume a paused loop
   */
  async resume(): Promise<FullLoopState | null> {
    if (this.state?.status !== 'paused') {
      warn('No paused loop to resume');
      return null;
    }

    info('Resuming loop...');
    this.pauseRequested = false;
    this.state.status = 'running';
    this.events.emit('resume', this.state);

    try {
      await this.runLoop();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.state.status = 'failed';
      this.state.endedAt = new Date();
      this.events.emit('error', error, this.state);
    }

    return this.state;
  }

  /**
   * Stop the current loop
   */
  stop(): void {
    if (!this.state || this.state.status === 'completed' || this.state.status === 'stopped') {
      warn('No active loop to stop');
      return;
    }

    info('Stop requested...');
    this.stopRequested = true;
  }

  /**
   * The main loop execution
   */
  private async runLoop(): Promise<void> {
    if (!this.state) return;

    while (this.shouldContinue()) {
      // Check for pause request
      if (this.pauseRequested) {
        this.state.status = 'paused';
        this.events.emit('pause', this.state);
        debug('Loop paused');
        return;
      }

      // Check for stop request
      if (this.stopRequested) {
        this.state.status = 'stopped';
        this.state.endedAt = new Date();
        this.events.emit('stop', this.state);
        debug('Loop stopped');
        return;
      }

      // Run iteration
      await this.runIteration();

      // Brief delay between iterations
      if (this.shouldContinue()) {
        await this.sleep(this.config.iterationDelayMs);
      }
    }

    // Loop completed
    this.state.status = 'completed';
    this.state.endedAt = new Date();
    this.state.task.status = 'completed';
    this.events.emit('complete', this.state);
  }

  /**
   * Check if the loop should continue
   */
  private shouldContinue(): boolean {
    if (!this.state) return false;

    // Check iteration limit
    if (this.state.iteration >= this.config.maxIterations) {
      debug(`Max iterations reached (${this.config.maxIterations})`);
      return false;
    }

    // Check token limit
    if (this.state.tokensUsed >= this.config.maxTokens) {
      debug(`Max tokens reached (${this.config.maxTokens})`);
      return false;
    }

    // Check task status
    if (this.state.task.status === 'completed') {
      debug('Task marked as complete');
      return false;
    }

    return true;
  }

  /**
   * Run a single iteration
   */
  private async runIteration(): Promise<void> {
    if (!this.state) return;

    this.state.iteration++;
    const record = createIterationRecord(this.state.iteration);

    debug(`Starting iteration ${this.state.iteration}`);
    this.events.emit('iterationStart', this.state.iteration, this.state);

    try {
      // Build context/prompt
      const prompt = this.buildPrompt();

      // Execute via agent
      const result = await this.agent.execute(prompt);

      if (result.success && result.tokenUsage) {
        // Update token usage
        this.state.tokensUsed += result.tokenUsage.totalTokens;

        // Emit token usage event
        this.events.emit('tokenUsage', result.tokenUsage, this.agent.getTokenUsage());

        // Complete the iteration record
        const completedRecord = completeIteration(
          record,
          true,
          result.tokenUsage.totalTokens,
          this.extractSummary(result.content ?? '')
        );

        this.state.iterations.push(completedRecord);
        this.events.emit('iterationEnd', completedRecord, this.state);
      } else {
        // Failed iteration
        const completedRecord = completeIteration(
          record,
          false,
          0,
          undefined,
          result.error ?? 'Unknown error'
        );

        this.state.iterations.push(completedRecord);
        this.events.emit('iterationEnd', completedRecord, this.state);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const completedRecord = completeIteration(record, false, 0, undefined, error.message);

      this.state.iterations.push(completedRecord);
      this.events.emit('iterationEnd', completedRecord, this.state);
    }
  }

  /**
   * Build the prompt for the current iteration
   */
  private buildPrompt(): string {
    if (!this.state) return '';

    const { task, iteration, iterations } = this.state;

    // Build context from previous iterations
    const previousSummaries = iterations
      .filter((i) => i.success && i.summary)
      .map((i) => `- Iteration ${i.iteration}: ${i.summary}`)
      .join('\n');

    return `# Task: ${task.title}

## Task Description
${task.content}

## Current State
- Iteration: ${iteration} of ${this.config.maxIterations}
- Tokens used: ${this.state.tokensUsed} of ${this.config.maxTokens}

${previousSummaries ? `## Previous Progress\n${previousSummaries}\n` : ''}
## Instructions
Please continue working on the task. When the task is complete, indicate that in your response.`;
  }

  /**
   * Extract a summary from the response
   */
  private extractSummary(content: string): string {
    // Simple extraction - first 100 chars
    const firstLine = content.split('\n')[0] ?? '';
    return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get token usage summary
   */
  getTokenUsage(): TokenUsage {
    return this.agent.getTokenUsage();
  }
}

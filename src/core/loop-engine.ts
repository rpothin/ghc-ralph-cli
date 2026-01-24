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
import { ContextBuilder, type ContextBuilderConfig } from './context-builder.js';

/**
 * Loop engine configuration
 */
export interface LoopEngineConfig {
  /** Maximum number of iterations */
  maxIterations: number;
  /** Maximum token budget */
  maxTokens: number;
  /** Maximum duration in minutes (0 = no limit) */
  maxDurationMinutes: number;
  /** Delay between iterations in ms */
  iterationDelayMs: number;
  /** Warning threshold percentage (default: 0.8 = 80%) */
  warningThreshold: number;
  /** Maximum consecutive failures before pausing */
  maxConsecutiveFailures: number;
  /** Whether unlimited iterations are allowed */
  allowUnlimited: boolean;
  /** Context builder configuration */
  contextConfig?: Partial<ContextBuilderConfig>;
}

/**
 * Default engine configuration
 */
const DEFAULT_CONFIG: LoopEngineConfig = {
  maxIterations: 10,
  maxTokens: 100000,
  maxDurationMinutes: 0,
  iterationDelayMs: 500,
  warningThreshold: 0.8,
  maxConsecutiveFailures: 3,
  allowUnlimited: false,
};

/**
 * Loop completion reason
 */
export type LoopCompletionReason =
  | 'task-complete'
  | 'max-iterations'
  | 'max-tokens'
  | 'max-duration'
  | 'circuit-breaker'
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
  private contextBuilder: ContextBuilder;
  private state: FullLoopState | null = null;
  private pauseRequested: boolean = false;
  private stopRequested: boolean = false;
  private consecutiveFailures: number = 0;
  private iterationWarningShown: boolean = false;
  private tokenWarningShown: boolean = false;

  constructor(agent: CopilotAgent, config: Partial<LoopEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agent = agent;
    this.events = new LoopEventEmitter();
    this.contextBuilder = new ContextBuilder(config.contextConfig);
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

    // Check for unlimited iterations (>50 requires explicit flag)
    if (this.config.maxIterations > 50 && !this.config.allowUnlimited) {
      debug('More than 50 iterations requires --unlimited flag');
      return false;
    }

    // Check token limit
    if (this.state.tokensUsed >= this.config.maxTokens) {
      debug(`Max tokens reached (${this.config.maxTokens})`);
      return false;
    }

    // Check duration limit
    if (this.config.maxDurationMinutes > 0) {
      const elapsed = Date.now() - this.state.startedAt.getTime();
      const maxDurationMs = this.config.maxDurationMinutes * 60 * 1000;
      if (elapsed >= maxDurationMs) {
        debug(`Max duration reached (${this.config.maxDurationMinutes} minutes)`);
        return false;
      }
    }

    // Check circuit breaker
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      debug(`Circuit breaker triggered after ${this.consecutiveFailures} consecutive failures`);
      this.events.emit('warning', 'circuit-breaker', 
        `${this.consecutiveFailures} consecutive iterations produced no changes. Pausing for review.`, 
        this.state);
      return false;
    }

    // Check task status
    if (this.state.task.status === 'completed') {
      debug('Task marked as complete');
      return false;
    }

    // Emit threshold warnings
    this.checkThresholds();

    return true;
  }

  /**
   * Check thresholds and emit warnings
   */
  private checkThresholds(): void {
    if (!this.state) return;

    const { iteration, tokensUsed, startedAt } = this.state;
    const { maxIterations, maxTokens, maxDurationMinutes, warningThreshold } = this.config;

    // Iteration threshold warning
    const iterationRatio = iteration / maxIterations;
    if (iterationRatio >= warningThreshold && !this.iterationWarningShown) {
      this.iterationWarningShown = true;
      this.events.emit('warning', 'iteration-threshold',
        `${iteration}/${maxIterations} iterations used (${Math.round(iterationRatio * 100)}%)`,
        this.state);
    }

    // Token threshold warning
    const tokenRatio = tokensUsed / maxTokens;
    if (tokenRatio >= warningThreshold && !this.tokenWarningShown) {
      this.tokenWarningShown = true;
      this.events.emit('warning', 'token-threshold',
        `Token usage at ${Math.round(tokenRatio * 100)}% of budget (${tokensUsed.toLocaleString()}/${maxTokens.toLocaleString()})`,
        this.state);
    }

    // Duration threshold warning
    if (maxDurationMinutes > 0) {
      const elapsed = Date.now() - startedAt.getTime();
      const maxDurationMs = maxDurationMinutes * 60 * 1000;
      const durationRatio = elapsed / maxDurationMs;
      if (durationRatio >= warningThreshold) {
        this.events.emit('warning', 'duration-threshold',
          `Duration at ${Math.round(durationRatio * 100)}% of limit`,
          this.state);
      }
    }
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
      // Build context/prompt using the context builder
      const builtContext = await this.contextBuilder.buildContext(
        this.state.task,
        this.state.iteration,
        this.config.maxIterations,
        this.state.tokensUsed,
        this.config.maxTokens,
        this.state.iterations
      );

      if (builtContext.truncated) {
        warn('Context was truncated to fit within token limits');
      }

      debug(`Context includes ${builtContext.filesIncluded.length} files, ~${builtContext.estimatedTokens} tokens`);

      // Execute via agent
      const result = await this.agent.execute(builtContext.prompt);

      if (result.success && result.tokenUsage) {
        // Reset consecutive failures counter on success
        this.consecutiveFailures = 0;

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
        // Track consecutive failures
        this.consecutiveFailures++;

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
      // Track consecutive failures
      this.consecutiveFailures++;

      const error = err instanceof Error ? err : new Error(String(err));
      const completedRecord = completeIteration(record, false, 0, undefined, error.message);

      this.state.iterations.push(completedRecord);
      this.events.emit('iterationEnd', completedRecord, this.state);
    }
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

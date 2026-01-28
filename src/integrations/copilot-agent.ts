/**
 * Copilot Agent
 *
 * Integration with GitHub Copilot for AI agent capabilities
 * Uses the @github/copilot-sdk for actual Copilot API access
 */

import { CopilotClient, type CopilotSession, type ModelInfo } from '@github/copilot-sdk';
import { debug, error as logError, info, warn } from '../utils/index.js';
import { getGitHubAuth, type AuthResult } from './auth.js';
import { TokenTracker, estimateTokens, type TokenUsage } from './tokens.js';

// Re-export ModelInfo for consumers
export type { ModelInfo } from '@github/copilot-sdk';

/**
 * Available Copilot models
 */
export type CopilotModel = 'gpt-4' | 'gpt-4.1' | 'gpt-4-turbo' | 'gpt-5' | 'claude-sonnet-4.5' | string;

/**
 * Copilot agent configuration
 */
export interface CopilotAgentConfig {
  /** Model to use for completions */
  model: CopilotModel;
  /** Maximum tokens per request */
  maxTokensPerRequest: number;
  /** Number of retries on failure */
  maxRetries: number;
  /** Delay between retries in ms */
  retryDelayMs: number;
  /** Working directory for file operations */
  cwd: string;
}

/**
 * Default agent configuration
 */
const DEFAULT_CONFIG: CopilotAgentConfig = {
  model: 'gpt-4.1',
  maxTokensPerRequest: 4096,
  maxRetries: 3,
  retryDelayMs: 1000,
  cwd: process.cwd(),
};

/**
 * Execution result from the agent
 */
export interface ExecutionResult {
  /** Whether the execution succeeded */
  success: boolean;
  /** Response content */
  content?: string;
  /** Token usage for this request */
  tokenUsage?: TokenUsage;
  /** Error message if failed */
  error?: string;
}

/**
 * Error types for Copilot API
 */
export class CopilotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'CopilotError';
  }
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * CopilotAgent class for interacting with GitHub Copilot
 */
export class CopilotAgent {
  private config: CopilotAgentConfig;
  private tokenTracker: TokenTracker;
  private authResult: AuthResult | null = null;
  private initialized: boolean = false;
  private client: CopilotClient | null = null;
  private session: CopilotSession | null = null;

  constructor(config: Partial<CopilotAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokenTracker = new TokenTracker();
  }

  /**
   * Initialize the agent session
   */
  async initialize(): Promise<boolean> {
    debug('Initializing Copilot agent...');

    // Get authentication
    this.authResult = getGitHubAuth();

    if (!this.authResult.authenticated) {
      logError(this.authResult.error ?? 'Authentication failed');
      return false;
    }

    try {
      // Create Copilot client
      this.client = new CopilotClient({
        autoStart: true,
        logLevel: 'error',
      });

      // Start the client
      await this.client.start();
      debug('Copilot client started');

      // Create a session with the specified model
      this.session = await this.client.createSession({
        model: this.config.model,
      });
      debug(`Session created with model: ${this.config.model}`);

      info(`Copilot agent initialized (model: ${this.config.model})`);
      this.initialized = true;
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logError(`Failed to initialize Copilot SDK: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Check if the agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Execute a prompt and get a response
   */
  async execute(prompt: string): Promise<ExecutionResult> {
    if (!this.initialized || !this.session) {
      throw new CopilotError('Agent not initialized', 'NOT_INITIALIZED');
    }

    debug(`Executing prompt (${estimateTokens(prompt)} estimated tokens)`);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeWithRetry(prompt);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof CopilotError && !err.retryable) {
          break;
        }

        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          debug(`Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms`);
          await sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message ?? 'Unknown error',
    };
  }

  /**
   * Execute with retry logic using Copilot SDK
   */
  private async executeWithRetry(prompt: string): Promise<ExecutionResult> {
    if (!this.session) {
      throw new CopilotError('No active session', 'NO_SESSION');
    }

    const promptTokens = estimateTokens(prompt);
    let responseContent = '';

    try {
      const response = await this.session.sendAndWait({ prompt }, 120000);
      responseContent = response?.data.content ?? '';

      const completionTokens = estimateTokens(responseContent);
      this.tokenTracker.addUsage(promptTokens, completionTokens);

      return {
        success: true,
        content: responseContent,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      warn(`Copilot execution error: ${errorMsg}`);
      throw err;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      if (this.session) {
        await this.session.destroy();
        this.session = null;
      }
      if (this.client) {
        await this.client.stop();
        this.client = null;
      }
      this.initialized = false;
      debug('Copilot agent destroyed');
    } catch (err) {
      warn(`Error during cleanup: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get total token usage
   */
  getTokenUsage(): TokenUsage {
    return this.tokenTracker.getUsage();
  }

  /**
   * Reset token tracking
   */
  resetTokenUsage(): void {
    this.tokenTracker.reset();
  }

  /**
   * Check if token budget is exceeded
   */
  isTokenBudgetExceeded(maxTokens: number): boolean {
    return this.tokenTracker.exceedsLimit(maxTokens);
  }

  /**
   * Get the current model
   */
  getModel(): CopilotModel {
    return this.config.model;
  }

  /**
   * Set the model
   */
  setModel(model: CopilotModel): void {
    this.config.model = model;
    debug(`Model set to: ${model}`);
  }

  /**
   * Get the current configuration
   */
  getConfig(): CopilotAgentConfig {
    return { ...this.config };
  }

  /**
   * List available models from the Copilot API
   * Returns models with their capabilities and metadata
   */
  async listAvailableModels(): Promise<ModelInfo[]> {
    // Create a temporary client if not initialized
    if (!this.client) {
      const tempClient = new CopilotClient({
        autoStart: true,
        logLevel: 'error',
      });

      try {
        await tempClient.start();
        const models = await tempClient.listModels();
        await tempClient.stop();
        return models;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        warn(`Failed to list models: ${errorMsg}`);
        await tempClient.stop().catch(() => {});
        return [];
      }
    }

    // Use existing client
    try {
      return await this.client.listModels();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      warn(`Failed to list models: ${errorMsg}`);
      return [];
    }
  }

  /**
   * Static method to list available models without requiring agent initialization
   */
  static async fetchAvailableModels(): Promise<ModelInfo[]> {
    const tempClient = new CopilotClient({
      autoStart: true,
      logLevel: 'error',
    });

    try {
      await tempClient.start();
      const models = await tempClient.listModels();
      await tempClient.stop();
      return models;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      warn(`Failed to fetch models: ${errorMsg}`);
      await tempClient.stop().catch(() => {});
      return [];
    }
  }
}

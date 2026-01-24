/**
 * Copilot Agent
 *
 * Integration with GitHub Copilot for AI agent capabilities
 */

import { debug, error as logError, info } from '../utils/index.js';
import { getGitHubAuth, type AuthResult } from './auth.js';
import { TokenTracker, estimateTokens, type TokenUsage } from './tokens.js';

/**
 * Available Copilot models
 */
export type CopilotModel = 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'claude-3-sonnet' | string;

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
}

/**
 * Default agent configuration
 */
const DEFAULT_CONFIG: CopilotAgentConfig = {
  model: 'gpt-4',
  maxTokensPerRequest: 4096,
  maxRetries: 3,
  retryDelayMs: 1000,
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

    info(`Copilot agent initialized (model: ${this.config.model})`);
    this.initialized = true;
    return true;
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
    if (!this.initialized) {
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
   * Execute with retry logic
   */
  private async executeWithRetry(prompt: string): Promise<ExecutionResult> {
    // Estimate token usage (actual would come from API response)
    const promptTokens = estimateTokens(prompt);

    // TODO: Implement actual API call to Copilot
    // For now, this is a placeholder that simulates the interface
    // The actual implementation will depend on the available Copilot API

    // Simulate a response for testing the interface
    const responseContent = `[Copilot Agent Response Placeholder]

This is a placeholder response. The actual Copilot integration requires:
1. Access to the GitHub Copilot API endpoint
2. Proper authentication with Copilot-enabled token
3. API call implementation

Prompt received (${promptTokens} estimated tokens):
${prompt.substring(0, 200)}...`;

    const completionTokens = estimateTokens(responseContent);

    // Track token usage
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
}

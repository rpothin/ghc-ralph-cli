/**
 * Token Usage Tracking
 *
 * Tracks token consumption across Copilot API calls
 */

/**
 * Token usage metrics
 */
export interface TokenUsage {
  /** Tokens used in prompts */
  promptTokens: number;
  /** Tokens used in completions */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Token usage tracker class
 */
export class TokenTracker {
  private promptTokens: number = 0;
  private completionTokens: number = 0;

  /**
   * Add token usage from a request
   */
  addUsage(prompt: number, completion: number): void {
    this.promptTokens += prompt;
    this.completionTokens += completion;
  }

  /**
   * Get current token usage
   */
  getUsage(): TokenUsage {
    return {
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.promptTokens + this.completionTokens,
    };
  }

  /**
   * Reset token tracking
   */
  reset(): void {
    this.promptTokens = 0;
    this.completionTokens = 0;
  }

  /**
   * Check if usage exceeds a limit
   */
  exceedsLimit(maxTokens: number): boolean {
    return this.promptTokens + this.completionTokens >= maxTokens;
  }
}

/**
 * Estimate token count for a string (rough approximation)
 * Uses ~4 characters per token heuristic
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

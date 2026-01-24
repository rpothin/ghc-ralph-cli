/**
 * Integrations
 *
 * This module contains integrations with:
 * - GitHub Copilot SDK
 * - GitHub API (for Issues)
 * - Git operations
 */

export { CopilotAgent, CopilotError } from './copilot-agent.js';
export type { CopilotModel, CopilotAgentConfig, ExecutionResult } from './copilot-agent.js';

export { getGitHubAuth, isAuthenticated } from './auth.js';
export type { AuthResult } from './auth.js';

export { TokenTracker, estimateTokens } from './tokens.js';
export type { TokenUsage } from './tokens.js';

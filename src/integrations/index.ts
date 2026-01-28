/**
 * Integrations
 *
 * This module contains integrations with:
 * - GitHub Copilot SDK
 * - GitHub API (for Issues)
 * - Git operations
 * - MCP Tools
 */

export { CopilotAgent, CopilotError } from './copilot-agent.js';
export type { CopilotModel, CopilotAgentConfig, ExecutionResult, ModelInfo } from './copilot-agent.js';

export { getGitHubAuth, isAuthenticated } from './auth.js';
export type { AuthResult } from './auth.js';

export { TokenTracker, estimateTokens } from './tokens.js';
export type { TokenUsage } from './tokens.js';

export { MCPToolManager, createMCPToolManager } from './mcp-tools.js';
export type { MCPServerConfig, MCPTool, MCPToolResult, MCPServerConnection } from './mcp-tools.js';

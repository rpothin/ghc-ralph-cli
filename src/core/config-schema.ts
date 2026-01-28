/**
 * Configuration Schema
 *
 * Type definitions for GitHub Copilot Ralph CLI configuration
 */

/**
 * Plan source type
 */
export type PlanSource = 'github' | 'local';

/**
 * MCP Server configuration for custom tools
 */
export interface MCPServerConfiguration {
  /** Name of the MCP server */
  name: string;
  /** Command to run the server */
  command: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Transport type (stdio or http) */
  transport?: 'stdio' | 'http';
  /** HTTP endpoint (for http transport) */
  endpoint?: string;
}

/**
 * GitHub Copilot Ralph CLI configuration
 */
export interface RalphConfiguration {
  /** Source for the plan: GitHub Issues or local Markdown */
  planSource: PlanSource;
  /** Maximum number of loop iterations */
  maxIterations: number;
  /** Maximum token budget for the session */
  maxTokens: number;
  /** Default Copilot model to use (gpt-4.1 has 0x multiplier) */
  defaultModel: string;
  /** Whether to auto-commit after each iteration */
  autoCommit: boolean;
  /** Prefix for GitHub Copilot Ralph branches */
  branchPrefix: string;
  /** GitHub repository (owner/repo) for GitHub plan source */
  githubRepo?: string;
  /** Default GitHub issue label filter for GitHub plan source */
  githubLabel?: string;
  /** Default GitHub issue milestone filter for GitHub plan source */
  githubMilestone?: string;
  /** Default GitHub issue assignee filter for GitHub plan source */
  githubAssignee?: string;
  /** Local plan file path for local plan source */
  localPlanFile?: string;
  /** Custom prompt template */
  promptTemplate?: string;
  /** MCP servers for custom tools */
  mcpServers?: MCPServerConfiguration[];
  /** Maximum retries per task before marking as failed (default: 2) */
  maxRetriesPerTask?: number;
  /** Whether to auto-push after each task completion (default: false) */
  autoPush?: boolean;
  /** Push strategy: 'per-task' pushes after each task, 'per-run' pushes after all tasks complete (default: 'per-task') */
  pushStrategy?: 'per-task' | 'per-run' | 'manual';
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: RalphConfiguration = {
  planSource: 'local',
  maxIterations: 10,
  maxTokens: 100000,
  defaultModel: 'gpt-4.1',
  autoCommit: true,
  branchPrefix: 'ghcralph/',
  maxRetriesPerTask: 2,
  autoPush: false,
  pushStrategy: 'per-task',
};

/**
 * Configuration keys for validation
 */
export const CONFIG_KEYS = [
  'planSource',
  'maxIterations',
  'maxTokens',
  'defaultModel',
  'autoCommit',
  'branchPrefix',
  'githubRepo',
  'githubLabel',
  'githubMilestone',
  'githubAssignee',
  'localPlanFile',
  'promptTemplate',
  'mcpServers',
  'maxRetriesPerTask',
  'autoPush',
  'pushStrategy',
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

/**
 * Check if a string is a valid config key
 */
export function isValidConfigKey(key: string): key is ConfigKey {
  return CONFIG_KEYS.includes(key as ConfigKey);
}

/**
 * Validate a configuration value for a key
 */
export function validateConfigValue(
  key: ConfigKey,
  value: unknown
): { valid: boolean; error?: string } {
  switch (key) {
    case 'planSource':
      if (value !== 'github' && value !== 'local') {
        return { valid: false, error: 'planSource must be "github" or "local"' };
      }
      break;
    case 'maxIterations':
    case 'maxTokens':
      if (typeof value !== 'number' || value < 1) {
        return { valid: false, error: `${key} must be a positive number` };
      }
      break;
    case 'autoCommit':
    case 'autoPush':
      if (typeof value !== 'boolean') {
        return { valid: false, error: `${key} must be a boolean` };
      }
      break;
    case 'maxRetriesPerTask':
      if (typeof value !== 'number' || value < 1) {
        return { valid: false, error: 'maxRetriesPerTask must be a positive number' };
      }
      break;
    case 'pushStrategy':
      if (value !== 'per-task' && value !== 'per-run' && value !== 'manual') {
        return { valid: false, error: 'pushStrategy must be "per-task", "per-run", or "manual"' };
      }
      break;
    case 'defaultModel':
    case 'branchPrefix':
    case 'githubRepo':
    case 'githubLabel':
    case 'githubMilestone':
    case 'githubAssignee':
    case 'localPlanFile':
      if (typeof value !== 'string') {
        return { valid: false, error: `${key} must be a string` };
      }
      break;
  }
  return { valid: true };
}

/**
 * Parse a string value to the appropriate type for a config key
 */
export function parseConfigValue(key: ConfigKey, value: string): unknown {
  switch (key) {
    case 'maxIterations':
    case 'maxTokens':
    case 'maxRetriesPerTask':
      return parseInt(value, 10);
    case 'autoCommit':
    case 'autoPush':
      return value.toLowerCase() === 'true';
    default:
      return value;
  }
}

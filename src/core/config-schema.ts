/**
 * Configuration Schema
 *
 * Type definitions for Ralph CLI configuration
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
 * Ralph CLI configuration
 */
export interface RalphConfiguration {
  /** Source for the plan: GitHub Issues or local Markdown */
  planSource: PlanSource;
  /** Maximum number of loop iterations */
  maxIterations: number;
  /** Maximum token budget for the session */
  maxTokens: number;
  /** Default Copilot model to use */
  defaultModel: string;
  /** Whether to auto-commit after each iteration */
  autoCommit: boolean;
  /** Prefix for Ralph branches */
  branchPrefix: string;
  /** GitHub repository (owner/repo) for GitHub plan source */
  githubRepo?: string;
  /** Local plan file path for local plan source */
  localPlanFile?: string;
  /** Custom prompt template */
  promptTemplate?: string;
  /** MCP servers for custom tools */
  mcpServers?: MCPServerConfiguration[];
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: RalphConfiguration = {
  planSource: 'local',
  maxIterations: 10,
  maxTokens: 100000,
  defaultModel: 'gpt-4',
  autoCommit: true,
  branchPrefix: 'ralph/',
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
  'localPlanFile',
  'promptTemplate',
  'mcpServers',
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
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'autoCommit must be a boolean' };
      }
      break;
    case 'defaultModel':
    case 'branchPrefix':
    case 'githubRepo':
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
      return parseInt(value, 10);
    case 'autoCommit':
      return value.toLowerCase() === 'true';
    default:
      return value;
  }
}

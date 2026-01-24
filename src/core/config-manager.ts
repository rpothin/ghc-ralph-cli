/**
 * Configuration Manager
 *
 * Handles loading, saving, and merging configuration from multiple sources
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfigDir, getLocalStateDir } from '../utils/paths.js';
import { debug } from '../utils/output.js';
import {
  DEFAULT_CONFIG,
  isValidConfigKey,
  validateConfigValue,
  parseConfigValue,
  type RalphConfiguration,
  type ConfigKey,
} from './config-schema.js';

/**
 * Configuration file names
 */
const GLOBAL_CONFIG_FILE = 'config.json';
const LOCAL_CONFIG_FILE = 'config.json';

/**
 * Environment variable prefix
 */
const ENV_PREFIX = 'GHCRALPH_';

/**
 * Load configuration from a JSON file
 */
async function loadConfigFile(filePath: string): Promise<Partial<RalphConfiguration>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Partial<RalphConfiguration>;
  } catch {
    return {};
  }
}

/**
 * Save configuration to a JSON file
 */
async function saveConfigFile(
  filePath: string,
  config: Partial<RalphConfiguration>
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<RalphConfiguration> {
  const config: Partial<RalphConfiguration> = {};

  const envMappings: Record<string, ConfigKey> = {
    [`${ENV_PREFIX}PLAN_SOURCE`]: 'planSource',
    [`${ENV_PREFIX}MAX_ITERATIONS`]: 'maxIterations',
    [`${ENV_PREFIX}MAX_TOKENS`]: 'maxTokens',
    [`${ENV_PREFIX}DEFAULT_MODEL`]: 'defaultModel',
    [`${ENV_PREFIX}AUTO_COMMIT`]: 'autoCommit',
    [`${ENV_PREFIX}BRANCH_PREFIX`]: 'branchPrefix',
    [`${ENV_PREFIX}GITHUB_REPO`]: 'githubRepo',
    [`${ENV_PREFIX}LOCAL_PLAN_FILE`]: 'localPlanFile',
  };

  for (const [envVar, configKey] of Object.entries(envMappings)) {
    const value = process.env[envVar];
    if (value !== undefined) {
      const parsed = parseConfigValue(configKey, value);
      const validation = validateConfigValue(configKey, parsed);
      if (validation.valid) {
        (config as Record<string, unknown>)[configKey] = parsed;
      }
    }
  }

  return config;
}

/**
 * Get the global configuration file path
 */
export function getGlobalConfigPath(): string {
  return path.join(getConfigDir(), GLOBAL_CONFIG_FILE);
}

/**
 * Get the local configuration file path
 */
export function getLocalConfigPath(projectRoot?: string): string {
  return path.join(getLocalStateDir(projectRoot), LOCAL_CONFIG_FILE);
}

/**
 * Configuration manager class
 */
export class ConfigManager {
  private config: RalphConfiguration;
  private projectRoot: string | undefined;

  constructor(projectRoot?: string) {
    this.config = { ...DEFAULT_CONFIG };
    this.projectRoot = projectRoot;
  }

  /**
   * Load configuration from all sources
   * Priority: CLI flags > Env vars > Local config > Global config > Defaults
   */
  async load(cliOverrides?: Partial<RalphConfiguration>): Promise<RalphConfiguration> {
    // Start with defaults
    this.config = { ...DEFAULT_CONFIG };

    // Load global config
    const globalConfigPath = getGlobalConfigPath();
    const globalConfig = await loadConfigFile(globalConfigPath);
    debug(`Loaded global config from ${globalConfigPath}`);

    // Load local config
    const localConfigPath = getLocalConfigPath(this.projectRoot);
    const localConfig = await loadConfigFile(localConfigPath);
    debug(`Loaded local config from ${localConfigPath}`);

    // Load env config
    const envConfig = loadEnvConfig();

    // Merge in priority order
    this.config = {
      ...this.config,
      ...globalConfig,
      ...localConfig,
      ...envConfig,
      ...cliOverrides,
    };

    return this.config;
  }

  /**
   * Get the current configuration
   */
  getConfig(): RalphConfiguration {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  get<K extends ConfigKey>(key: K): RalphConfiguration[K] {
    return this.config[key];
  }

  /**
   * Set a configuration value (in memory)
   */
  set<K extends ConfigKey>(key: K, value: RalphConfiguration[K]): void {
    const validation = validateConfigValue(key, value);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    this.config[key] = value;
  }

  /**
   * Save configuration to local config file
   */
  async saveLocal(): Promise<void> {
    const configPath = getLocalConfigPath(this.projectRoot);
    await saveConfigFile(configPath, this.config);
    debug(`Saved local config to ${configPath}`);
  }

  /**
   * Save configuration to global config file
   */
  async saveGlobal(): Promise<void> {
    const configPath = getGlobalConfigPath();
    await saveConfigFile(configPath, this.config);
    debug(`Saved global config to ${configPath}`);
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Check if local configuration exists
   */
  async hasLocalConfig(): Promise<boolean> {
    try {
      await fs.access(getLocalConfigPath(this.projectRoot));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize local configuration directory
   */
  async initLocal(): Promise<string> {
    const stateDir = getLocalStateDir(this.projectRoot);
    await fs.mkdir(stateDir, { recursive: true });
    await this.saveLocal();
    return stateDir;
  }
}

// Export for convenience
export { isValidConfigKey, validateConfigValue, parseConfigValue, DEFAULT_CONFIG };
export type { RalphConfiguration, ConfigKey };

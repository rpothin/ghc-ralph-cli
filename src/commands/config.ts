/**
 * Config Command
 *
 * View or modify Ralph configuration
 */

import type { Command } from 'commander';
import { info, success, error, code, dim, heading } from '../utils/index.js';
import {
  ConfigManager,
  isValidConfigKey,
  parseConfigValue,
  validateConfigValue,
  getGlobalConfigPath,
  getLocalConfigPath,
  type ConfigKey,
} from '../core/config-manager.js';

export function registerConfigCommand(program: Command): void {
  const configCmd = program.command('config').description('View or modify configuration');

  configCmd
    .command('get [key]')
    .description('Get configuration value(s)')
    .option('--global', 'Show global configuration')
    .action(async (key?: string, _options?: { global?: boolean }) => {
      const configManager = new ConfigManager();
      await configManager.load();
      const config = configManager.getConfig();

      if (key) {
        if (!isValidConfigKey(key)) {
          error(`Unknown configuration key: ${key}`);
          process.exit(1);
        }
        const value = config[key as ConfigKey];
        console.log(value);
      } else {
        console.log('');
        console.log(heading('📋 Ralph Configuration'));
        console.log('');

        for (const [k, v] of Object.entries(config)) {
          const displayValue = typeof v === 'string' ? code(v) : String(v);
          console.log(`  ${dim(k + ':')} ${displayValue}`);
        }

        console.log('');
        console.log(dim('Config files:'));
        console.log(`  ${dim('Global:')} ${getGlobalConfigPath()}`);
        console.log(`  ${dim('Local:')} ${getLocalConfigPath()}`);
        console.log('');
      }
    });

  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .option('--global', 'Set in global configuration')
    .action(async (key: string, value: string, options?: { global?: boolean }) => {
      if (!isValidConfigKey(key)) {
        error(`Unknown configuration key: ${key}`);
        info(
          `Valid keys: ${code('planSource, maxIterations, maxTokens, defaultModel, autoCommit, branchPrefix, githubRepo, localPlanFile')}`
        );
        process.exit(1);
      }

      const parsedValue = parseConfigValue(key as ConfigKey, value);
      const validation = validateConfigValue(key as ConfigKey, parsedValue);

      if (!validation.valid) {
        error(validation.error ?? 'Invalid value');
        process.exit(1);
      }

      const configManager = new ConfigManager();
      await configManager.load();
      configManager.set(key as ConfigKey, parsedValue as never);

      if (options?.global) {
        await configManager.saveGlobal();
        success(`Set ${code(key)} = ${code(String(parsedValue))} (global)`);
      } else {
        await configManager.saveLocal();
        success(`Set ${code(key)} = ${code(String(parsedValue))} (local)`);
      }
    });

  configCmd
    .command('list')
    .description('List all configuration')
    .action(async () => {
      const configManager = new ConfigManager();
      await configManager.load();
      const config = configManager.getConfig();

      console.log('');
      console.log(heading('📋 Ralph Configuration'));
      console.log('');

      for (const [key, value] of Object.entries(config)) {
        const displayValue = typeof value === 'string' ? code(value) : String(value);
        console.log(`  ${dim(key + ':')} ${displayValue}`);
      }

      console.log('');
    });

  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .option('--force', 'Skip confirmation')
    .option('--global', 'Reset global configuration')
    .action(async (options: { force?: boolean; global?: boolean }) => {
      if (!options.force) {
        error('Use --force to confirm reset');
        return;
      }

      const configManager = new ConfigManager();
      configManager.reset();

      if (options.global) {
        await configManager.saveGlobal();
        success('Global configuration reset to defaults');
      } else {
        await configManager.saveLocal();
        success('Local configuration reset to defaults');
      }
    });

  configCmd
    .command('path')
    .description('Show configuration file paths')
    .action(() => {
      console.log('');
      console.log(heading('📁 Configuration Paths'));
      console.log('');
      console.log(`  ${dim('Global:')} ${getGlobalConfigPath()}`);
      console.log(`  ${dim('Local:')} ${getLocalConfigPath()}`);
      console.log('');
    });
}

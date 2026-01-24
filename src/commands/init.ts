/**
 * Init Command
 *
 * Initialize GitHub Copilot Ralph in a repository
 */

import { execSync } from 'node:child_process';
import type { Command } from 'commander';
import { info, success, error, warn, debug, heading, code, dim } from '../utils/index.js';
import { ConfigManager } from '../core/config-manager.js';
import type { PlanSource } from '../core/config-schema.js';

/**
 * Check if we're in a git repository
 */
function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the git repository root
 */
function getGitRoot(): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

export interface InitOptions {
  force?: boolean;
  planSource?: PlanSource;
  local?: boolean;
  github?: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize GitHub Copilot Ralph in the current repository')
    .option('--force', 'Overwrite existing configuration')
    .option('--local', 'Use local Markdown files as plan source')
    .option('--github', 'Use GitHub Issues as plan source')
    .option('--plan-source <source>', 'Plan source (github or local)')
    .addHelpText('after', `
Examples:
  $ ghcralph init                    # Interactive initialization
  $ ghcralph init --local            # Use local Markdown plan files
  $ ghcralph init --github           # Use GitHub Issues as plan source
  $ ghcralph init --force            # Overwrite existing configuration

This command will:
  1. Create .ghcralph/ directory in your project
  2. Generate config.json with default settings
  3. Add .ghcralph/ to .gitignore (optional)

See also:
  ghcralph run     Execute a coding loop
  ghcralph config  View or modify configuration
`)
    .action(async (options: InitOptions) => {
      console.log('');
      console.log(heading('🤖 GitHub Copilot Ralph - Initialize'));
      console.log('');

      // Check for git repository
      if (!isGitRepository()) {
        error('Not in a git repository. Please run "git init" first.');
        process.exit(1);
      }

      const gitRoot = getGitRoot();
      debug(`Git root: ${gitRoot}`);

      // Create config manager
      const configManager = new ConfigManager(gitRoot ?? undefined);

      // Check for existing configuration
      const hasExisting = await configManager.hasLocalConfig();
      if (hasExisting && !options.force) {
        warn('GitHub Copilot Ralph is already initialized in this repository.');
        info(`Use ${code('--force')} to reinitialize.`);
        return;
      }

      // Load existing or default config
      await configManager.load();

      // Determine plan source
      let planSource: PlanSource = 'local';
      if (options.github) {
        planSource = 'github';
      } else if (options.local) {
        planSource = 'local';
      } else if (options.planSource) {
        planSource = options.planSource as PlanSource;
      }

      // Update configuration
      configManager.set('planSource', planSource);

      // Initialize local directory and save config
      const stateDir = await configManager.initLocal();

      // Display configuration
      const config = configManager.getConfig();
      console.log(dim('Configuration:'));
      console.log(`  ${dim('Plan source:')} ${code(config.planSource)}`);
      console.log(`  ${dim('Max iterations:')} ${config.maxIterations}`);
      console.log(`  ${dim('Max tokens:')} ${config.maxTokens.toLocaleString()}`);
      console.log(`  ${dim('Model:')} ${code(config.defaultModel)}`);
      console.log(`  ${dim('Auto commit:')} ${config.autoCommit}`);
      console.log(`  ${dim('Branch prefix:')} ${code(config.branchPrefix)}`);
      console.log('');
      console.log(dim('Created:'));
      console.log(`  ${code(stateDir)}`);
      console.log('');

      success('GitHub Copilot Ralph initialized successfully!');
      console.log('');
      info(`Run ${code('ghcralph run --task "Your task"')} to start.`);
    });
}

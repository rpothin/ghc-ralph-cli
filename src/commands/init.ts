/**
 * Init Command
 *
 * Initialize GitHub Copilot Ralph in a repository
 */

import { execSync } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline/promises';
import type { Command } from 'commander';
import { info, success, error, warn, debug, heading, code, dim } from '../utils/index.js';
import { ConfigManager } from '../core/config-manager.js';
import type { PlanSource } from '../core/config-schema.js';
import { CopilotAgent, type ModelInfo } from '../integrations/copilot-agent.js';

// Fallback models if SDK fetch fails
const FALLBACK_MODELS = [
  'gpt-4.1',
  'claude-sonnet-4.5',
  'gpt-5',
  'gpt-5.2-codex',
] as const;

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

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function promptConfirm(
  rl: Interface,
  message: string,
  defaultValue: boolean
): Promise<boolean> {
  while (true) {
    const hint = defaultValue ? 'Y/n' : 'y/N';
    const answer = (await rl.question(`${message} (${hint}) `)).trim().toLowerCase();

    if (!answer) return defaultValue;
    if (answer === 'y' || answer === 'yes') return true;
    if (answer === 'n' || answer === 'no') return false;
  }
}

async function promptNumber(rl: Interface, message: string, defaultValue: number): Promise<number> {
  while (true) {
    const answer = (await rl.question(`${message} (${defaultValue}) `)).trim();
    if (!answer) return defaultValue;

    const parsed = parseInt(answer, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;

    console.log(dim('Please enter a positive number.'));
  }
}

async function promptString(rl: Interface, message: string, defaultValue: string): Promise<string> {
  const answer = (await rl.question(`${message} (${defaultValue}) `)).trim();
  return answer || defaultValue;
}

async function promptGitHubRepo(rl: Interface, defaultValue?: string): Promise<string> {
  while (true) {
    const hint = defaultValue ? ` (${defaultValue}) ` : ' ';
    const answer = (await rl.question(`GitHub repo (owner/repo)${hint}`)).trim();
    const value = answer || defaultValue || '';

    const parts = value.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) return value;

    console.log(dim('Please enter a valid repo in the form owner/repo.'));
  }
}

async function promptOptionalString(rl: Interface, message: string, defaultValue?: string): Promise<string | undefined> {
  const hint = defaultValue ? ` (${defaultValue}) ` : ' ';
  const answer = (await rl.question(`${message}${hint}`)).trim();
  const value = answer || defaultValue || '';
  return value ? value : undefined;
}

async function promptSelect<T extends string>(
  rl: Interface,
  message: string,
  options: ReadonlyArray<{ label: string; value: T }>,
  defaultValue: T
): Promise<T> {
  const first = options[0];
  if (!first) {
    throw new Error(`No options provided for ${message}`);
  }

  let defaultIndex = options.findIndex(o => o.value === defaultValue);
  if (defaultIndex < 0) defaultIndex = 0;

  while (true) {
    console.log('');
    console.log(dim(`${message}:`));
    for (const [i, opt] of options.entries()) {
      const isDefault = i === defaultIndex;
      console.log(`  ${i + 1}) ${opt.label}${isDefault ? dim(' (default)') : ''}`);
    }

    const answer = (await rl.question(`${message} [1-${options.length}] `)).trim();
    if (!answer) {
      return options[defaultIndex]?.value ?? first.value;
    }

    const idx = parseInt(answer, 10) - 1;
    const selected = Number.isInteger(idx) ? options[idx] : undefined;
    if (selected) return selected.value;

    console.log(dim('Please enter a valid option number.'));
  }
}

/**
 * Fetch available models from the Copilot SDK
 * Falls back to hardcoded list if fetch fails
 */
async function fetchModelOptions(currentDefault: string): Promise<Array<{ label: string; value: string }>> {
  debug('Fetching available models from Copilot SDK...');
  
  try {
    const models = await CopilotAgent.fetchAvailableModels();
    
    if (models.length > 0) {
      debug(`Found ${models.length} models from SDK`);
      const options = models.map((m: ModelInfo) => ({
        label: m.name || m.id,
        value: m.id,
      }));
      // Add custom option at the end
      options.push({ label: 'Custom (enter manually)', value: '__custom__' });
      return options;
    }
  } catch (err) {
    debug(`Failed to fetch models: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  // Fallback to hardcoded list
  debug('Using fallback model list');
  const fallbackOptions: Array<{ label: string; value: string }> = FALLBACK_MODELS.map(m => ({ label: m, value: m }));
  fallbackOptions.push({ label: 'Custom (enter manually)', value: '__custom__' });
  return fallbackOptions;
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

      const shouldPrompt =
        isInteractiveTerminal() &&
        options.planSource === undefined &&
        options.github !== true &&
        options.local !== true;

      let stateDir: string | undefined;
      try {
        if (shouldPrompt) {
          const rl = createInterface({ input: process.stdin, output: process.stdout });

          const current = configManager.getConfig();
          console.log(dim('Default configuration:'));
          console.log(`  ${dim('Plan source:')} ${code(current.planSource)}`);
          console.log(`  ${dim('Max iterations:')} ${current.maxIterations}`);
          console.log(`  ${dim('Max tokens:')} ${current.maxTokens.toLocaleString()}`);
          console.log(`  ${dim('Model:')} ${code(current.defaultModel)}`);
          console.log(`  ${dim('Auto commit:')} ${current.autoCommit}`);
          console.log(`  ${dim('Branch prefix:')} ${code(current.branchPrefix)}`);
          if (current.planSource === 'github') {
            console.log(`  ${dim('GitHub repo:')} ${code(current.githubRepo ?? '(not set)')}`);
            if (current.githubLabel) {
              console.log(`  ${dim('GitHub label:')} ${code(current.githubLabel)}`);
            }
            if (current.githubMilestone) {
              console.log(`  ${dim('GitHub milestone:')} ${code(current.githubMilestone)}`);
            }
            if (current.githubAssignee) {
              console.log(`  ${dim('GitHub assignee:')} ${code(current.githubAssignee)}`);
            }
          }
          console.log('');

          const keepDefaults = await promptConfirm(rl, 'Keep these defaults?', true);

          if (!keepDefaults) {
            const selectedPlanSource = await promptSelect<PlanSource>(
              rl,
              'Plan source',
              [
                { label: 'local', value: 'local' },
                { label: 'github', value: 'github' },
              ],
              current.planSource
            );
            configManager.set('planSource', selectedPlanSource);

            const maxIterations = await promptNumber(rl, 'Max iterations', current.maxIterations);
            configManager.set('maxIterations', maxIterations);

            const maxTokens = await promptNumber(rl, 'Max tokens', current.maxTokens);
            configManager.set('maxTokens', maxTokens);

            // Fetch available models dynamically from SDK
            const modelOptions = await fetchModelOptions(current.defaultModel);

            const selectedModel = await promptSelect(
              rl,
              'Model',
              modelOptions,
              (modelOptions.some(o => o.value === current.defaultModel)
                ? current.defaultModel
                : '__custom__')
            );

            if (selectedModel === '__custom__') {
              const customModel = await promptString(rl, 'Custom model', current.defaultModel);
              configManager.set('defaultModel', customModel);
            } else {
              configManager.set('defaultModel', selectedModel);
            }

            const selectedAutoCommit = await promptSelect<'true' | 'false'>(
              rl,
              'Auto commit',
              [
                { label: 'true', value: 'true' },
                { label: 'false', value: 'false' },
              ],
              current.autoCommit ? 'true' : 'false'
            );
            configManager.set('autoCommit', selectedAutoCommit === 'true');

            const branchPrefix = await promptString(rl, 'Branch prefix', current.branchPrefix);
            configManager.set('branchPrefix', branchPrefix);
          }

          const finalPlanSource = configManager.getConfig().planSource;
          if (finalPlanSource === 'github') {
            const repo = await promptGitHubRepo(rl, configManager.getConfig().githubRepo);
            configManager.set('githubRepo', repo);

            const hasAnyFilters = Boolean(
              configManager.getConfig().githubLabel ||
                configManager.getConfig().githubMilestone ||
                configManager.getConfig().githubAssignee
            );
            const setFilters = await promptConfirm(
              rl,
              'Configure default GitHub issue filters (label/milestone/assignee)?',
              hasAnyFilters
            );

            if (setFilters) {
              const label = await promptOptionalString(rl, 'GitHub label filter', configManager.getConfig().githubLabel);
              if (label) configManager.set('githubLabel', label);

              const milestone = await promptOptionalString(
                rl,
                'GitHub milestone filter',
                configManager.getConfig().githubMilestone
              );
              if (milestone) configManager.set('githubMilestone', milestone);

              const assignee = await promptOptionalString(
                rl,
                'GitHub assignee filter',
                configManager.getConfig().githubAssignee
              );
              if (assignee) configManager.set('githubAssignee', assignee);
            }
          }

          const finalConfig = configManager.getConfig();
          console.log('');
          console.log(dim('Configuration to write:'));
          console.log(`  ${dim('Plan source:')} ${code(finalConfig.planSource)}`);
          console.log(`  ${dim('Max iterations:')} ${finalConfig.maxIterations}`);
          console.log(`  ${dim('Max tokens:')} ${finalConfig.maxTokens.toLocaleString()}`);
          console.log(`  ${dim('Model:')} ${code(finalConfig.defaultModel)}`);
          console.log(`  ${dim('Auto commit:')} ${finalConfig.autoCommit}`);
          console.log(`  ${dim('Branch prefix:')} ${code(finalConfig.branchPrefix)}`);
          if (finalConfig.planSource === 'github') {
            console.log(`  ${dim('GitHub repo:')} ${code(finalConfig.githubRepo ?? '(not set)')}`);
            if (finalConfig.githubLabel) {
              console.log(`  ${dim('GitHub label:')} ${code(finalConfig.githubLabel)}`);
            }
            if (finalConfig.githubMilestone) {
              console.log(`  ${dim('GitHub milestone:')} ${code(finalConfig.githubMilestone)}`);
            }
            if (finalConfig.githubAssignee) {
              console.log(`  ${dim('GitHub assignee:')} ${code(finalConfig.githubAssignee)}`);
            }
          }
          console.log('');

          const confirmWrite = await promptConfirm(rl, 'Write configuration?', true);
          rl.close();

          if (!confirmWrite) {
            info('Initialization cancelled.');
            return;
          }
        }

        // Initialize local directory and save config
        stateDir = await configManager.initLocal();
      } catch (e) {
        error((e as Error).message);
        process.exit(1);
      }

      // Display configuration
      const config = configManager.getConfig();
      console.log(dim('Configuration:'));
      console.log(`  ${dim('Plan source:')} ${code(config.planSource)}`);
      console.log(`  ${dim('Max iterations:')} ${config.maxIterations}`);
      console.log(`  ${dim('Max tokens:')} ${config.maxTokens.toLocaleString()}`);
      console.log(`  ${dim('Model:')} ${code(config.defaultModel)}`);
      console.log(`  ${dim('Auto commit:')} ${config.autoCommit}`);
      console.log(`  ${dim('Branch prefix:')} ${code(config.branchPrefix)}`);
      if (config.planSource === 'github') {
        console.log(`  ${dim('GitHub repo:')} ${code(config.githubRepo ?? '(not set)')}`);
        if (config.githubLabel) {
          console.log(`  ${dim('GitHub label:')} ${code(config.githubLabel)}`);
        }
        if (config.githubMilestone) {
          console.log(`  ${dim('GitHub milestone:')} ${code(config.githubMilestone)}`);
        }
        if (config.githubAssignee) {
          console.log(`  ${dim('GitHub assignee:')} ${code(config.githubAssignee)}`);
        }
      }
      console.log('');

      if (config.planSource === 'github' && !config.githubRepo) {
        warn('GitHub plan source selected but githubRepo is not configured.');
        info(`Set it with ${code('ghcralph config set githubRepo owner/repo')} (or GHCRALPH_GITHUB_REPO).`);
      }
      console.log(dim('Created:'));
      console.log(`  ${code(stateDir)}`);
      console.log('');

      success('GitHub Copilot Ralph initialized successfully!');
      console.log('');
      info(`Run ${code('ghcralph run --task "Your task"')} to start.`);
    });
}

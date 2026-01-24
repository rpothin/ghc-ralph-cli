/**
 * Run Command
 *
 * Execute an agentic coding loop
 */

import type { Command } from 'commander';
import { info, success, error } from '../utils/index.js';

export interface RunOptions {
  task?: string;
  file?: string;
  maxIterations?: number;
  maxTokens?: number;
  model?: string;
  dryRun?: boolean;
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Execute an agentic coding loop')
    .option('-t, --task <description>', 'Task to execute (inline)')
    .option('-f, --file <path>', 'Read task from file')
    .option('-n, --max-iterations <number>', 'Maximum loop iterations', '10')
    .option('--max-tokens <number>', 'Maximum token budget')
    .option('-m, --model <model>', 'Copilot model to use')
    .option('--dry-run', 'Show what would happen without executing')
    .action(async (options: RunOptions) => {
      if (!options.task && !options.file) {
        error('Please provide a task with --task or --file');
        process.exit(1);
      }

      info(`Starting agentic loop...`);

      if (options.dryRun) {
        info('Dry run mode - no changes will be made');
      }

      // TODO: Implement full run logic in Issue #5
      success('Run command placeholder - full implementation in Issue #5');
    });
}

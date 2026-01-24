/**
 * Init Command
 *
 * Initialize Ralph CLI in a repository
 */

import type { Command } from 'commander';
import { info, success } from '../utils/index.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Ralph in the current repository')
    .option('--force', 'Overwrite existing configuration')
    .action(async (options: { force?: boolean }) => {
      info('Initializing Ralph CLI...');

      // TODO: Implement full initialization in Issue #6
      if (options.force) {
        info('Force mode enabled - will overwrite existing config');
      }

      success('Ralph CLI initialized (placeholder - full implementation in Issue #6)');
    });
}

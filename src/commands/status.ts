/**
 * Status Command
 *
 * Check the current loop status
 */

import type { Command } from 'commander';
import { info, success } from '../utils/index.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check current loop status')
    .option('--json', 'Output in JSON format')
    .action(async (options: { json?: boolean }) => {
      info('Checking Ralph status...');

      // TODO: Implement full status logic
      const status = {
        active: false,
        iteration: 0,
        tokensUsed: 0,
        lastCheckpoint: null,
      };

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        success('No active Ralph session');
      }
    });
}

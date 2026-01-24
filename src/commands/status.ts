/**
 * Status Command
 *
 * Check the current loop status
 */

import fs from 'node:fs/promises';
import type { Command } from 'commander';
import { info, success, heading, dim, code } from '../utils/index.js';
import { ProgressTracker } from '../core/progress-tracker.js';
import { getLocalStateDir } from '../utils/paths.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check current loop status')
    .option('--json', 'Output in JSON format')
    .action(async (options: { json?: boolean }) => {
      const tracker = new ProgressTracker();
      const progressPath = tracker.getProgressFilePath();

      // Check if progress file exists
      let progressContent: string | null = null;
      try {
        progressContent = await fs.readFile(progressPath, 'utf-8');
      } catch {
        // No session
      }

      if (!progressContent) {
        if (options.json) {
          console.log(JSON.stringify({ active: false, message: 'No active session' }));
        } else {
          success('No active Ralph session');
        }
        return;
      }

      if (options.json) {
        // Parse basic info from progress file for JSON output
        const status = {
          active: true,
          progressFile: progressPath,
          stateDir: getLocalStateDir(),
        };
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log('');
        console.log(heading('📊 Ralph Status'));
        console.log('');
        console.log(dim('Progress file:'));
        console.log(`  ${code(progressPath)}`);
        console.log('');
        console.log(dim('Latest progress:'));
        console.log('');
        // Show first 30 lines of progress file
        const lines = progressContent.split('\n').slice(0, 30);
        for (const line of lines) {
          console.log(`  ${line}`);
        }
        if (progressContent.split('\n').length > 30) {
          console.log('');
          info(`... (see full file at ${progressPath})`);
        }
      }
    });
}

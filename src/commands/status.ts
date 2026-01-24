/**
 * Status Command
 *
 * Check the current loop status
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';
import { info, success, heading, dim, code } from '../utils/index.js';
import { ProgressTracker } from '../core/progress-tracker.js';
import { getLocalStateDir } from '../utils/paths.js';

interface FileStatusData {
  createdAt: string;
  files: string[];
  count: number;
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check current loop status')
    .option('--json', 'Output in JSON format')
    .option('--files', 'Show file operations (created, modified, blocked)')
    .action(async (options: { json?: boolean; files?: boolean }) => {
      // Handle --files flag
      if (options.files) {
        await showFileStatus(options.json);
        return;
      }

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

async function showFileStatus(jsonOutput?: boolean): Promise<void> {
  const baselinePath = path.join(process.cwd(), '.ralph', 'baseline-files.json');
  
  let baseline: FileStatusData | null = null;
  try {
    const content = await fs.readFile(baselinePath, 'utf-8');
    baseline = JSON.parse(content) as FileStatusData;
  } catch {
    // No baseline
  }

  if (!baseline) {
    if (jsonOutput) {
      console.log(JSON.stringify({ hasBaseline: false, message: 'No baseline snapshot found' }));
    } else {
      info('No baseline snapshot found. Run a Ralph session to create one.');
    }
    return;
  }

  // Get current git status to find modified/created files
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  const modifiedFiles: string[] = [];
  const createdFiles: string[] = [];

  try {
    const { stdout: statusOut } = await execAsync('git status --porcelain');
    const lines = statusOut.trim().split('\n').filter(Boolean);
    
    for (const line of lines) {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3).trim();
      
      if (status === '??' || status === 'A') {
        // Untracked or added
        if (!baseline.files.includes(file)) {
          createdFiles.push(file);
        }
      } else if (status === 'M' || status === 'MM') {
        modifiedFiles.push(file);
      }
    }
  } catch {
    // Git not available
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      hasBaseline: true,
      baselineCreatedAt: baseline.createdAt,
      baselineFileCount: baseline.count,
      createdFiles,
      modifiedFiles,
    }, null, 2));
  } else {
    console.log('');
    console.log(heading('📁 File Operations'));
    console.log('');
    console.log(`  ${dim('Baseline created:')} ${baseline.createdAt}`);
    console.log(`  ${dim('Baseline files:')} ${baseline.count}`);
    console.log('');
    
    if (createdFiles.length > 0) {
      console.log(dim('  Files created this session:'));
      for (const file of createdFiles.slice(0, 10)) {
        console.log(`    + ${file}`);
      }
      if (createdFiles.length > 10) {
        console.log(`    ${dim(`...and ${createdFiles.length - 10} more`)}`);
      }
      console.log('');
    }
    
    if (modifiedFiles.length > 0) {
      console.log(dim('  Files modified:'));
      for (const file of modifiedFiles.slice(0, 10)) {
        console.log(`    ~ ${file}`);
      }
      if (modifiedFiles.length > 10) {
        console.log(`    ${dim(`...and ${modifiedFiles.length - 10} more`)}`);
      }
      console.log('');
    }
    
    if (createdFiles.length === 0 && modifiedFiles.length === 0) {
      info('No file changes detected since baseline');
    }
  }
}

/**
 * Status Command
 *
 * Check the current loop status with rich session information
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Command } from 'commander';
import { info, success, heading, dim, code, warn } from '../utils/index.js';
import { ProgressTracker } from '../core/progress-tracker.js';
import { getLocalStateDir } from '../utils/paths.js';
import chalk from 'chalk';

const execAsync = promisify(exec);

interface FileStatusData {
  createdAt: string;
  files: string[];
  count: number;
}

interface ParsedSession {
  status: string;
  task: string;
  iteration: number;
  maxIterations: number;
  tokensUsed: number;
  started: string;
  elapsed: string;
  lastCheckpoint?: string;
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check current loop status')
    .option('--json', 'Output in JSON format')
    .option('--files', 'Show file operations (created, modified, blocked)')
    .option('--history', 'Show past Ralph sessions')
    .action(async (options: { json?: boolean; files?: boolean; history?: boolean }) => {
      // Handle --files flag
      if (options.files) {
        await showFileStatus(options.json);
        return;
      }

      // Handle --history flag
      if (options.history) {
        await showHistory(options.json);
        return;
      }

      await showCurrentStatus(options.json);
    });
}

/**
 * Show current session status with rich information
 */
async function showCurrentStatus(jsonOutput?: boolean): Promise<void> {
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
    if (jsonOutput) {
      console.log(JSON.stringify({ active: false, message: 'No active session' }));
    } else {
      console.log('');
      success('No active Ralph session');
      console.log('');
      console.log(dim('  Start a new session with:'));
      console.log(`    ${code('ghcralph run --task "your task description"')}`);
      console.log('');
    }
    return;
  }

  // Parse session info from progress file
  const session = parseProgressFile(progressContent);

  // Get branch info
  let branch = '';
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
    branch = stdout.trim();
  } catch {
    // Not in git repo
  }

  // Get modified files
  const modifiedFiles = await getModifiedFiles();

  if (jsonOutput) {
    console.log(JSON.stringify({
      active: true,
      status: session.status,
      task: session.task,
      branch,
      iteration: session.iteration,
      maxIterations: session.maxIterations,
      tokensUsed: session.tokensUsed,
      started: session.started,
      elapsed: session.elapsed,
      lastCheckpoint: session.lastCheckpoint,
      modifiedFiles,
      progressFile: progressPath,
      stateDir: getLocalStateDir(),
    }, null, 2));
    return;
  }

  // Rich output
  console.log('');
  console.log(heading('📋 Ralph Session Status'));
  console.log(chalk.dim('━'.repeat(40)));
  console.log('');

  // Status indicator
  const statusIcon = getStatusIcon(session.status);
  console.log(`  ${dim('Status:')}      ${statusIcon} ${session.status}`);
  console.log(`  ${dim('Task:')}        ${session.task}`);
  if (branch) {
    console.log(`  ${dim('Branch:')}      ${code(branch)}`);
  }
  console.log(`  ${dim('Started:')}     ${session.started} (${session.elapsed})`);
  console.log('');

  // Progress bar
  const progressPercent = session.maxIterations > 0 ? session.iteration / session.maxIterations : 0;
  const progressBar = createProgressBar(progressPercent, 20);
  console.log(`  ${dim('Progress:')}    ${progressBar} ${session.iteration}/${session.maxIterations} iterations`);
  
  // Token usage
  const tokenDisplay = session.tokensUsed.toLocaleString();
  console.log(`  ${dim('Tokens:')}      ${tokenDisplay} used`);
  console.log('');

  // Modified files
  if (modifiedFiles.length > 0) {
    console.log(dim('  Modified Files:'));
    for (const file of modifiedFiles.slice(0, 6)) {
      const prefix = file.status === 'A' ? chalk.green('+') : 
                     file.status === 'D' ? chalk.red('-') : 
                     chalk.yellow('~');
      console.log(`    ${prefix} ${file.path}`);
    }
    if (modifiedFiles.length > 6) {
      console.log(dim(`    ...and ${modifiedFiles.length - 6} more files`));
    }
    console.log('');
  }

  // Last commit
  if (session.lastCheckpoint) {
    console.log(`  ${dim('Last Commit:')} ${code(session.lastCheckpoint.substring(0, 7))}`);
    console.log('');
  }

  // Helpful tips based on status
  console.log(dim('  💡 Tips:'));
  if (session.status === 'In Progress' || session.status === 'Paused') {
    console.log(dim(`     • Run ${code("ghcralph rollback")} to undo the last iteration`));
    console.log(dim(`     • Run ${code("ghcralph status --files")} to see all file changes`));
  } else if (session.status === 'Completed') {
    console.log(dim(`     • Review changes with ${code("git diff HEAD~" + session.iteration)}`));
    console.log(dim(`     • Create a PR with ${code("gh pr create")}`));
  } else if (session.status === 'Failed') {
    console.log(dim(`     • Check logs: ${code(progressPath)}`));
    console.log(dim(`     • Rollback with ${code("ghcralph rollback --all --force")}`));
  }
  console.log('');
}

/**
 * Parse progress.md file into structured data
 */
function parseProgressFile(content: string): ParsedSession {
  const lines = content.split('\n');
  const session: ParsedSession = {
    status: 'Unknown',
    task: '',
    iteration: 0,
    maxIterations: 0,
    tokensUsed: 0,
    started: '',
    elapsed: '',
  };

  for (const line of lines) {
    if (line.startsWith('- **Started**:')) {
      session.started = line.replace('- **Started**:', '').trim();
    } else if (line.startsWith('- **Task**:')) {
      session.task = line.replace('- **Task**:', '').trim();
    } else if (line.startsWith('- **Status**:')) {
      // Remove status emojis and extract text - just keep alpha characters and spaces
      const statusText = line.replace('- **Status**:', '').trim();
      // Extract just the text portion after any emoji
      session.status = statusText.replace(/^[^\w]+/, '').trim() || statusText;
    } else if (line.startsWith('- **Iterations**:')) {
      const match = line.match(/(\d+)\/(\d+)/);
      if (match && match[1] && match[2]) {
        session.iteration = parseInt(match[1], 10);
        session.maxIterations = parseInt(match[2], 10);
      }
    } else if (line.startsWith('- **Tokens Used**:')) {
      session.tokensUsed = parseInt(line.replace('- **Tokens Used**:', '').replace(/,/g, '').trim(), 10) || 0;
    } else if (line.startsWith('- **Elapsed**:')) {
      session.elapsed = line.replace('- **Elapsed**:', '').trim();
    } else if (line.startsWith('- **Last Checkpoint**:')) {
      session.lastCheckpoint = line.replace('- **Last Checkpoint**:', '').replace(/`/g, '').trim();
    }
  }

  return session;
}

/**
 * Get status icon
 */
function getStatusIcon(status: string): string {
  if (status.includes('Progress')) return '🟢';
  if (status.includes('Complete')) return '✅';
  if (status.includes('Failed')) return '🔴';
  if (status.includes('Paused')) return '🟡';
  if (status.includes('Stopped')) return '⏹️';
  return '❓';
}

/**
 * Create a progress bar
 */
function createProgressBar(percent: number, width: number): string {
  const filled = Math.round(percent * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

/**
 * Get modified files from git
 */
async function getModifiedFiles(): Promise<Array<{ path: string; status: string }>> {
  const files: Array<{ path: string; status: string }> = [];
  
  try {
    const { stdout } = await execAsync('git status --porcelain');
    const lines = stdout.trim().split('\n').filter(Boolean);
    
    for (const line of lines) {
      const status = line.substring(0, 2).trim();
      const filePath = line.substring(3).trim();
      files.push({ path: filePath, status: status.charAt(0) || 'M' });
    }
  } catch {
    // Git not available
  }
  
  return files;
}

/**
 * Show past Ralph sessions from git log
 */
async function showHistory(jsonOutput?: boolean): Promise<void> {
  try {
    // Find Ralph commits
    const { stdout } = await execAsync('git --no-pager log --oneline --grep="ghcralph:" -n 50');
    const lines = stdout.trim().split('\n').filter(Boolean);
    
    if (lines.length === 0) {
      if (jsonOutput) {
        console.log(JSON.stringify({ sessions: [] }));
      } else {
        info('No past Ralph sessions found in git history');
      }
      return;
    }

    // Group by session (consecutive ralph commits with same prefix)
    const sessions: Array<{ hash: string; message: string; date: string }> = [];
    
    for (const line of lines) {
      const [hash, ...msgParts] = line.split(' ');
      if (hash) {
        sessions.push({ hash, message: msgParts.join(' '), date: '' });
      }
    }

    // Get dates for commits
    for (const session of sessions) {
      try {
        const { stdout: dateOut } = await execAsync(`git --no-pager log -1 --format=%ai ${session.hash}`);
        session.date = dateOut.trim().substring(0, 16); // YYYY-MM-DD HH:MM
      } catch {
        session.date = 'unknown';
      }
    }

    if (jsonOutput) {
      console.log(JSON.stringify({ sessions }, null, 2));
      return;
    }

    console.log('');
    console.log(heading('📜 Past Ralph Sessions'));
    console.log(chalk.dim('━'.repeat(40)));
    console.log('');

    // Group into sessions by detecting gaps
    let lastIteration = 0;
    
    for (let i = 0; i < Math.min(sessions.length, 20); i++) {
      const sessionItem = sessions[i];
      if (!sessionItem) continue;
      
      const match = sessionItem.message.match(/iteration (\d+)/);
      const iteration = match?.[1] ? parseInt(match[1], 10) : 0;
      
      // Detect new session (iteration resets or non-consecutive)
      if (i > 0 && (iteration >= lastIteration || Math.abs(iteration - lastIteration) > 1)) {
        console.log('');
      }
      lastIteration = iteration;
      
      console.log(`  ${dim(sessionItem.date)} ${code(sessionItem.hash.substring(0, 7))} ${sessionItem.message}`);
    }
    
    if (sessions.length > 20) {
      console.log('');
      console.log(dim(`  ...and ${sessions.length - 20} more commits`));
    }
    
    console.log('');
    console.log(dim('  💡 Use "ghcralph rollback --to <hash>" to restore to a specific commit'));
    console.log('');
  } catch {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: 'Failed to get git history' }));
    } else {
      warn('Failed to get git history');
    }
  }
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

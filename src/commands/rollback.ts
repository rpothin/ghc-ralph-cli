/**
 * Rollback Command
 *
 * Revert to a previous checkpoint
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Command } from 'commander';
import { info, success, warn, error, dim, heading, code } from '../utils/index.js';

const execAsync = promisify(exec);

interface RollbackOptions {
  to?: string;
  iterations?: string;
  all?: boolean;
  list?: boolean;
  force?: boolean;
}

/**
 * Get recent Ralph commits
 */
async function getRalphCommits(limit: number = 10): Promise<Array<{ hash: string; message: string; date: string }>> {
  try {
    const { stdout } = await execAsync(`git log --oneline --format="%H|%s|%ar" -n ${limit} 2>/dev/null`);
    const lines = stdout.trim().split('\n').filter(Boolean);
    
    const commits = lines
      .map(line => {
        const [hash, message, date] = line.split('|');
        return { hash: hash ?? '', message: message ?? '', date: date ?? '' };
      })
      .filter(c => c.message.startsWith('ghcralph:'));
    
    return commits;
  } catch {
    return [];
  }
}

/**
 * Get files changed in a commit
 */
async function getCommitFiles(hash: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`git diff-tree --no-commit-id --name-only -r ${hash} 2>/dev/null`);
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get the initial commit before Ralph session
 */
async function getPreSessionCommit(): Promise<string | null> {
  try {
    // Find the first Ralph commit and get its parent
    const { stdout } = await execAsync('git log --oneline --format="%H|%s" 2>/dev/null');
    const lines = stdout.trim().split('\n').filter(Boolean);
    
    let firstRalphCommit: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const [hash, message] = lines[i]?.split('|') ?? [];
      if (message?.startsWith('ghcralph:')) {
        firstRalphCommit = hash ?? null;
      } else if (firstRalphCommit) {
        // Found the first non-Ralph commit after Ralph commits
        return hash ?? null;
      }
    }
    
    // If we found Ralph commits but no parent, try to get the parent of first Ralph commit
    if (firstRalphCommit) {
      try {
        const { stdout: parentHash } = await execAsync(`git rev-parse "${firstRalphCommit}^" 2>/dev/null`);
        return parentHash.trim();
      } catch {
        return null;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export function registerRollbackCommand(program: Command): void {
  program
    .command('rollback')
    .description('Revert to a previous checkpoint')
    .option('--to <commit>', 'Specific commit hash to rollback to')
    .option('--iterations <n>', 'Number of iterations to undo')
    .option('--all', 'Undo entire Ralph session')
    .option('--list', 'List available checkpoints')
    .option('--force', 'Skip confirmation prompt')
    .addHelpText('after', `
Examples:
  $ ghcralph rollback                    # Undo last iteration
  $ ghcralph rollback --iterations 3     # Undo last 3 iterations
  $ ghcralph rollback --to abc1234       # Rollback to specific commit
  $ ghcralph rollback --all --force      # Reset to pre-session state
  $ ghcralph rollback --list             # Show available checkpoints

Safety:
  - All rollback operations require --force flag
  - Preview shows files that will be affected
  - Original state can be recovered from git reflog

See also:
  ghcralph status    View current progress
  ghcralph run       Start a new coding loop
`)
    .action(async (options: RollbackOptions) => {
      // List checkpoints
      if (options.list) {
        console.log(heading('📋 Ralph Checkpoints'));
        console.log('');
        
        const commits = await getRalphCommits(20);
        
        if (commits.length === 0) {
          info('No Ralph checkpoints found');
          return;
        }
        
        for (const commit of commits) {
          console.log(`  ${code(commit.hash.substring(0, 7))} ${commit.message} ${dim(`(${commit.date})`)}`);
        }
        
        console.log('');
        info(`Use ${code('ghcralph rollback --to <hash>')} to rollback to a specific checkpoint`);
        return;
      }

      // Rollback all
      if (options.all) {
        const preSession = await getPreSessionCommit();
        
        if (!preSession) {
          error('Could not find pre-session commit');
          return;
        }
        
        const commits = await getRalphCommits(100);
        
        console.log('');
        warn(`This will reset to the state before the Ralph session started.`);
        console.log(`  ${dim('Target:')} ${code(preSession.substring(0, 7))}`);
        console.log(`  ${dim('Iterations to undo:')} ${commits.length}`);
        console.log('');
        
        if (!options.force) {
          warn('Use --force to confirm this destructive operation');
          return;
        }
        
        try {
          await execAsync(`git reset --hard "${preSession}"`);
          success(`Reset to pre-session state (${preSession.substring(0, 7)})`);
        } catch (err) {
          error(`Failed to rollback: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }

      // Rollback to specific commit
      if (options.to) {
        const files = await getCommitFiles(options.to);
        
        console.log('');
        console.log(`Rolling back to commit ${code(options.to.substring(0, 7))}`);
        if (files.length > 0) {
          console.log(`  ${dim('Files affected:')} ${files.length}`);
          for (const file of files.slice(0, 5)) {
            console.log(`    - ${file}`);
          }
          if (files.length > 5) {
            console.log(`    ${dim(`...and ${files.length - 5} more`)}`);
          }
        }
        console.log('');
        
        if (!options.force) {
          warn('Use --force to confirm this operation');
          return;
        }
        
        try {
          await execAsync(`git reset --hard "${options.to}"`);
          success(`Rolled back to ${options.to.substring(0, 7)}`);
        } catch (err) {
          error(`Failed to rollback: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }

      // Rollback N iterations
      const iterations = options.iterations ? parseInt(options.iterations, 10) : 1;
      const commits = await getRalphCommits(iterations + 1);
      
      if (commits.length < iterations) {
        error(`Only ${commits.length} Ralph iterations found, cannot rollback ${iterations}`);
        return;
      }
      
      // Find the commit to reset to (one before the iterations we're undoing)
      const targetIndex = iterations;
      const targetCommit = commits[targetIndex];
      
      if (!targetCommit) {
        // Need to find parent of oldest Ralph commit being undone
        const lastUndone = commits[iterations - 1];
        if (!lastUndone) {
          error('Could not determine rollback target');
          return;
        }
        
        try {
          const { stdout } = await execAsync(`git rev-parse "${lastUndone.hash}^" 2>/dev/null`);
          const parentHash = stdout.trim();
          
          console.log('');
          console.log(`Rolling back ${iterations} iteration(s)`);
          console.log(`  ${dim('Target:')} ${code(parentHash.substring(0, 7))}`);
          console.log('');
          
          if (!options.force) {
            warn('Use --force to confirm this operation');
            return;
          }
          
          await execAsync(`git reset --hard "${parentHash}"`);
          success(`Rolled back ${iterations} iteration(s)`);
        } catch (err) {
          error(`Failed to rollback: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }
      
      console.log('');
      console.log(`Rolling back ${iterations} iteration(s)`);
      console.log(`  ${dim('Target:')} ${code(targetCommit.hash.substring(0, 7))} - ${targetCommit.message}`);
      console.log('');
      
      if (!options.force) {
        warn('Use --force to confirm this operation');
        return;
      }
      
      try {
        await execAsync(`git reset --hard "${targetCommit.hash}"`);
        success(`Rolled back to iteration ${commits.length - iterations}`);
      } catch (err) {
        error(`Failed to rollback: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}


/**
 * Run Command
 *
 * Execute an agentic coding loop
 */

import fs from 'node:fs/promises';
import type { Command } from 'commander';
import { info, success, error, warn, debug, spinner, heading, code, dim } from '../utils/index.js';
import { CopilotAgent } from '../integrations/index.js';
import {
  LoopEngine,
  LocalMarkdownPlan,
  GitHubPlan,
  ProgressTracker,
  GitBranchManager,
  CheckpointManager,
  type PlanManager,
} from '../core/index.js';
import type { Task } from '../types/index.js';

export interface RunOptions {
  task?: string;
  file?: string;
  plan?: string;
  github?: string;
  label?: string;
  milestone?: string;
  assignee?: string;
  context?: string[];
  branch?: string;
  force?: boolean;
  noCommit?: boolean;
  maxIterations: string;
  maxTokens?: string;
  model?: string;
  dryRun?: boolean;
}

/**
 * Format elapsed time as human-readable string
 */
function formatElapsedTime(startTime: Date): string {
  const elapsed = Date.now() - startTime.getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Read task content from a file
 */
async function readTaskFromFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.trim();
  } catch {
    throw new Error(`Failed to read task file: ${filePath}`);
  }
}

/**
 * Create a task object from options
 */
async function createTask(options: RunOptions): Promise<Task> {
  let content: string;
  let title: string;

  if (options.file) {
    content = await readTaskFromFile(options.file);
    title = options.file;
  } else if (options.task) {
    content = options.task;
    title = options.task.substring(0, 50) + (options.task.length > 50 ? '...' : '');
  } else {
    throw new Error('No task provided');
  }

  return {
    id: `task-${Date.now()}`,
    title,
    content,
    status: 'pending',
    source: options.file ? 'local' : 'local',
  };
}

/**
 * Handle graceful shutdown on Ctrl+C
 */
function setupSignalHandlers(engine: LoopEngine): void {
  let shutdownRequested = false;

  const handler = (): void => {
    if (shutdownRequested) {
      warn('Force quit - exiting immediately');
      process.exit(1);
    }

    shutdownRequested = true;
    warn('Shutdown requested - completing current iteration...');
    engine.stop();
  };

  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Execute an agentic coding loop')
    .option('-t, --task <description>', 'Task to execute (inline)')
    .option('-f, --file <path>', 'Read task from file')
    .option('-p, --plan <path>', 'Read tasks from a Markdown plan file')
    .option('-g, --github <owner/repo>', 'Use GitHub Issues as plan source')
    .option('-l, --label <label>', 'Filter GitHub issues by label')
    .option('--milestone <name>', 'Filter GitHub issues by milestone')
    .option('--assignee <user>', 'Filter GitHub issues by assignee')
    .option('-c, --context <glob...>', 'Include files matching glob patterns in context')
    .option('-b, --branch <name>', 'Use or create a specific branch name')
    .option('--force', 'Skip branch confirmation prompts')
    .option('--no-commit', 'Disable automatic checkpoint commits')
    .option('-n, --max-iterations <number>', 'Maximum loop iterations', '10')
    .option('--max-tokens <number>', 'Maximum token budget', '100000')
    .option('-m, --model <model>', 'Copilot model to use', 'gpt-4')
    .option('--dry-run', 'Show what would happen without executing')
    .action(async (options: RunOptions) => {
      if (!options.task && !options.file && !options.plan && !options.github) {
        error('Please provide a task with --task, --file, --plan, or --github');
        process.exit(1);
      }

      const maxIterations = parseInt(options.maxIterations, 10);
      const maxTokens = options.maxTokens ? parseInt(options.maxTokens, 10) : 100000;

      // Create task - either from options or from plan source
      let task: Task;
      let planManager: PlanManager | null = null;

      try {
        if (options.github) {
          // Parse owner/repo
          const parts = options.github.split('/');
          if (parts.length !== 2) {
            error('GitHub repository must be in format: owner/repo');
            process.exit(1);
          }
          const [owner, repo] = parts;
          if (!owner || !repo) {
            error('GitHub repository must be in format: owner/repo');
            process.exit(1);
          }

          // Load task from GitHub Issues
          const ghConfig: {
            owner: string;
            repo: string;
            label?: string;
            milestone?: string;
            assignee?: string;
          } = {
            owner,
            repo,
          };
          if (options.label) ghConfig.label = options.label;
          if (options.milestone) ghConfig.milestone = options.milestone;
          if (options.assignee) ghConfig.assignee = options.assignee;

          planManager = new GitHubPlan(ghConfig);
          await planManager.initialize();
          const nextTask = await planManager.getNextTask();
          if (!nextTask) {
            success('No pending issues found!');
            return;
          }
          task = nextTask;
          await planManager.startTask(task.id);
          info(`Selected issue from GitHub: ${task.title}`);
        } else if (options.plan) {
          // Load task from Markdown plan file
          planManager = new LocalMarkdownPlan(options.plan);
          await planManager.initialize();
          const nextTask = await planManager.getNextTask();
          if (!nextTask) {
            success('All tasks in the plan are complete!');
            return;
          }
          task = nextTask;
          info(`Selected task from plan: ${task.title}`);
        } else {
          task = await createTask(options);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      // Show configuration
      console.log('');
      console.log(heading('🤖 Ralph CLI - Run'));
      console.log('');
      if (options.github) {
        console.log(`  ${dim('Source:')} GitHub Issues (${code(options.github)})`);
        if (options.label) {
          console.log(`  ${dim('Label filter:')} ${code(options.label)}`);
        }
      } else if (options.plan) {
        console.log(`  ${dim('Plan:')} ${code(options.plan)}`);
      }
      console.log(`  ${dim('Task:')} ${task.title}`);
      console.log(`  ${dim('Model:')} ${code(options.model ?? 'gpt-4')}`);
      console.log(`  ${dim('Max iterations:')} ${maxIterations}`);
      console.log(`  ${dim('Max tokens:')} ${maxTokens.toLocaleString()}`);

      if (options.dryRun) {
        console.log('');
        warn('Dry run mode - no changes will be made');
        console.log('');
        console.log(dim('Task content:'));
        console.log(task.content);
        console.log('');
        success('Dry run complete - no actions taken');
        return;
      }

      console.log('');

      // Setup git branch isolation
      const gitManager = new GitBranchManager();
      const isGitRepo = await gitManager.isGitRepository();
      let branchInfo: { branchName: string; created: boolean; originalBranch: string } | null = null;

      if (isGitRepo) {
        // Check working directory status
        const workingDirStatus = await gitManager.getWorkingDirStatus();
        
        if (!workingDirStatus.isClean && !options.force) {
          warn(`Working directory has ${workingDirStatus.modifiedFiles} modified files and ${workingDirStatus.untrackedFiles} untracked files`);
          info('Use --force to proceed anyway, or commit/stash your changes first');
          
          // Offer to stash changes
          if (!options.dryRun) {
            const stashed = await gitManager.stashChanges();
            if (stashed) {
              info('Changes stashed automatically');
            }
          }
        }

        // Prepare branch for operation
        const currentBranch = await gitManager.getCurrentBranch();
        
        if (currentBranch.isMain) {
          // On main/master - auto-create a new Ralph branch
          const branchOptions: { branch?: string; force?: boolean } = {};
          if (options.branch) branchOptions.branch = options.branch;
          if (options.force) branchOptions.force = options.force;
          
          branchInfo = await gitManager.prepareForOperation(task.title, task.id, branchOptions);
          
          if (branchInfo.created) {
            success(`Created and switched to branch '${branchInfo.branchName}'`);
          } else {
            info(`Using existing branch '${branchInfo.branchName}'`);
          }
        } else if (!currentBranch.isRalphBranch && !options.force) {
          // On a non-main, non-Ralph branch - warn but proceed
          warn(`You're on branch '${currentBranch.name}' (not main/master)`);
          info(`Use --force to skip this warning, or --branch to specify a branch`);
          branchInfo = { branchName: currentBranch.name, created: false, originalBranch: currentBranch.name };
        } else {
          branchInfo = { branchName: currentBranch.name, created: false, originalBranch: currentBranch.name };
          debug(`Using current branch: ${currentBranch.name}`);
        }
        
        console.log(`  ${dim('Branch:')} ${code(branchInfo.branchName)}`);
      }

      // Create agent and engine with context configuration
      const agent = new CopilotAgent({
        model: options.model ?? 'gpt-4',
        maxTokensPerRequest: 4096,
      });

      // Build context config, only including contextGlobs if provided
      const contextConfig: {
        contextGlobs?: string[];
        includeGitDiff: boolean;
        includeGitHistory: boolean;
        includeProjectStructure: boolean;
      } = {
        includeGitDiff: true,
        includeGitHistory: true,
        includeProjectStructure: true,
      };
      if (options.context) {
        contextConfig.contextGlobs = options.context;
      }

      const engine = new LoopEngine(agent, {
        maxIterations,
        maxTokens,
        contextConfig,
      });

      // Create progress tracker
      const progressTracker = new ProgressTracker(undefined, maxIterations);

      // Create checkpoint manager for auto-commits
      const checkpointManager = new CheckpointManager({
        autoCommit: options.noCommit !== true,
      });

      // Setup signal handlers for graceful shutdown
      setupSignalHandlers(engine);

      // Setup event listeners
      const events = engine.getEvents();
      const startTime = new Date();

      events.on('iterationStart', (iteration, state) => {
        debug(
          `Iteration ${iteration}/${maxIterations} - Tokens: ${state.tokensUsed.toLocaleString()}`
        );
      });

      events.on('iterationEnd', (record, state) => {
        const status = record.success ? '✓' : '✗';
        info(
          `Iteration ${record.iteration}: ${status} (${record.tokensUsed.toLocaleString()} tokens)`
        );
        if (record.summary) {
          console.log(`  ${dim(record.summary)}`);
        }
        
        // Create checkpoint commit after successful iterations
        if (record.success && checkpointManager.isAutoCommitEnabled()) {
          checkpointManager
            .createCheckpoint(record.iteration, record.summary ?? 'iteration complete', record.tokensUsed)
            .then((checkpoint) => {
              if (checkpoint) {
                debug(`Checkpoint created: ${checkpoint.commitHash.substring(0, 7)}`);
                // Update progress with commit hash
                state.lastCheckpoint = checkpoint.commitHash;
              }
            })
            .catch(() => {
              // Ignore checkpoint errors
            });
        }
        
        // Save progress after each iteration
        progressTracker.save(state).catch(() => {
          // Ignore save errors
        });
      });

      events.on('error', (err) => {
        error(`Loop error: ${err.message}`);
      });

      // Run the loop
      const loopSpinner = spinner('Running agentic loop...');
      loopSpinner.start();

      try {
        const finalState = await engine.start(task);

        loopSpinner.stop();
        console.log('');

        // Print summary
        console.log(heading('📊 Summary'));
        console.log('');
        console.log(`  ${dim('Status:')} ${finalState.status}`);
        console.log(`  ${dim('Iterations:')} ${finalState.iteration}/${maxIterations}`);
        console.log(`  ${dim('Tokens used:')} ${finalState.tokensUsed.toLocaleString()}`);
        console.log(`  ${dim('Elapsed time:')} ${formatElapsedTime(startTime)}`);

        const successfulIterations = finalState.iterations.filter((i) => i.success).length;
        console.log(`  ${dim('Successful iterations:')} ${successfulIterations}`);

        console.log('');

        if (finalState.status === 'completed') {
          // Mark task as complete in plan file if using a plan
          if (planManager) {
            await planManager.completeTask(task.id);
            info(`Task marked as complete in plan file`);
          }
          success('Loop completed successfully');
        } else if (finalState.status === 'stopped') {
          warn('Loop was stopped by user');
        } else if (finalState.status === 'failed') {
          if (planManager) {
            await planManager.failTask(task.id);
          }
          error('Loop failed');
          process.exit(1);
        }
      } catch (err) {
        loopSpinner.fail('Loop failed');
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

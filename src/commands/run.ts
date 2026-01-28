/**
 * Run Command
 *
 * Execute an agentic coding loop
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { Command } from 'commander';
import { info, success, error, warn, debug, spinner, heading, code, dim, parseNonNegativeInt } from '../utils/index.js';
import { waitForKeypress } from '../utils/shell.js';
import { CopilotAgent } from '../integrations/index.js';
import {
  LoopEngine,
  LocalMarkdownPlan,
  GitHubPlan,
  ProgressTracker,
  GitBranchManager,
  CheckpointManager,
  FileSafeguardManager,
  ConfigManager,
  createInitialState,
  type PlanManager,
  type TaskContext,
  type FullLoopState,
} from '../core/index.js';
import type { Task } from '../types/index.js';

export interface RunOptions {
  task?: string;
  file?: string;
  github?: boolean;
  context?: string[];
  branch?: string;
  force?: boolean;
  unlimited?: boolean;
  timeout?: string;
  allowDelete?: boolean;
  dryRun?: boolean;
  pauseBetweenTasks?: boolean;
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

function looksLikeMarkdownPlan(content: string): boolean {
  return /^\s*-\s*\[[ xX]\]\s+.+$/m.test(content);
}

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
function setupSignalHandlers(engine: LoopEngine): () => void {
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

  return () => {
    process.off('SIGINT', handler);
    process.off('SIGTERM', handler);
  };
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Execute an agentic coding loop')
    .option('-t, --task <description>', 'Task to execute (inline)')
    .option('-f, --file <path>', 'Read task (or Markdown plan) from file')
    .option('-g, --github', 'Use GitHub Issues as plan source (configured via .ghcralph/config.json)')
    .option('-c, --context <glob...>', 'Include files matching glob patterns in context')
    .option('-b, --branch <name>', 'Use or create a specific branch name')
    .option('--force', 'Skip branch confirmation prompts')
    .option('--unlimited', 'Allow more than 50 iterations')
    .option('--timeout <minutes>', 'Maximum duration in minutes')
    .option('--allow-delete', 'Allow deletion of pre-existing files')
    .option('--dry-run', 'Show what would happen without executing')
    .option('--pause-between-tasks', 'Pause for human review after each task (strict Ralph mode)')
    .addHelpText('after', `
Config-backed settings (set via .ghcralph/config.json or GHCRALPH_* env vars):
  - maxIterations, maxTokens, defaultModel, autoCommit, branchPrefix
  - githubRepo (+ optional filters: githubLabel, githubMilestone, githubAssignee)

Examples:
  $ ghcralph run --task "Add input validation to the login form"
  $ ghcralph run --file tasks/refactor.md
  $ ghcralph run --file TODO.md
  $ ghcralph run --github
  $ ghcralph run --task "Fix bug" --context "src/**/*.ts" --branch fix/login-bug
  $ ghcralph run --task "Large refactor" --unlimited --timeout 60

See also:
  ghcralph status     View current session progress
  ghcralph rollback   Undo recent changes
  ghcralph init       Initialize Ralph in your project
`)
    .action(async (options: RunOptions) => {
      if (!options.task && !options.file && !options.github) {
        error('Please provide a task with --task, --file, or --github');
        process.exit(1);
      }

      const gitRoot = getGitRoot();
      const configManager = new ConfigManager(gitRoot ?? undefined);
      const config = await configManager.load();

      const maxIterations = config.maxIterations;
      const maxTokens = config.maxTokens;
      const model = config.defaultModel;

      let maxDurationMinutes = 0;
      if (options.timeout) {
        const timeoutResult = parseNonNegativeInt(options.timeout, 'timeout');
        if (!timeoutResult.valid) {
          error(timeoutResult.error ?? 'Invalid timeout value');
          process.exit(1);
        }
        if (timeoutResult.value === undefined) {
          error(timeoutResult.error ?? 'Invalid timeout value');
          process.exit(1);
        }
        maxDurationMinutes = timeoutResult.value;
      }

      // Validate iteration limit
      if (maxIterations > 50 && !options.unlimited) {
        error('More than 50 iterations requires --unlimited flag');
        process.exit(1);
      }

      let githubRepo: string | undefined;
      let githubLabel: string | undefined;
      let githubMilestone: string | undefined;
      let githubAssignee: string | undefined;

      if (options.github) {
        githubRepo = config.githubRepo;
        if (!githubRepo) {
          error(
            'Missing GitHub repository. Set githubRepo in .ghcralph/config.json (or GHCRALPH_GITHUB_REPO)'
          );
          process.exit(1);
        }

        githubLabel = config.githubLabel;
        githubMilestone = config.githubMilestone;
        githubAssignee = config.githubAssignee;
      }

      // Create task - either from options or from plan source
      let task: Task;
      let planManager: PlanManager | null = null;
      let planFilePath: string | undefined;

      try {
        if (githubRepo) {
          // Parse owner/repo
          const parts = githubRepo.split('/');
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
          if (githubLabel) ghConfig.label = githubLabel;
          if (githubMilestone) ghConfig.milestone = githubMilestone;
          if (githubAssignee) ghConfig.assignee = githubAssignee;

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
        } else {
          const fileArg = options.file;

          if (fileArg) {
            const content = await readTaskFromFile(fileArg);
            const ext = path.extname(fileArg).toLowerCase();
            const isMarkdown = ext === '.md' || ext === '.markdown';

            if (isMarkdown && looksLikeMarkdownPlan(content)) {
              planManager = new LocalMarkdownPlan(fileArg);
              planFilePath = fileArg;
              await planManager.initialize();
              const nextTask = await planManager.getNextTask();
              if (!nextTask) {
                success('All tasks in the plan are complete!');
                return;
              }
              task = nextTask;
              info(`Selected task from plan: ${task.title}`);
            } else {
              task = {
                id: `task-${Date.now()}`,
                title: fileArg,
                content,
                status: 'pending',
                source: 'local',
              };
            }
          } else {
            task = await createTask(options);
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      // Show configuration
      console.log('');
      console.log(heading('🤖 GitHub Copilot Ralph - Run'));
      console.log('');
      if (githubRepo) {
        console.log(`  ${dim('Source:')} GitHub Issues (${code(githubRepo)})`);
        if (githubLabel) {
          console.log(`  ${dim('Label filter:')} ${code(githubLabel)}`);
        }
        if (githubMilestone) {
          console.log(`  ${dim('Milestone filter:')} ${code(githubMilestone)}`);
        }
        if (githubAssignee) {
          console.log(`  ${dim('Assignee filter:')} ${code(githubAssignee)}`);
        }
      } else if (planFilePath) {
        console.log(`  ${dim('Plan:')} ${code(planFilePath)}`);
      }
      console.log(`  ${dim('Task:')} ${task.title}`);
      console.log(`  ${dim('Model:')} ${code(model)}`);
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
      const gitManager = new GitBranchManager({ branchPrefix: config.branchPrefix });
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

      // Create progress tracker with verbosity setting
      const progressVerbosity = config.progressVerbosity ?? 'standard';
      const progressTracker = new ProgressTracker(undefined, maxIterations, progressVerbosity);

      // Create checkpoint manager for auto-commits
      const checkpointManager = new CheckpointManager({
        autoCommit: config.autoCommit,
      });

      // Create file safeguard manager
      const fileSafeguard = new FileSafeguardManager({
        allowDeleteExisting: options.allowDelete === true,
      });
      await fileSafeguard.initialize();

      const startTime = new Date();
      let exitCode = 0;
      let totalTasksProcessed = 0;
      let totalTasksCompleted = 0;
      let totalTasksFailed = 0;
      const maxRetriesPerTask = config.maxRetriesPerTask ?? 2;
      const autoPush = config.autoPush ?? false;
      const pushStrategy = config.pushStrategy ?? 'per-task';

      // Compute total tasks count for commit message context (if available)
      let totalTasksInPlan = 0;
      if (planManager) {
        try {
          const allTasks = await planManager.getTasks();
          totalTasksInPlan = allTasks.length;
        } catch {
          // Fall back to unknown total if getTasks fails
          totalTasksInPlan = 0;
        }
      }

      // Initialize progress session for multi-task tracking
      progressTracker.startSession(branchInfo?.branchName, totalTasksInPlan || undefined);

      // ========== MULTI-TASK ITERATION LOOP ==========
      // This is the core fix: process ALL tasks in the plan, not just the first one
      
      let currentTask: Task | null = task;
      
      while (currentTask) {
        // Capture task in a const for this iteration (helps TypeScript narrowing)
        const activeTask: Task = currentTask;
        
        totalTasksProcessed++;
        let taskAttempt = 0;
        let taskCompleted = false;
        let taskFailed = false;
        
        info(`\n📋 Task ${totalTasksProcessed}: ${activeTask.title}`);
        
        // Retry loop for the current task (with fresh agent per attempt)
        while (!taskCompleted && !taskFailed && taskAttempt < maxRetriesPerTask) {
          taskAttempt++;
          
          if (taskAttempt > 1) {
            info(`\n🔄 Retry ${taskAttempt}/${maxRetriesPerTask} for task: ${activeTask.title}`);
          }
          
          // Create FRESH agent instance for each attempt (Ralph pattern core principle)
          const agent = new CopilotAgent({
            model,
            maxTokensPerRequest: 4096,
          });

          const engine = new LoopEngine(agent, {
            maxIterations,
            maxTokens,
            maxDurationMinutes,
            allowUnlimited: options.unlimited === true,
            contextConfig,
          });

          // Setup signal handlers for graceful shutdown
          const cleanupSignalHandlers = setupSignalHandlers(engine);

          // Setup event listeners
          const events = engine.getEvents();

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
              // Build task context for commit message if we have plan info
              const taskContext: TaskContext | undefined = totalTasksInPlan > 0
                ? { taskNumber: totalTasksProcessed, totalTasks: totalTasksInPlan }
                : undefined;
              
              checkpointManager
                .createCheckpoint(record.iteration, record.summary ?? 'iteration complete', record.tokensUsed, taskContext)
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
            
            // Update in-memory progress state (file written at task completion)
            progressTracker.setCurrentTask(totalTasksProcessed, state);
          });

          events.on('error', (err) => {
            error(`Loop error: ${err.message}`);
          });

          events.on('warning', (type, message) => {
            warn(`Warning: ${message}`);
          });

          // Run the loop for this task
          const loopSpinner = spinner('Running agentic loop...');
          loopSpinner.start();

          try {
            const finalState = await engine.start(activeTask);

            loopSpinner.stop();
            console.log('');

            // Print iteration summary
            console.log(`  ${dim('Status:')} ${finalState.status}`);
            console.log(`  ${dim('Iterations:')} ${finalState.iteration}/${maxIterations}`);
            console.log(`  ${dim('Tokens used:')} ${finalState.tokensUsed.toLocaleString()}`);

            const successfulIterations = finalState.iterations.filter((i) => i.success).length;
            console.log(`  ${dim('Successful iterations:')} ${successfulIterations}`);
            console.log('');

            if (finalState.status === 'completed') {
              taskCompleted = true;
              
              // Mark task as complete in plan file if using a plan
              if (planManager) {
                await planManager.completeTask(activeTask.id);
                info(`Task marked as complete in plan file`);
              }
              
              // Document result in progress file using session-based tracking
              await progressTracker.recordTaskCompletion(
                finalState,
                'completed',
                taskAttempt,
                `Completed in ${finalState.iteration} iterations`
              );
              
              // Build task context for commit message if we have plan info
              const taskContext: TaskContext | undefined = totalTasksInPlan > 0
                ? { taskNumber: totalTasksProcessed, totalTasks: totalTasksInPlan }
                : undefined;
              
              // Create a task-level checkpoint commit
              await checkpointManager.createTaskCheckpoint(
                activeTask.title,
                activeTask.id,
                `Task completed in ${finalState.iteration} iterations`,
                taskContext
              );
              
              // Push to remote if configured (per-task strategy)
              if (autoPush && pushStrategy === 'per-task' && isGitRepo) {
                info('Pushing changes to remote...');
                const pushed = await gitManager.pushToRemote();
                if (pushed) {
                  success('Changes pushed to remote');
                } else {
                  warn('Failed to push changes to remote');
                }
              }
              
              success(`✓ Task completed: ${activeTask.title}`);
              totalTasksCompleted++;
              
            } else if (finalState.status === 'stopped') {
              // User requested stop - exit the entire run
              warn('Loop was stopped by user');
              
              // Document the stop using session-based tracking
              await progressTracker.recordTaskCompletion(
                finalState,
                'stuck',
                taskAttempt,
                'Stopped by user'
              );
              
              // Exit the multi-task loop
              currentTask = null;
              continue;
              
            } else if (finalState.status === 'failed') {
              warn(`✗ Task attempt ${taskAttempt} failed: ${activeTask.title}`);
              
              // Document failure for learning using session-based tracking
              await progressTracker.recordTaskCompletion(
                finalState,
                'failed',
                taskAttempt,
                'Loop execution failed'
              );
              
              // Create failure checkpoint
              await checkpointManager.createFailureCheckpoint(
                activeTask.title,
                activeTask.id,
                taskAttempt,
                'Loop execution failed'
              );
            }
          } catch (err) {
            loopSpinner.fail('Loop failed');
            const errMsg = err instanceof Error ? err.message : String(err);
            error(errMsg);
            
            // Document failure using session-based tracking with minimal error state
            const errorState: FullLoopState = {
              ...createInitialState(activeTask),
              status: 'failed',
              endedAt: new Date(),
            };
            await progressTracker.recordTaskCompletion(
              errorState,
              'failed',
              taskAttempt,
              undefined,
              errMsg
            );
            
            // Create failure checkpoint
            await checkpointManager.createFailureCheckpoint(
              activeTask.title,
              activeTask.id,
              taskAttempt,
              errMsg
            );
          } finally {
            cleanupSignalHandlers();
            await agent.destroy();
          }
        }
        
        // Check if all retries exhausted without completion
        if (!taskCompleted && currentTask) {
          taskFailed = true;
          totalTasksFailed++;
          
          if (planManager) {
            await planManager.failTask(activeTask.id);
          }
          
          error(`❌ Task failed after ${maxRetriesPerTask} attempts: ${activeTask.title}`);
          exitCode = 1;
        }
        
        // Optional pause for human review (strict Ralph mode)
        if (options.pauseBetweenTasks && planManager && !taskFailed) {
          console.log('');
          info('Press any key to continue to next task, or Ctrl+C to stop...');
          await waitForKeypress();
        }
        
        // Get next task from the plan (if using a plan)
        if (planManager) {
          // Reload plan file to pick up any external changes
          await planManager.reload?.();
          currentTask = await planManager.getNextTask();
        } else {
          // Single task mode (--task flag) - exit after one task
          currentTask = null;
        }
      }
      
      // ========== FINAL SUMMARY ==========
      console.log('');
      console.log(heading('📊 Final Summary'));
      console.log('');
      console.log(`  ${dim('Total tasks processed:')} ${totalTasksProcessed}`);
      console.log(`  ${dim('Tasks completed:')} ${totalTasksCompleted}`);
      console.log(`  ${dim('Tasks failed:')} ${totalTasksFailed}`);
      console.log(`  ${dim('Elapsed time:')} ${formatElapsedTime(startTime)}`);
      console.log('');
      
      // Push to remote if configured (per-run strategy)
      if (autoPush && pushStrategy === 'per-run' && isGitRepo && totalTasksCompleted > 0) {
        info('Pushing all changes to remote...');
        const pushed = await gitManager.pushToRemote();
        if (pushed) {
          success('All changes pushed to remote');
        } else {
          warn('Failed to push changes to remote');
        }
      }
      
      // Show informational message when push is disabled but changes were made
      if (!autoPush && isGitRepo && totalTasksCompleted > 0) {
        console.log('');
        info('💡 Changes committed locally. Review and push manually with: git push');
        info('   To enable auto-push, set "autoPush": true in .ghcralph/config.json');
      }
      
      if (totalTasksFailed === 0 && totalTasksCompleted > 0) {
        success(`🎉 All ${totalTasksCompleted} tasks completed successfully!`);
      } else if (totalTasksCompleted > 0) {
        warn(`Completed ${totalTasksCompleted} tasks, ${totalTasksFailed} failed`);
      } else if (totalTasksProcessed === 0) {
        success('No pending tasks found - all tasks are complete!');
      }

      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

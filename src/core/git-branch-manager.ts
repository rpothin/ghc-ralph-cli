/**
 * Git Branch Manager
 *
 * Manages git branch isolation for safe Ralph operations
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { debug, warn } from '../utils/index.js';

const execAsync = promisify(exec);

/**
 * Git branch manager configuration
 */
export interface GitBranchConfig {
  /** Prefix for Ralph branches (default: 'ralph/') */
  branchPrefix: string;
  /** Whether to auto-create branches without prompting */
  autoCreate: boolean;
  /** Working directory */
  cwd: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: GitBranchConfig = {
  branchPrefix: 'ralph/',
  autoCreate: true,
  cwd: process.cwd(),
};

/**
 * Working directory status
 */
export interface WorkingDirStatus {
  /** Whether the working directory is clean */
  isClean: boolean;
  /** Number of modified files */
  modifiedFiles: number;
  /** Number of untracked files */
  untrackedFiles: number;
}

/**
 * Branch info
 */
export interface BranchInfo {
  /** Current branch name */
  name: string;
  /** Whether this is a main/master branch */
  isMain: boolean;
  /** Whether this is a Ralph branch */
  isRalphBranch: boolean;
}

/**
 * Git Branch Manager class
 */
export class GitBranchManager {
  private config: GitBranchConfig;

  constructor(config: Partial<GitBranchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if we're in a git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.config.cwd });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current branch information
   */
  async getCurrentBranch(): Promise<BranchInfo> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: this.config.cwd });
      const name = stdout.trim();
      
      return {
        name,
        isMain: name === 'main' || name === 'master',
        isRalphBranch: name.startsWith(this.config.branchPrefix),
      };
    } catch (err) {
      throw new Error('Failed to get current branch: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * Get working directory status
   */
  async getWorkingDirStatus(): Promise<WorkingDirStatus> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.config.cwd });
      const lines = stdout.trim().split('\n').filter(Boolean);
      
      let modifiedFiles = 0;
      let untrackedFiles = 0;
      
      for (const line of lines) {
        if (line.startsWith('??')) {
          untrackedFiles++;
        } else {
          modifiedFiles++;
        }
      }
      
      return {
        isClean: lines.length === 0,
        modifiedFiles,
        untrackedFiles,
      };
    } catch {
      return { isClean: true, modifiedFiles: 0, untrackedFiles: 0 };
    }
  }

  /**
   * Stash current changes
   */
  async stashChanges(message?: string): Promise<boolean> {
    try {
      const stashMessage = message ?? `ralph: auto-stash at ${new Date().toISOString()}`;
      await execAsync(`git stash push -m "${stashMessage}"`, { cwd: this.config.cwd });
      debug(`Stashed changes: ${stashMessage}`);
      return true;
    } catch {
      warn('Failed to stash changes');
      return false;
    }
  }

  /**
   * Pop stashed changes
   */
  async popStash(): Promise<boolean> {
    try {
      await execAsync('git stash pop', { cwd: this.config.cwd });
      return true;
    } catch {
      warn('Failed to pop stash');
      return false;
    }
  }

  /**
   * Generate a branch name from task info
   */
  generateBranchName(taskTitle: string, taskId?: string): string {
    // Create a slug from the task title
    const slug = taskTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30);
    
    // Add timestamp for uniqueness
    const timestamp = new Date().toISOString().split('T')[0]?.replace(/-/g, '') ?? '';
    
    // Use task ID if available, otherwise use slug
    const identifier = taskId 
      ? taskId.replace(/[^a-z0-9-]/gi, '-')
      : slug;
    
    return `${this.config.branchPrefix}${identifier}-${timestamp}`;
  }

  /**
   * Create and switch to a new Ralph branch
   */
  async createAndSwitchBranch(branchName: string): Promise<boolean> {
    try {
      // Create and checkout the new branch
      await execAsync(`git checkout -b "${branchName}"`, { cwd: this.config.cwd });
      debug(`Created and switched to branch: ${branchName}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to create branch: ${message}`);
    }
  }

  /**
   * Switch to an existing branch
   */
  async switchBranch(branchName: string): Promise<boolean> {
    try {
      await execAsync(`git checkout "${branchName}"`, { cwd: this.config.cwd });
      debug(`Switched to branch: ${branchName}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to switch branch: ${message}`);
    }
  }

  /**
   * Check if a branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      await execAsync(`git rev-parse --verify "${branchName}"`, { cwd: this.config.cwd });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the default branch (main/master)
   */
  async getDefaultBranch(): Promise<string> {
    // Try to get from remote
    try {
      const { stdout } = await execAsync('git symbolic-ref refs/remotes/origin/HEAD', { cwd: this.config.cwd });
      const ref = stdout.trim();
      return ref.replace('refs/remotes/origin/', '');
    } catch {
      // Fallback: check if main or master exists
      if (await this.branchExists('main')) {
        return 'main';
      }
      if (await this.branchExists('master')) {
        return 'master';
      }
      return 'main'; // Default
    }
  }

  /**
   * Merge a Ralph branch back to the original branch
   */
  async mergeBranch(sourceBranch: string, targetBranch: string): Promise<boolean> {
    try {
      // Switch to target branch
      await execAsync(`git checkout "${targetBranch}"`, { cwd: this.config.cwd });
      
      // Merge source branch
      await execAsync(`git merge --no-ff "${sourceBranch}" -m "Merge ${sourceBranch} into ${targetBranch}"`, { cwd: this.config.cwd });
      
      debug(`Merged ${sourceBranch} into ${targetBranch}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to merge branches: ${message}`);
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<boolean> {
    try {
      const flag = force ? '-D' : '-d';
      await execAsync(`git branch ${flag} "${branchName}"`, { cwd: this.config.cwd });
      debug(`Deleted branch: ${branchName}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warn(`Failed to delete branch: ${message}`);
      return false;
    }
  }

  /**
   * Get the list of Ralph branches
   */
  async listRalphBranches(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git branch --list "${this.config.branchPrefix}*"`, { cwd: this.config.cwd });
      return stdout
        .trim()
        .split('\n')
        .map(b => b.trim().replace(/^\*\s*/, ''))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Prepare the branch for a Ralph operation
   * Returns the branch name to use
   */
  async prepareForOperation(
    taskTitle: string,
    taskId?: string,
    options: {
      branch?: string;
      force?: boolean;
    } = {}
  ): Promise<{ branchName: string; created: boolean; originalBranch: string }> {
    const currentBranch = await this.getCurrentBranch();
    const originalBranch = currentBranch.name;

    // If custom branch name provided, use it
    if (options.branch) {
      const exists = await this.branchExists(options.branch);
      if (exists) {
        await this.switchBranch(options.branch);
        return { branchName: options.branch, created: false, originalBranch };
      } else {
        await this.createAndSwitchBranch(options.branch);
        return { branchName: options.branch, created: true, originalBranch };
      }
    }

    // Already on a Ralph branch
    if (currentBranch.isRalphBranch) {
      return { branchName: currentBranch.name, created: false, originalBranch };
    }

    // On main/master - auto-create a new Ralph branch
    if (currentBranch.isMain || this.config.autoCreate || options.force) {
      const branchName = this.generateBranchName(taskTitle, taskId);
      await this.createAndSwitchBranch(branchName);
      return { branchName, created: true, originalBranch };
    }

    // On a different branch - just use it (caller should have confirmed)
    return { branchName: currentBranch.name, created: false, originalBranch };
  }

  /**
   * Get the latest commit hash
   */
  async getLatestCommitHash(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.config.cwd });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get the commit count on current branch
   */
  async getCommitCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('git rev-list --count HEAD', { cwd: this.config.cwd });
      return parseInt(stdout.trim(), 10);
    } catch {
      return 0;
    }
  }
}

/**
 * Create a git branch manager with configuration
 */
export function createGitBranchManager(config?: Partial<GitBranchConfig>): GitBranchManager {
  return new GitBranchManager(config);
}

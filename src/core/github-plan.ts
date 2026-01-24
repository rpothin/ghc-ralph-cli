/**
 * GitHub Issues Plan Source
 *
 * Implementation of PlanManager for GitHub Issues
 */

import { Octokit } from '@octokit/rest';
import type { Task } from '../types/index.js';
import type { PlanManager, TaskFilter, PlanSourceType } from './plan-manager.js';
import { getGitHubAuth } from '../integrations/auth.js';
import { debug, info, warn } from '../utils/output.js';

/**
 * GitHub Issue data
 */
interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
}

/**
 * GitHub plan configuration
 */
export interface GitHubPlanConfig {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Label to filter issues */
  label?: string;
  /** Milestone to filter issues */
  milestone?: string;
  /** Assignee to filter issues */
  assignee?: string;
  /** Label to add when starting work */
  inProgressLabel?: string;
  /** Whether to add progress comments */
  addComments?: boolean;
}

/**
 * GitHub Issues Plan implementation
 */
export class GitHubPlan implements PlanManager {
  readonly sourceType: PlanSourceType = 'github';
  private config: GitHubPlanConfig;
  private octokit: Octokit | null = null;
  private issues: GitHubIssue[] = [];
  private currentUser: string | null = null;

  constructor(config: GitHubPlanConfig) {
    this.config = {
      inProgressLabel: 'in-progress',
      addComments: true,
      ...config,
    };
  }

  /**
   * Initialize by authenticating and loading issues
   */
  async initialize(): Promise<void> {
    debug(`Initializing GitHub plan for ${this.config.owner}/${this.config.repo}`);

    // Get authentication
    const auth = getGitHubAuth();
    if (!auth.authenticated || !auth.token) {
      throw new Error('GitHub authentication required. Run "gh auth login" or set GITHUB_TOKEN.');
    }

    this.octokit = new Octokit({ auth: auth.token });

    // Get current user
    try {
      const { data: user } = await this.octokit.users.getAuthenticated();
      this.currentUser = user.login;
      debug(`Authenticated as ${this.currentUser}`);
    } catch {
      warn('Could not determine current user');
    }

    // Load issues
    await this.loadIssues();
  }

  /**
   * Load issues from GitHub
   */
  private async loadIssues(): Promise<void> {
    if (!this.octokit) {
      throw new Error('Not initialized. Call initialize() first.');
    }

    const { owner, repo, label, milestone, assignee } = this.config;

    const params: Parameters<Octokit['issues']['listForRepo']>[0] = {
      owner,
      repo,
      state: 'open',
      per_page: 100,
    };

    if (label) {
      params.labels = label;
    }

    if (assignee) {
      params.assignee = assignee;
    }

    if (milestone) {
      // Need to get milestone number from name
      const milestones = await this.octokit.issues.listMilestones({
        owner,
        repo,
        state: 'open',
      });
      const found = milestones.data.find((m) => m.title === milestone);
      if (found) {
        params.milestone = String(found.number);
      } else {
        warn(`Milestone "${milestone}" not found`);
      }
    }

    const { data } = await this.octokit.issues.listForRepo(params);

    // Filter out pull requests (they show up in issues API)
    this.issues = data
      .filter((issue) => !('pull_request' in issue))
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: issue.state as 'open' | 'closed',
        labels: (issue.labels as Array<{ name: string }>).filter(
          (l): l is { name: string } => typeof l === 'object' && 'name' in l
        ),
        assignees: issue.assignees?.map((a) => ({ login: a.login })) ?? [],
      }));

    info(`Loaded ${this.issues.length} issues from ${owner}/${repo}`);
  }

  /**
   * Convert GitHub issue to Task
   */
  private toTask(issue: GitHubIssue): Task {
    const hasInProgressLabel = issue.labels.some((l) => l.name === this.config.inProgressLabel);

    return {
      id: `github-${issue.number}`,
      title: issue.title,
      content: issue.body ?? issue.title,
      status: hasInProgressLabel ? 'in-progress' : 'pending',
      source: 'github',
    };
  }

  /**
   * Get all tasks, optionally filtered
   */
  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    let tasks = this.issues.map((i) => this.toTask(i));

    if (filter?.status && filter.status !== 'all') {
      tasks = tasks.filter((t) => t.status === filter.status);
    }

    if (filter?.limit && filter.limit > 0) {
      tasks = tasks.slice(0, filter.limit);
    }

    return tasks;
  }

  /**
   * Get the next pending task
   */
  async getNextTask(): Promise<Task | null> {
    // Prioritize issues already in-progress, then oldest pending
    const inProgress = this.issues.find((i) =>
      i.labels.some((l) => l.name === this.config.inProgressLabel)
    );

    if (inProgress) {
      return this.toTask(inProgress);
    }

    const pending = this.issues.find(
      (i) => !i.labels.some((l) => l.name === this.config.inProgressLabel)
    );

    return pending ? this.toTask(pending) : null;
  }

  /**
   * Get a specific task by ID
   */
  async getTask(id: string): Promise<Task | null> {
    const issueNumber = this.parseIssueNumber(id);
    if (!issueNumber) return null;

    const issue = this.issues.find((i) => i.number === issueNumber);
    return issue ? this.toTask(issue) : null;
  }

  /**
   * Mark a task as in-progress
   */
  async startTask(id: string): Promise<void> {
    if (!this.octokit) {
      throw new Error('Not initialized');
    }

    const issueNumber = this.parseIssueNumber(id);
    if (!issueNumber) return;

    const { owner, repo, inProgressLabel } = this.config;

    // Add in-progress label
    if (inProgressLabel) {
      try {
        await this.octokit.issues.addLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels: [inProgressLabel],
        });
        debug(`Added label "${inProgressLabel}" to issue #${issueNumber}`);
      } catch {
        warn(`Could not add label "${inProgressLabel}" to issue #${issueNumber}`);
      }
    }

    // Assign current user
    if (this.currentUser) {
      try {
        await this.octokit.issues.addAssignees({
          owner,
          repo,
          issue_number: issueNumber,
          assignees: [this.currentUser],
        });
        debug(`Assigned ${this.currentUser} to issue #${issueNumber}`);
      } catch {
        warn(`Could not assign ${this.currentUser} to issue #${issueNumber}`);
      }
    }

    // Add start comment
    if (this.config.addComments) {
      try {
        await this.octokit.issues.createComment({
          owner,
          repo,
          issue_number: issueNumber,
          body: `🤖 **Ralph CLI** started working on this issue.\n\nTimestamp: ${new Date().toISOString()}`,
        });
      } catch {
        warn(`Could not add comment to issue #${issueNumber}`);
      }
    }
  }

  /**
   * Mark a task as completed
   */
  async completeTask(id: string): Promise<void> {
    if (!this.octokit) {
      throw new Error('Not initialized');
    }

    const issueNumber = this.parseIssueNumber(id);
    if (!issueNumber) return;

    const { owner, repo, inProgressLabel } = this.config;

    // Remove in-progress label
    if (inProgressLabel) {
      try {
        await this.octokit.issues.removeLabel({
          owner,
          repo,
          issue_number: issueNumber,
          name: inProgressLabel,
        });
      } catch {
        // Label might not exist
      }
    }

    // Add completion comment
    if (this.config.addComments) {
      try {
        await this.octokit.issues.createComment({
          owner,
          repo,
          issue_number: issueNumber,
          body: `✅ **Ralph CLI** completed this task.\n\nTimestamp: ${new Date().toISOString()}`,
        });
      } catch {
        warn(`Could not add comment to issue #${issueNumber}`);
      }
    }

    // Close the issue
    try {
      await this.octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        state: 'closed',
      });
      info(`Closed issue #${issueNumber}`);
    } catch {
      warn(`Could not close issue #${issueNumber}`);
    }
  }

  /**
   * Mark a task as failed
   */
  async failTask(id: string, errorMessage?: string): Promise<void> {
    if (!this.octokit) {
      throw new Error('Not initialized');
    }

    const issueNumber = this.parseIssueNumber(id);
    if (!issueNumber) return;

    const { owner, repo, inProgressLabel } = this.config;

    // Remove in-progress label
    if (inProgressLabel) {
      try {
        await this.octokit.issues.removeLabel({
          owner,
          repo,
          issue_number: issueNumber,
          name: inProgressLabel,
        });
      } catch {
        // Label might not exist
      }
    }

    // Add failure comment
    if (this.config.addComments) {
      const body = errorMessage
        ? `❌ **Ralph CLI** failed on this task.\n\nError: ${errorMessage}\n\nTimestamp: ${new Date().toISOString()}`
        : `❌ **Ralph CLI** failed on this task.\n\nTimestamp: ${new Date().toISOString()}`;

      try {
        await this.octokit.issues.createComment({
          owner,
          repo,
          issue_number: issueNumber,
          body,
        });
      } catch {
        warn(`Could not add comment to issue #${issueNumber}`);
      }
    }
  }

  /**
   * Update task progress
   */
  async updateProgress(id: string, progress: string): Promise<void> {
    if (!this.octokit || !this.config.addComments) return;

    const issueNumber = this.parseIssueNumber(id);
    if (!issueNumber) return;

    const { owner, repo } = this.config;

    try {
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `🔄 **Ralph CLI** progress update:\n\n${progress}\n\nTimestamp: ${new Date().toISOString()}`,
      });
    } catch {
      warn(`Could not add progress comment to issue #${issueNumber}`);
    }
  }

  /**
   * Parse issue number from task ID
   */
  private parseIssueNumber(id: string): number | null {
    const match = id.match(/^github-(\d+)$/);
    return match ? parseInt(match[1] ?? '0', 10) : null;
  }

  /**
   * Reload issues from GitHub
   */
  async reload(): Promise<void> {
    await this.loadIssues();
  }
}

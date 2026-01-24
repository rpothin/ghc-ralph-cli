/**
 * Local Markdown Plan Source
 *
 * Implementation of PlanManager for local Markdown files
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Task } from '../types/index.js';
import type { PlanManager, TaskFilter, PlanSourceType } from './plan-manager.js';
import {
  parseMarkdownPlan,
  toTask,
  updateTaskCheckbox,
  type ParsedMarkdownPlan,
} from './markdown-parser.js';
import { debug, info } from '../utils/output.js';

/**
 * Local Markdown Plan implementation
 */
export class LocalMarkdownPlan implements PlanManager {
  readonly sourceType: PlanSourceType = 'local';
  private filePath: string;
  private plan: ParsedMarkdownPlan | null = null;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  /**
   * Get the plan file path
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Initialize by loading and parsing the Markdown file
   */
  async initialize(): Promise<void> {
    debug(`Loading plan from ${this.filePath}`);

    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.plan = parseMarkdownPlan(content);
      info(`Loaded ${this.plan.tasks.length} tasks from ${path.basename(this.filePath)}`);
    } catch {
      throw new Error(`Failed to load plan file: ${this.filePath}`);
    }
  }

  /**
   * Get all tasks, optionally filtered
   */
  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    if (!this.plan) {
      throw new Error('Plan not initialized. Call initialize() first.');
    }

    let tasks = this.plan.tasks.map((t) => toTask(t));

    // Apply filters
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
    if (!this.plan) {
      throw new Error('Plan not initialized. Call initialize() first.');
    }

    // Find first uncompleted task (top-level first)
    const pendingTasks = this.plan.tasks.filter((t) => !t.completed && t.indentLevel === 0);

    if (pendingTasks.length === 0) {
      // If no top-level pending tasks, check nested ones
      const nestedPending = this.plan.tasks.find((t) => !t.completed);
      if (nestedPending) {
        return toTask(nestedPending);
      }
      return null;
    }

    const firstPending = pendingTasks[0];
    return firstPending ? toTask(firstPending) : null;
  }

  /**
   * Get a specific task by ID
   */
  async getTask(id: string): Promise<Task | null> {
    if (!this.plan) {
      throw new Error('Plan not initialized. Call initialize() first.');
    }

    const task = this.plan.tasks.find((t) => t.id === id);
    return task ? toTask(task) : null;
  }

  /**
   * Mark a task as in-progress
   */
  async startTask(id: string): Promise<void> {
    if (!this.plan) {
      throw new Error('Plan not initialized. Call initialize() first.');
    }

    // For local Markdown, we don't modify the file for in-progress status
    // We could add a marker like "- [~]" but that's not standard Markdown
    debug(`Task ${id} marked as in-progress`);
  }

  /**
   * Mark a task as completed
   */
  async completeTask(id: string): Promise<void> {
    await this.updateTaskStatus(id, true);
  }

  /**
   * Mark a task as failed
   */
  async failTask(id: string, _error?: string): Promise<void> {
    // For failed tasks, we don't check the box - leave it unchecked
    debug(`Task ${id} failed`);
  }

  /**
   * Update task progress
   */
  async updateProgress(id: string, progress: string): Promise<void> {
    debug(`Task ${id} progress: ${progress}`);
    // Progress updates are logged but not written to the Markdown file
  }

  /**
   * Update task checkbox in the file
   */
  private async updateTaskStatus(id: string, completed: boolean): Promise<void> {
    if (!this.plan) {
      throw new Error('Plan not initialized. Call initialize() first.');
    }

    const task = this.plan.tasks.find((t) => t.id === id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    // Update the raw content
    const updatedContent = updateTaskCheckbox(this.plan.rawContent, task.lineNumber, completed);

    // Write back to file
    await fs.writeFile(this.filePath, updatedContent, 'utf-8');

    // Update in-memory state
    task.completed = completed;
    this.plan.rawContent = updatedContent;

    debug(`Task ${id} checkbox updated to ${completed ? 'checked' : 'unchecked'}`);
  }

  /**
   * Get all sub-tasks of a parent task
   */
  async getSubTasks(parentId: string): Promise<Task[]> {
    if (!this.plan) {
      throw new Error('Plan not initialized. Call initialize() first.');
    }

    return this.plan.tasks.filter((t) => t.parentId === parentId).map((t) => toTask(t));
  }

  /**
   * Reload the plan from disk
   */
  async reload(): Promise<void> {
    await this.initialize();
  }
}

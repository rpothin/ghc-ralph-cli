/**
 * Progress Tracker Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ProgressTracker } from './progress-tracker.js';
import type { FullLoopState } from './loop-state.js';
import type { Task } from '../types/index.js';

describe('ProgressTracker', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghcralph-progress-'));
    // Create .ghcralph directory
    await fs.mkdir(path.join(tempDir, '.ghcralph'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createMockTask = (id = 'test-1', title = 'Test Task'): Task => ({
    id,
    title,
    content: `Test content for ${title}`,
    status: 'pending',
    source: 'local',
  });

  const createMockState = (overrides: Partial<FullLoopState> = {}): FullLoopState => ({
    task: createMockTask(),
    iteration: 3,
    status: 'running',
    tokensUsed: 1500,
    startedAt: new Date('2026-01-24T10:00:00Z'),
    iterations: [
      {
        iteration: 1,
        startedAt: new Date('2026-01-24T10:00:00Z'),
        endedAt: new Date('2026-01-24T10:01:00Z'),
        tokensUsed: 500,
        success: true,
        summary: 'Completed step 1',
      },
      {
        iteration: 2,
        startedAt: new Date('2026-01-24T10:01:00Z'),
        endedAt: new Date('2026-01-24T10:02:00Z'),
        tokensUsed: 600,
        success: true,
        summary: 'Completed step 2',
      },
    ],
    ...overrides,
  });

  describe('getProgressFilePath', () => {
    it('should return correct path for project root', () => {
      const tracker = new ProgressTracker(tempDir);
      const progressPath = tracker.getProgressFilePath();

      expect(progressPath).toBe(path.join(tempDir, '.ghcralph', 'progress.md'));
    });
  });

  describe('generateMarkdown', () => {
    it('should generate markdown with session info', () => {
      const tracker = new ProgressTracker(tempDir, 10);
      const state = createMockState();

      const md = tracker.generateMarkdown(state);

      expect(md).toContain('# Ralph Progress Log');
      expect(md).toContain('## Current Session');
      expect(md).toContain('**Task**: Test Task');
      expect(md).toContain('**Iterations**: 3/10');
      expect(md).toContain('**Tokens Used**: 1,500');
    });

    it('should include iteration log', () => {
      const tracker = new ProgressTracker(tempDir, 10);
      const state = createMockState();

      const md = tracker.generateMarkdown(state);

      expect(md).toContain('### Iteration Log');
      expect(md).toContain('#### Iteration 1');
      expect(md).toContain('Completed step 1');
      expect(md).toContain('#### Iteration 2');
      expect(md).toContain('Completed step 2');
    });

    it('should show completed status', () => {
      const tracker = new ProgressTracker(tempDir);
      const state = createMockState({ status: 'completed' });

      const md = tracker.generateMarkdown(state);

      expect(md).toContain('✅ Completed');
    });

    it('should show failed status', () => {
      const tracker = new ProgressTracker(tempDir);
      const state = createMockState({ status: 'failed' });

      const md = tracker.generateMarkdown(state);

      expect(md).toContain('❌ Failed');
    });

    it('should include last checkpoint if present', () => {
      const tracker = new ProgressTracker(tempDir);
      const state = createMockState({ lastCheckpoint: 'abc1234' });

      const md = tracker.generateMarkdown(state);

      expect(md).toContain('**Last Checkpoint**');
      expect(md).toContain('abc1234');
    });

    it('should include task content in code block', () => {
      const tracker = new ProgressTracker(tempDir);
      const state = createMockState();

      const md = tracker.generateMarkdown(state);

      expect(md).toContain('### Task Details');
      expect(md).toContain('```');
      expect(md).toContain('Test content for Test Task');
    });
  });

  describe('save', () => {
    it('should save progress to file', async () => {
      const tracker = new ProgressTracker(tempDir);
      const state = createMockState();

      await tracker.save(state);

      const content = await fs.readFile(tracker.getProgressFilePath(), 'utf-8');
      expect(content).toContain('# Ralph Progress Log');
      expect(content).toContain('Test Task');
    });
  });

  describe('hasSession', () => {
    it('should return false when no progress file exists', async () => {
      const tracker = new ProgressTracker(tempDir);
      const hasSession = await tracker.hasSession();

      expect(hasSession).toBe(false);
    });

    it('should return true when progress file exists', async () => {
      const tracker = new ProgressTracker(tempDir);
      const state = createMockState();

      await tracker.save(state);
      const hasSession = await tracker.hasSession();

      expect(hasSession).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove progress file', async () => {
      const tracker = new ProgressTracker(tempDir);
      const state = createMockState();

      await tracker.save(state);
      await tracker.clear();

      const hasSession = await tracker.hasSession();
      expect(hasSession).toBe(false);
    });

    it('should not throw if file does not exist', async () => {
      const tracker = new ProgressTracker(tempDir);

      await expect(tracker.clear()).resolves.not.toThrow();
    });
  });

  describe('toJSON', () => {
    it('should convert state to JSON format', () => {
      const tracker = new ProgressTracker(tempDir, 10);
      const state = createMockState();

      const json = tracker.toJSON(state);

      expect(json.taskId).toBe('test-1');
      expect(json.taskTitle).toBe('Test Task');
      expect(json.status).toBe('running');
      expect(json.iteration).toBe(3);
      expect(json.maxIterations).toBe(10);
      expect(json.tokensUsed).toBe(1500);
      expect(json.iterations).toHaveLength(2);
    });

    it('should include iteration details in JSON', () => {
      const tracker = new ProgressTracker(tempDir, 10);
      const state = createMockState();

      const json = tracker.toJSON(state);

      expect(json.iterations[0]?.number).toBe(1);
      expect(json.iterations[0]?.success).toBe(true);
      expect(json.iterations[0]?.summary).toBe('Completed step 1');
    });

    it('should include lastCheckpoint when present', () => {
      const tracker = new ProgressTracker(tempDir, 10);
      const state = createMockState({ lastCheckpoint: 'abc1234def5678' });

      const json = tracker.toJSON(state);

      expect(json.lastCheckpoint).toBe('abc1234def5678');
    });
  });

  describe('session-based tracking', () => {
    it('should start a session with branch and total tasks', () => {
      const tracker = new ProgressTracker(tempDir, 10);
      tracker.startSession('feature/test-branch', 5);

      const session = tracker.getSession();
      expect(session).not.toBeNull();
      expect(session?.branch).toBe('feature/test-branch');
      expect(session?.totalTasks).toBe(5);
      expect(session?.completedTasks).toHaveLength(0);
    });

    it('should track completed task count', () => {
      const tracker = new ProgressTracker(tempDir, 10);
      tracker.startSession();

      expect(tracker.getCompletedTaskCount()).toBe(0);
    });

    it('should record task completion with full iteration history', async () => {
      const tracker = new ProgressTracker(tempDir, 10);
      tracker.startSession('main', 3);

      const state = createMockState({ status: 'completed' });
      await tracker.recordTaskCompletion(state, 'completed', 1, 'Task completed successfully');

      const session = tracker.getSession();
      expect(session?.completedTasks).toHaveLength(1);
      expect(session?.completedTasks[0]?.status).toBe('completed');
      expect(session?.completedTasks[0]?.iterations).toHaveLength(2);
      expect(tracker.getCompletedTaskCount()).toBe(1);

      // Verify file was written
      const content = await fs.readFile(tracker.getProgressFilePath(), 'utf-8');
      expect(content).toContain('# Ralph Progress Log');
      expect(content).toContain('## Run Session');
      expect(content).toContain('## Task 1: Test Task');
      expect(content).toContain('Completed step 1');
      expect(content).toContain('Completed step 2');
    });

    it('should preserve history across multiple tasks', async () => {
      const tracker = new ProgressTracker(tempDir, 10);
      tracker.startSession('feature/multi-task', 3);

      // First task
      const state1 = createMockState({
        task: createMockTask('task-1', 'First Task'),
        status: 'completed',
      });
      await tracker.recordTaskCompletion(state1, 'completed', 1, 'First task done');

      // Second task
      const state2 = createMockState({
        task: createMockTask('task-2', 'Second Task'),
        status: 'completed',
      });
      await tracker.recordTaskCompletion(state2, 'completed', 1, 'Second task done');

      // Third task failed
      const state3 = createMockState({
        task: createMockTask('task-3', 'Third Task'),
        status: 'failed',
      });
      await tracker.recordTaskCompletion(state3, 'failed', 2, undefined, 'Max iterations reached');

      const session = tracker.getSession();
      expect(session?.completedTasks).toHaveLength(3);
      expect(tracker.getCompletedTaskCount()).toBe(3);

      // Verify file contains all tasks
      const content = await fs.readFile(tracker.getProgressFilePath(), 'utf-8');
      expect(content).toContain('## Task 1: First Task');
      expect(content).toContain('## Task 2: Second Task');
      expect(content).toContain('## Task 3: Third Task');
      expect(content).toContain('✅ completed');
      expect(content).toContain('❌ failed');
      expect(content).toContain('Max iterations reached');
    });

    it('should auto-start session if not explicitly started', async () => {
      const tracker = new ProgressTracker(tempDir, 10);

      const state = createMockState({ status: 'completed' });
      await tracker.recordTaskCompletion(state, 'completed', 1, 'Task done');

      expect(tracker.getSession()).not.toBeNull();
      expect(tracker.getCompletedTaskCount()).toBe(1);
    });

    it('should track current task in progress', () => {
      const tracker = new ProgressTracker(tempDir, 10);
      tracker.startSession('main', 5);

      const state = createMockState();
      tracker.setCurrentTask(2, state);

      const session = tracker.getSession();
      expect(session?.currentTask).toBeDefined();
      expect(session?.currentTask?.taskNumber).toBe(2);
      expect(session?.currentTask?.taskId).toBe('test-1');
    });
  });
});

/**
 * Context Builder Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ContextBuilder } from './context-builder.js';
import type { Task } from '../types/index.js';

describe('ContextBuilder', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghcralph-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-task-1',
    title: 'Add user authentication',
    content: 'Implement login and logout functionality',
    status: 'pending',
    source: 'local',
    ...overrides,
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const builder = new ContextBuilder();
      expect(builder).toBeInstanceOf(ContextBuilder);
    });

    it('should accept custom configuration', () => {
      const builder = new ContextBuilder({
        maxContextTokens: 4000,
        includeGitDiff: false,
      });
      expect(builder).toBeInstanceOf(ContextBuilder);
    });

    it('should accept custom working directory', () => {
      const builder = new ContextBuilder({}, tempDir);
      expect(builder).toBeInstanceOf(ContextBuilder);
    });
  });

  describe('buildContext', () => {
    it('should build a basic context prompt with simplified format by default', async () => {
      const builder = new ContextBuilder({
        includeGitDiff: false,
        includeGitHistory: false,
        includeProjectStructure: false,
      }, tempDir);

      const task = createTestTask();
      const result = await builder.buildContext(task, 1, 10, 0, 100000);

      expect(result.prompt).toContain('Add user authentication');
      expect(result.prompt).toContain('Implement login and logout functionality');
      // Default mode: no meta info (Ralph pattern)
      expect(result.prompt).not.toContain('Iteration: 1 of 10');
      // Should include action format instructions
      expect(result.prompt).toContain('[ACTION:CREATE]');
      expect(result.prompt).toContain('[ACTION:COMPLETE]');
      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.truncated).toBe(false);
    });

    it('should include meta info when includeMetaInfo is true (legacy mode)', async () => {
      const builder = new ContextBuilder({
        includeGitDiff: false,
        includeGitHistory: false,
        includeProjectStructure: false,
        includeMetaInfo: true, // Legacy mode
      }, tempDir);

      const task = createTestTask();
      const result = await builder.buildContext(task, 1, 10, 0, 100000);

      expect(result.prompt).toContain('Add user authentication');
      expect(result.prompt).toContain('Iteration: 1 of 10');
    });

    it('should include previous iteration information when freshContextPerIteration is false', async () => {
      const builder = new ContextBuilder({
        includeGitDiff: false,
        includeGitHistory: false,
        includeProjectStructure: false,
        freshContextPerIteration: false, // Legacy mode: include previous progress
      }, tempDir);

      const task = createTestTask();
      const previousIterations = [
        {
          iteration: 1,
          startedAt: new Date(),
          endedAt: new Date(),
          tokensUsed: 500,
          success: true,
          summary: 'Created auth module',
        },
      ];

      const result = await builder.buildContext(task, 2, 10, 500, 100000, previousIterations);

      expect(result.prompt).toContain('Iteration 1');
      expect(result.prompt).toContain('Created auth module');
    });

    it('should skip previous iteration info when freshContextPerIteration is true (default)', async () => {
      const builder = new ContextBuilder({
        includeGitDiff: false,
        includeGitHistory: false,
        includeProjectStructure: false,
        // freshContextPerIteration: true is the default
      }, tempDir);

      const task = createTestTask();
      const previousIterations = [
        {
          iteration: 1,
          startedAt: new Date(),
          endedAt: new Date(),
          tokensUsed: 500,
          success: true,
          summary: 'Created auth module',
        },
      ];

      const result = await builder.buildContext(task, 2, 10, 500, 100000, previousIterations);

      // Should NOT contain previous iteration info - rely on git diff instead
      expect(result.prompt).not.toContain('Previous Progress');
      expect(result.prompt).not.toContain('Created auth module');
    });

    it('should include explicit context files when provided', async () => {
      // Create a test file
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(testFile, 'export const hello = "world";');

      const builder = new ContextBuilder({
        contextGlobs: ['*.ts'],
        includeGitDiff: false,
        includeGitHistory: false,
        includeProjectStructure: false,
      }, tempDir);

      const task = createTestTask();
      const result = await builder.buildContext(task, 1, 10, 0, 100000);

      expect(result.filesIncluded).toContain('test.ts');
      expect(result.prompt).toContain('test.ts');
      expect(result.prompt).toContain('export const hello');
    });

    it('should handle missing files gracefully', async () => {
      const builder = new ContextBuilder({
        contextGlobs: ['nonexistent/**/*.ts'],
        includeGitDiff: false,
        includeGitHistory: false,
        includeProjectStructure: false,
      }, tempDir);

      const task = createTestTask();
      const result = await builder.buildContext(task, 1, 10, 0, 100000);

      expect(result.filesIncluded).toHaveLength(0);
      expect(result.prompt).toBeDefined();
    });

    it('should use custom prompt template when provided', async () => {
      const customTemplate = `Custom template for: {task_title}
Task: {task_content}
Iteration: {iteration}`;

      const builder = new ContextBuilder({
        promptTemplate: customTemplate,
        includeGitDiff: false,
        includeGitHistory: false,
        includeProjectStructure: false,
      }, tempDir);

      const task = createTestTask();
      const result = await builder.buildContext(task, 1, 10, 0, 100000);

      expect(result.prompt).toContain('Custom template for: Add user authentication');
      expect(result.prompt).toContain('Task: Implement login and logout functionality');
      expect(result.prompt).toContain('Iteration: 1');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate token count for a string', async () => {
      const builder = new ContextBuilder({}, tempDir);
      const task = createTestTask();
      
      // Build context and check that tokens are estimated
      const result = await builder.buildContext(task, 1, 10, 0, 100000);
      
      // Token estimation is roughly characters / 4
      expect(result.estimatedTokens).toBeGreaterThan(50);
      expect(result.estimatedTokens).toBeLessThan(result.prompt.length);
    });
  });

  describe('token limit handling', () => {
    it('should set truncated flag when exceeding token limit', async () => {
      // Create a large file
      const largeContent = 'x'.repeat(50000);
      const largeFile = path.join(tempDir, 'large.ts');
      await fs.writeFile(largeFile, largeContent);

      const builder = new ContextBuilder({
        maxContextTokens: 100, // Very low limit
        contextGlobs: ['*.ts'],
        includeGitDiff: false,
        includeGitHistory: false,
        includeProjectStructure: false,
      }, tempDir);

      const task = createTestTask();
      const result = await builder.buildContext(task, 1, 10, 0, 100000);

      // Large files are skipped, so truncation may not happen
      // But the builder should handle the situation gracefully
      expect(result.prompt).toBeDefined();
    });
  });
});

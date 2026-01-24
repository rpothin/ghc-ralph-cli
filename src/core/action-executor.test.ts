/**
 * Action Executor Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createActionExecutor } from './action-executor.js';
import type { ActionExecutor } from './action-executor.js';
import type {
  CreateAction,
  EditAction,
  DeleteAction,
  ExecuteAction,
  CompleteAction,
  ParseResult,
} from './response-parser.js';

describe('Action Executor', () => {
  let tempDir: string;
  let executor: ActionExecutor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'action-executor-test-'));
    executor = createActionExecutor({ cwd: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('executeAction - CREATE', () => {
    it('should create a file with content', async () => {
      const action: CreateAction = {
        type: 'CREATE',
        path: 'hello.txt',
        content: 'Hello, world!',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Created hello.txt');

      const content = await fs.readFile(path.join(tempDir, 'hello.txt'), 'utf-8');
      expect(content).toBe('Hello, world!');
    });

    it('should create nested directories if needed', async () => {
      const action: CreateAction = {
        type: 'CREATE',
        path: 'src/deep/nested/file.ts',
        content: 'export const x = 1;',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(true);

      const content = await fs.readFile(path.join(tempDir, 'src/deep/nested/file.ts'), 'utf-8');
      expect(content).toBe('export const x = 1;');
    });

    it('should make shell scripts executable', async () => {
      const action: CreateAction = {
        type: 'CREATE',
        path: 'script.sh',
        content: '#!/bin/bash\necho "hello"',
        raw: '',
      };

      await executor.executeAction(action);

      const stats = await fs.stat(path.join(tempDir, 'script.sh'));
      // Check executable bit
      expect(stats.mode & 0o111).toBeTruthy();
    });

    it('should reject paths outside working directory', async () => {
      const action: CreateAction = {
        type: 'CREATE',
        path: '../../../etc/passwd',
        content: 'malicious',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path escapes working directory');
    });
  });

  describe('executeAction - EDIT', () => {
    it('should edit an existing file', async () => {
      // Create initial file
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'const x = 1;\nconst y = 2;');

      const action: EditAction = {
        type: 'EDIT',
        path: 'file.txt',
        oldContent: 'const x = 1;',
        newContent: 'const x = 42;',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(true);

      const content = await fs.readFile(path.join(tempDir, 'file.txt'), 'utf-8');
      expect(content).toBe('const x = 42;\nconst y = 2;');
    });

    it('should fail if file does not exist', async () => {
      const action: EditAction = {
        type: 'EDIT',
        path: 'nonexistent.txt',
        oldContent: 'old',
        newContent: 'new',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot edit non-existent file');
    });

    it('should fail if old content not found', async () => {
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'different content');

      const action: EditAction = {
        type: 'EDIT',
        path: 'file.txt',
        oldContent: 'not in file',
        newContent: 'new',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('old content was not found');
    });
  });

  describe('executeAction - DELETE', () => {
    it('should delete an existing file', async () => {
      await fs.writeFile(path.join(tempDir, 'to-delete.txt'), 'content');

      const action: DeleteAction = {
        type: 'DELETE',
        path: 'to-delete.txt',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(true);

      await expect(fs.access(path.join(tempDir, 'to-delete.txt'))).rejects.toThrow();
    });

    it('should fail if file does not exist', async () => {
      const action: DeleteAction = {
        type: 'DELETE',
        path: 'nonexistent.txt',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot delete non-existent file');
    });

    it('should respect file safeguard', async () => {
      await fs.writeFile(path.join(tempDir, 'protected.txt'), 'content');

      const executorWithSafeguard = createActionExecutor({
        cwd: tempDir,
        fileSafeguard: {
          canDelete: (p) => p !== 'protected.txt',
        },
      });

      const action: DeleteAction = {
        type: 'DELETE',
        path: 'protected.txt',
        raw: '',
      };

      const result = await executorWithSafeguard.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('protected by safeguard');
    });
  });

  describe('executeAction - EXECUTE', () => {
    it('should execute a shell command', async () => {
      const action: ExecuteAction = {
        type: 'EXECUTE',
        command: 'echo "hello world"',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.output).toContain('hello world');
    });

    it('should capture command failure', async () => {
      const action: ExecuteAction = {
        type: 'EXECUTE',
        command: 'exit 1',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should run commands in the correct working directory', async () => {
      const action: ExecuteAction = {
        type: 'EXECUTE',
        command: 'pwd',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.output).toContain(tempDir);
    });
  });

  describe('executeAction - COMPLETE', () => {
    it('should mark task as complete', async () => {
      const action: CompleteAction = {
        type: 'COMPLETE',
        reason: 'All tests pass',
        raw: '',
      };

      const result = await executor.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Task marked complete');
    });
  });

  describe('executeAll', () => {
    it('should execute multiple actions in sequence', async () => {
      const parseResult: ParseResult = {
        actions: [
          { type: 'CREATE', path: 'file1.txt', content: 'content1', raw: '' },
          { type: 'CREATE', path: 'file2.txt', content: 'content2', raw: '' },
          { type: 'EXECUTE', command: 'echo done', raw: '' },
        ],
        errors: [],
        hasActions: true,
        freeText: '',
      };

      const result = await executor.executeAll(parseResult);

      expect(result.allSucceeded).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.taskComplete).toBe(false);

      // Verify files were created
      const content1 = await fs.readFile(path.join(tempDir, 'file1.txt'), 'utf-8');
      expect(content1).toBe('content1');
    });

    it('should detect COMPLETE action', async () => {
      const parseResult: ParseResult = {
        actions: [
          { type: 'CREATE', path: 'file.txt', content: 'content', raw: '' },
          { type: 'COMPLETE', reason: 'Done implementing', raw: '' },
        ],
        errors: [],
        hasActions: true,
        freeText: '',
      };

      const result = await executor.executeAll(parseResult);

      expect(result.taskComplete).toBe(true);
      expect(result.completionReason).toBe('Done implementing');
    });

    it('should build a summary of executed actions', async () => {
      const parseResult: ParseResult = {
        actions: [
          { type: 'CREATE', path: 'file.txt', content: 'content', raw: '' },
        ],
        errors: [],
        hasActions: true,
        freeText: '',
      };

      const result = await executor.executeAll(parseResult);

      expect(result.summary).toContain('✓');
      expect(result.summary).toContain('Created file.txt');
    });
  });

  describe('dry run mode', () => {
    it('should not execute actions in dry run mode', async () => {
      const dryRunExecutor = createActionExecutor({
        cwd: tempDir,
        execute: false,
      });

      const action: CreateAction = {
        type: 'CREATE',
        path: 'should-not-exist.txt',
        content: 'content',
        raw: '',
      };

      const result = await dryRunExecutor.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('DRY RUN');

      // File should not exist
      await expect(fs.access(path.join(tempDir, 'should-not-exist.txt'))).rejects.toThrow();
    });
  });
});

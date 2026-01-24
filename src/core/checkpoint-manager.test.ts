/**
 * Checkpoint Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { CheckpointManager, createCheckpointManager } from './checkpoint-manager.js';

const execAsync = promisify(exec);

describe('CheckpointManager', () => {
  let tempDir: string;
  let manager: CheckpointManager;

  beforeEach(async () => {
    // Create a temp directory and initialize a git repo
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghcralph-checkpoint-'));
    await execAsync('git init', { cwd: tempDir });
    await execAsync('git config user.email "test@example.com"', { cwd: tempDir });
    await execAsync('git config user.name "Test User"', { cwd: tempDir });
    
    // Create an initial commit
    const testFile = path.join(tempDir, 'README.md');
    await fs.writeFile(testFile, '# Test Project');
    await execAsync('git add .', { cwd: tempDir });
    await execAsync('git commit -m "Initial commit"', { cwd: tempDir });
    
    manager = new CheckpointManager({ 
      cwd: tempDir, 
      autoCommit: true,
      messagePrefix: 'ghcralph:' 
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createCheckpointManager', () => {
    it('should create manager with default config', () => {
      const defaultManager = createCheckpointManager();
      expect(defaultManager.isAutoCommitEnabled()).toBe(true);
    });

    it('should create manager with custom config', () => {
      const customManager = createCheckpointManager({ autoCommit: false });
      expect(customManager.isAutoCommitEnabled()).toBe(false);
    });
  });

  describe('isAutoCommitEnabled', () => {
    it('should return true when auto-commit is enabled', () => {
      expect(manager.isAutoCommitEnabled()).toBe(true);
    });

    it('should return false when auto-commit is disabled', () => {
      const disabledManager = new CheckpointManager({ cwd: tempDir, autoCommit: false });
      expect(disabledManager.isAutoCommitEnabled()).toBe(false);
    });
  });

  describe('getCheckpoints', () => {
    it('should return empty array initially', () => {
      expect(manager.getCheckpoints()).toEqual([]);
    });

    it('should return copy of checkpoints array', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content');
      await manager.createCheckpoint(1, 'First change', 100);
      
      const checkpoints1 = manager.getCheckpoints();
      const checkpoints2 = manager.getCheckpoints();
      
      expect(checkpoints1).toEqual(checkpoints2);
      expect(checkpoints1).not.toBe(checkpoints2); // Different array instances
    });
  });

  describe('getLastCheckpoint', () => {
    it('should return null when no checkpoints exist', () => {
      expect(manager.getLastCheckpoint()).toBeNull();
    });

    it('should return last checkpoint', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await manager.createCheckpoint(1, 'First', 100);
      
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await manager.createCheckpoint(2, 'Second', 200);
      
      const last = manager.getLastCheckpoint();
      expect(last).toBeDefined();
      expect(last?.iteration).toBe(2);
      expect(last?.message).toContain('Second');
    });
  });

  describe('hasChangesToCommit', () => {
    it('should return false for clean working directory', async () => {
      const hasChanges = await manager.hasChangesToCommit();
      expect(hasChanges).toBe(false);
    });

    it('should return true when files are modified', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Modified');
      
      const hasChanges = await manager.hasChangesToCommit();
      expect(hasChanges).toBe(true);
    });

    it('should return true when files are added', async () => {
      await fs.writeFile(path.join(tempDir, 'newfile.txt'), 'new content');
      
      const hasChanges = await manager.hasChangesToCommit();
      expect(hasChanges).toBe(true);
    });
  });

  describe('getModifiedFiles', () => {
    it('should return empty array for clean directory', async () => {
      const files = await manager.getModifiedFiles();
      expect(files).toEqual([]);
    });

    it('should return list of modified files', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Modified');
      await fs.writeFile(path.join(tempDir, 'newfile.txt'), 'new content');
      
      const files = await manager.getModifiedFiles();
      
      expect(files.length).toBe(2);
      // Files should be returned (testing the method works, not exact format)
      expect(files.every(f => f.length > 0)).toBe(true);
    });
  });

  describe('stageAllChanges', () => {
    it('should stage all changes', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content');
      
      const staged = await manager.stageAllChanges();
      
      expect(staged).toBe(true);
      
      // Check staged files
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: tempDir });
      expect(stdout).toContain('file1.txt');
      expect(stdout).toContain('file2.txt');
    });
  });

  describe('createCheckpoint', () => {
    it('should create checkpoint with commit', async () => {
      await fs.writeFile(path.join(tempDir, 'feature.ts'), 'export function test() {}');
      
      const checkpoint = await manager.createCheckpoint(1, 'Added test function', 150);
      
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.iteration).toBe(1);
      expect(checkpoint?.commitHash).toBeDefined();
      expect(checkpoint?.message).toContain('ghcralph:');
      expect(checkpoint?.message).toContain('iteration 1');
      expect(checkpoint?.filesModified).toContain('feature.ts');
      expect(checkpoint?.tokensUsed).toBe(150);
      expect(checkpoint?.timestamp).toBeDefined();
    });

    it('should return null when no changes to commit', async () => {
      const checkpoint = await manager.createCheckpoint(1, 'No changes', 0);
      expect(checkpoint).toBeNull();
    });

    it('should return null when auto-commit is disabled', async () => {
      const disabledManager = new CheckpointManager({ cwd: tempDir, autoCommit: false });
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');
      
      const checkpoint = await disabledManager.createCheckpoint(1, 'Change', 100);
      expect(checkpoint).toBeNull();
    });

    it('should truncate long summaries', async () => {
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');
      const longSummary = 'This is a very long summary that exceeds fifty characters and should be truncated';
      
      const checkpoint = await manager.createCheckpoint(1, longSummary, 100);
      
      expect(checkpoint?.message).toContain('...');
      expect(checkpoint?.message.length).toBeLessThan(100);
    });

    it('should add checkpoints to history', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await manager.createCheckpoint(1, 'First', 100);
      
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await manager.createCheckpoint(2, 'Second', 200);
      
      const checkpoints = manager.getCheckpoints();
      expect(checkpoints.length).toBe(2);
    });
  });

  describe('rollbackTo', () => {
    it('should soft reset to commit hash', async () => {
      // Create a checkpoint
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');
      const checkpoint = await manager.createCheckpoint(1, 'First', 100);
      
      // Make another change
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'modified');
      await manager.createCheckpoint(2, 'Second', 100);
      
      // Rollback to first checkpoint
      expect(checkpoint).toBeDefined();
      if (checkpoint) {
        const success = await manager.rollbackTo(checkpoint.commitHash);
        expect(success).toBe(true);
      }
    });
  });

  describe('hardRollbackTo', () => {
    it('should hard reset to commit hash', async () => {
      // Create a checkpoint
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'original');
      const checkpoint = await manager.createCheckpoint(1, 'First', 100);
      
      // Make another change
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'modified');
      await manager.createCheckpoint(2, 'Second', 100);
      
      // Hard rollback
      expect(checkpoint).toBeDefined();
      if (checkpoint) {
        const success = await manager.hardRollbackTo(checkpoint.commitHash);
        expect(success).toBe(true);
        
        // Check file content is restored
        const content = await fs.readFile(path.join(tempDir, 'file.txt'), 'utf-8');
        expect(content).toBe('original');
      }
    });
  });

  describe('rollbackIterations', () => {
    it('should rollback by N iterations', async () => {
      // Create multiple checkpoints
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'v1');
      await manager.createCheckpoint(1, 'Version 1', 100);
      
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'v2');
      await manager.createCheckpoint(2, 'Version 2', 100);
      
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'v3');
      await manager.createCheckpoint(3, 'Version 3', 100);
      
      // Rollback 2 iterations (from v3 to v1)
      const success = await manager.rollbackIterations(2);
      
      expect(success).toBe(true);
    });

    it('should fail when not enough checkpoints', async () => {
      const success = await manager.rollbackIterations(5);
      expect(success).toBe(false);
    });
  });

  describe('getInitialCommit', () => {
    it('should return null when no checkpoints exist', async () => {
      const commit = await manager.getInitialCommit();
      expect(commit).toBeNull();
    });

    it('should return parent of first checkpoint', async () => {
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');
      await manager.createCheckpoint(1, 'First', 100);
      
      const initialCommit = await manager.getInitialCommit();
      
      expect(initialCommit).toBeDefined();
      expect(initialCommit?.length).toBe(40); // Full SHA hash
    });
  });

  describe('rollbackAll', () => {
    it('should rollback to state before Ralph started', async () => {
      // Get initial content
      const initialContent = await fs.readFile(path.join(tempDir, 'README.md'), 'utf-8');
      
      // Create checkpoints with changes
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Modified by Ralph');
      await manager.createCheckpoint(1, 'First change', 100);
      
      await fs.writeFile(path.join(tempDir, 'newfile.txt'), 'new content');
      await manager.createCheckpoint(2, 'Second change', 100);
      
      // Rollback all
      const success = await manager.rollbackAll();
      
      expect(success).toBe(true);
      
      // Check README is restored
      const restoredContent = await fs.readFile(path.join(tempDir, 'README.md'), 'utf-8');
      expect(restoredContent).toBe(initialContent);
      
      // Check new file is removed
      await expect(fs.access(path.join(tempDir, 'newfile.txt'))).rejects.toThrow();
    });

    it('should return false when no checkpoints exist', async () => {
      const success = await manager.rollbackAll();
      expect(success).toBe(false);
    });
  });
});

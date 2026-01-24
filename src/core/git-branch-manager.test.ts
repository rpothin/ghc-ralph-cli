/**
 * Git Branch Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { GitBranchManager } from './git-branch-manager.js';

const execAsync = promisify(exec);

describe('GitBranchManager', () => {
  let tempDir: string;
  let manager: GitBranchManager;

  beforeEach(async () => {
    // Create a temp directory and initialize a git repo
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghcralph-git-'));
    await execAsync('git init', { cwd: tempDir });
    await execAsync('git config user.email "test@example.com"', { cwd: tempDir });
    await execAsync('git config user.name "Test User"', { cwd: tempDir });
    
    // Create an initial commit
    const testFile = path.join(tempDir, 'README.md');
    await fs.writeFile(testFile, '# Test Project');
    await execAsync('git add .', { cwd: tempDir });
    await execAsync('git commit -m "Initial commit"', { cwd: tempDir });
    
    manager = new GitBranchManager({ cwd: tempDir, branchPrefix: 'ghcralph/' });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('isGitRepository', () => {
    it('should return true for git repository', async () => {
      const result = await manager.isGitRepository();
      expect(result).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghcralph-nongit-'));
      const nonGitManager = new GitBranchManager({ cwd: nonGitDir });
      
      const result = await nonGitManager.isGitRepository();
      expect(result).toBe(false);
      
      await fs.rm(nonGitDir, { recursive: true, force: true });
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch info', async () => {
      const branchInfo = await manager.getCurrentBranch();
      
      expect(branchInfo).toBeDefined();
      expect(branchInfo.name).toBeDefined();
      // Initial branch is typically 'master' or 'main'
      expect(branchInfo.isMain).toBe(true);
      expect(branchInfo.isRalphBranch).toBe(false);
    });

    it('should detect ghcralph branch', async () => {
      await execAsync('git checkout -b ghcralph/test-branch', { cwd: tempDir });
      
      const branchInfo = await manager.getCurrentBranch();
      
      expect(branchInfo.name).toBe('ghcralph/test-branch');
      expect(branchInfo.isRalphBranch).toBe(true);
      expect(branchInfo.isMain).toBe(false);
    });
  });

  describe('getWorkingDirStatus', () => {
    it('should report clean working directory', async () => {
      const status = await manager.getWorkingDirStatus();
      
      expect(status.isClean).toBe(true);
      expect(status.modifiedFiles).toBe(0);
      expect(status.untrackedFiles).toBe(0);
    });

    it('should report modified files', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Modified');
      
      const status = await manager.getWorkingDirStatus();
      
      expect(status.isClean).toBe(false);
      expect(status.modifiedFiles).toBeGreaterThan(0);
    });

    it('should report untracked files', async () => {
      await fs.writeFile(path.join(tempDir, 'newfile.txt'), 'new content');
      
      const status = await manager.getWorkingDirStatus();
      
      expect(status.isClean).toBe(false);
      expect(status.untrackedFiles).toBeGreaterThan(0);
    });
  });

  describe('generateBranchName', () => {
    it('should generate branch name with prefix', () => {
      const branchName = manager.generateBranchName('Add user authentication');
      
      expect(branchName).toContain('ghcralph/');
      expect(branchName).toContain('add-user-authentication');
    });

    it('should use task ID when provided', () => {
      const branchName = manager.generateBranchName('Some task', 'TASK-123');
      
      expect(branchName).toContain('ghcralph/');
      expect(branchName).toContain('TASK-123');
    });

    it('should sanitize special characters', () => {
      const branchName = manager.generateBranchName('Task with spaces & special!chars');
      
      expect(branchName).not.toContain(' ');
      expect(branchName).not.toContain('&');
      expect(branchName).not.toContain('!');
    });

    it('should truncate long task names', () => {
      const longName = 'This is a very long task name that should be truncated';
      const branchName = manager.generateBranchName(longName);
      
      // Branch name should be reasonable length
      expect(branchName.length).toBeLessThan(60);
    });
  });

  describe('createAndSwitchBranch', () => {
    it('should create and switch to new branch', async () => {
      const success = await manager.createAndSwitchBranch('ghcralph/test-new-branch');
      
      expect(success).toBe(true);
      
      const currentBranch = await manager.getCurrentBranch();
      expect(currentBranch.name).toBe('ghcralph/test-new-branch');
    });
  });

  describe('stashChanges', () => {
    it('should stash modified files', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Modified content');
      
      const stashed = await manager.stashChanges();
      
      expect(stashed).toBe(true);
      
      // Working directory should be clean now
      const status = await manager.getWorkingDirStatus();
      expect(status.isClean).toBe(true);
    });
  });

  describe('popStash', () => {
    it('should restore stashed changes', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Stashed content');
      await manager.stashChanges();
      
      const popped = await manager.popStash();
      
      expect(popped).toBe(true);
      
      // File should be modified again
      const content = await fs.readFile(path.join(tempDir, 'README.md'), 'utf-8');
      expect(content).toBe('# Stashed content');
    });
  });
});

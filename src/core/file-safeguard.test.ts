/**
 * File Safeguard Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { FileSafeguardManager, createFileSafeguardManager } from './file-safeguard.js';

const execAsync = promisify(exec);

describe('FileSafeguardManager', () => {
  let tempDir: string;
  let manager: FileSafeguardManager;

  beforeEach(async () => {
    // Create a temp directory and initialize a git repo
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghcralph-safeguard-'));
    await execAsync('git init', { cwd: tempDir });
    await execAsync('git config user.email "test@example.com"', { cwd: tempDir });
    await execAsync('git config user.name "Test User"', { cwd: tempDir });
    
    // Create initial files and commit
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project');
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {}');
    await execAsync('git add .', { cwd: tempDir });
    await execAsync('git commit -m "Initial commit"', { cwd: tempDir });
    
    manager = new FileSafeguardManager({ 
      cwd: tempDir,
      baselinePath: '.ghcralph/baseline-files.json',
      allowDeleteExisting: false
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createFileSafeguardManager', () => {
    it('should create manager with default config', () => {
      const defaultManager = createFileSafeguardManager();
      expect(defaultManager).toBeDefined();
    });

    it('should create manager with custom config', () => {
      const customManager = createFileSafeguardManager({
        allowDeleteExisting: true
      });
      expect(customManager).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should create baseline snapshot', async () => {
      await manager.initialize();
      
      const summary = manager.getSummary();
      expect(summary.baselineCount).toBeGreaterThan(0);
    });

    it('should save baseline to file', async () => {
      await manager.initialize();
      
      const baselinePath = path.join(tempDir, '.ghcralph/baseline-files.json');
      const exists = await fs.access(baselinePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      const content = await fs.readFile(baselinePath, 'utf-8');
      const snapshot = JSON.parse(content);
      expect(snapshot.files).toContain('README.md');
      expect(snapshot.createdAt).toBeDefined();
    });

    it('should load existing baseline on subsequent calls', async () => {
      await manager.initialize();
      
      // Create a new manager and initialize again
      const manager2 = new FileSafeguardManager({ 
        cwd: tempDir,
        baselinePath: '.ghcralph/baseline-files.json'
      });
      await manager2.initialize();
      
      const summary = manager2.getSummary();
      expect(summary.baselineCount).toBeGreaterThan(0);
    });
  });

  describe('isBaselineFile', () => {
    it('should return true for files in baseline', async () => {
      await manager.initialize();
      
      const result = manager.isBaselineFile(path.join(tempDir, 'README.md'));
      expect(result).toBe(true);
    });

    it('should return false for new files', async () => {
      await manager.initialize();
      await fs.writeFile(path.join(tempDir, 'newfile.txt'), 'content');
      
      const result = manager.isBaselineFile(path.join(tempDir, 'newfile.txt'));
      expect(result).toBe(false);
    });
  });

  describe('trackFileCreation', () => {
    it('should track new files', async () => {
      await manager.initialize();
      const newFile = path.join(tempDir, 'newfile.txt');
      
      manager.trackFileCreation(newFile);
      
      expect(manager.isCreatedFile(newFile)).toBe(true);
    });

    it('should not track baseline files as created', async () => {
      await manager.initialize();
      const existingFile = path.join(tempDir, 'README.md');
      
      manager.trackFileCreation(existingFile);
      
      expect(manager.isCreatedFile(existingFile)).toBe(false);
    });
  });

  describe('trackFileModification', () => {
    it('should track modified files', async () => {
      await manager.initialize();
      const file = path.join(tempDir, 'README.md');
      
      manager.trackFileModification(file);
      
      const details = manager.getDetails();
      expect(details.modified).toContain('README.md');
    });
  });

  describe('canDelete', () => {
    it('should allow deletion of created files', async () => {
      await manager.initialize();
      const newFile = path.join(tempDir, 'newfile.txt');
      manager.trackFileCreation(newFile);
      
      const canDelete = manager.canDelete(newFile);
      expect(canDelete).toBe(true);
    });

    it('should block deletion of baseline files', async () => {
      await manager.initialize();
      const existingFile = path.join(tempDir, 'README.md');
      
      const canDelete = manager.canDelete(existingFile);
      expect(canDelete).toBe(false);
    });

    it('should track blocked deletions', async () => {
      await manager.initialize();
      const existingFile = path.join(tempDir, 'README.md');
      
      manager.canDelete(existingFile);
      
      const summary = manager.getSummary();
      expect(summary.blockedCount).toBe(1);
      
      const details = manager.getDetails();
      expect(details.blockedDeletions).toContain('README.md');
    });

    it('should allow deletion when allowDeleteExisting is true', async () => {
      const permissiveManager = new FileSafeguardManager({ 
        cwd: tempDir,
        allowDeleteExisting: true
      });
      await permissiveManager.initialize();
      
      const existingFile = path.join(tempDir, 'README.md');
      const canDelete = permissiveManager.canDelete(existingFile);
      
      expect(canDelete).toBe(true);
    });

    it('should allow deletion of unknown files', async () => {
      await manager.initialize();
      const unknownFile = path.join(tempDir, 'unknown.txt');
      
      const canDelete = manager.canDelete(unknownFile);
      expect(canDelete).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return accurate counts', async () => {
      await manager.initialize();
      
      // Track some operations
      manager.trackFileCreation(path.join(tempDir, 'new1.txt'));
      manager.trackFileCreation(path.join(tempDir, 'new2.txt'));
      manager.trackFileModification(path.join(tempDir, 'README.md'));
      manager.canDelete(path.join(tempDir, 'README.md')); // blocked
      
      const summary = manager.getSummary();
      
      expect(summary.baselineCount).toBeGreaterThan(0);
      expect(summary.createdCount).toBe(2);
      expect(summary.modifiedCount).toBe(1);
      expect(summary.blockedCount).toBe(1);
    });
  });

  describe('getDetails', () => {
    it('should return detailed operation info', async () => {
      await manager.initialize();
      
      manager.trackFileCreation(path.join(tempDir, 'created.txt'));
      manager.trackFileModification(path.join(tempDir, 'README.md'));
      manager.canDelete(path.join(tempDir, 'src/index.ts')); // blocked
      
      const details = manager.getDetails();
      
      expect(details.created).toContain('created.txt');
      expect(details.modified).toContain('README.md');
      expect(details.blockedDeletions).toContain('src/index.ts');
    });
  });

  describe('cleanup', () => {
    it('should remove baseline file', async () => {
      await manager.initialize();
      
      const baselinePath = path.join(tempDir, '.ghcralph/baseline-files.json');
      const existsBefore = await fs.access(baselinePath).then(() => true).catch(() => false);
      expect(existsBefore).toBe(true);
      
      await manager.cleanup();
      
      const existsAfter = await fs.access(baselinePath).then(() => true).catch(() => false);
      expect(existsAfter).toBe(false);
    });

    it('should not throw when baseline file does not exist', async () => {
      // Don't initialize - no baseline file exists
      await expect(manager.cleanup()).resolves.not.toThrow();
    });
  });
});

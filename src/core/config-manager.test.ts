/**
 * Config Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager, getGlobalConfigPath, getLocalConfigPath } from './config-manager.js';
import { DEFAULT_CONFIG } from './config-schema.js';

describe('ConfigManager', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghcralph-config-'));
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(async () => {
    // Restore environment
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const manager = new ConfigManager();
      const config = manager.getConfig();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should accept project root', () => {
      const manager = new ConfigManager('/some/path');
      const config = manager.getConfig();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of config', () => {
      const manager = new ConfigManager();
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object instances
    });
  });

  describe('get', () => {
    it('should return specific config value', () => {
      const manager = new ConfigManager();
      
      expect(manager.get('maxIterations')).toBe(DEFAULT_CONFIG.maxIterations);
      expect(manager.get('defaultModel')).toBe(DEFAULT_CONFIG.defaultModel);
      expect(manager.get('autoCommit')).toBe(DEFAULT_CONFIG.autoCommit);
    });
  });

  describe('set', () => {
    it('should set config value', () => {
      const manager = new ConfigManager();
      
      manager.set('maxIterations', 50);
      
      expect(manager.get('maxIterations')).toBe(50);
    });

    it('should throw error for invalid value', () => {
      const manager = new ConfigManager();
      
      expect(() => manager.set('maxIterations', -1)).toThrow();
    });

    it('should validate value type', () => {
      const manager = new ConfigManager();
      
      expect(() => manager.set('autoCommit', true)).not.toThrow();
      expect(() => manager.set('branchPrefix', 'feature/')).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should reset to defaults', () => {
      const manager = new ConfigManager();
      
      manager.set('maxIterations', 100);
      manager.set('defaultModel', 'gpt-5');
      
      manager.reset();
      
      expect(manager.get('maxIterations')).toBe(DEFAULT_CONFIG.maxIterations);
      expect(manager.get('defaultModel')).toBe(DEFAULT_CONFIG.defaultModel);
    });
  });

  describe('load', () => {
    it('should merge CLI overrides with defaults', async () => {
      const manager = new ConfigManager(tempDir);
      
      const config = await manager.load({
        maxIterations: 99,
        defaultModel: 'custom-model',
      });
      
      expect(config.maxIterations).toBe(99);
      expect(config.defaultModel).toBe('custom-model');
      // Other values remain default
      expect(config.autoCommit).toBe(DEFAULT_CONFIG.autoCommit);
    });

    it('should use defaults when no config files exist', async () => {
      const manager = new ConfigManager(tempDir);
      
      const config = await manager.load();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('saveLocal', () => {
    it('should save config to local file', async () => {
      const manager = new ConfigManager(tempDir);
      manager.set('maxIterations', 42);
      
      await manager.saveLocal();
      
      const localConfigPath = getLocalConfigPath(tempDir);
      const savedContent = await fs.readFile(localConfigPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);
      
      expect(savedConfig.maxIterations).toBe(42);
    });

    it('should create directory if not exists', async () => {
      const newDir = path.join(tempDir, 'nested', 'project');
      const manager = new ConfigManager(newDir);
      
      await manager.saveLocal();
      
      const localConfigPath = getLocalConfigPath(newDir);
      const exists = await fs.access(localConfigPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('hasLocalConfig', () => {
    it('should return false when no local config exists', async () => {
      const manager = new ConfigManager(tempDir);
      
      const hasConfig = await manager.hasLocalConfig();
      
      expect(hasConfig).toBe(false);
    });

    it('should return true when local config exists', async () => {
      const manager = new ConfigManager(tempDir);
      await manager.saveLocal();
      
      const hasConfig = await manager.hasLocalConfig();
      
      expect(hasConfig).toBe(true);
    });
  });

  describe('initLocal', () => {
    it('should create state directory and save config', async () => {
      const manager = new ConfigManager(tempDir);
      
      const stateDir = await manager.initLocal();
      
      expect(stateDir).toContain('.ghcralph');
      
      const localConfigPath = getLocalConfigPath(tempDir);
      const exists = await fs.access(localConfigPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('getGlobalConfigPath', () => {
    it('should return path containing config.json', () => {
      const globalPath = getGlobalConfigPath();
      
      expect(globalPath).toContain('config.json');
    });
  });

  describe('getLocalConfigPath', () => {
    it('should return path containing project root', () => {
      const localPath = getLocalConfigPath(tempDir);
      
      expect(localPath).toContain('.ghcralph');
      expect(localPath).toContain('config.json');
    });
  });
});

/**
 * Shell Detection Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectShell, getShellConfigPath } from './shell.js';

describe('Shell Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('detectShell', () => {
    it('should detect bash shell', () => {
      delete process.env['PSModulePath'];
      process.env['SHELL'] = '/bin/bash';
      
      const result = detectShell();

      if (process.platform === 'win32') {
        expect(result.type).toBe('cmd');
        expect(result.isWindows).toBe(true);
        return;
      }
      
      expect(result.type).toBe('bash');
      expect(result.path).toBe('/bin/bash');
      expect(result.isWindows).toBe(false);
    });

    it('should detect zsh shell', () => {
      delete process.env['PSModulePath'];
      process.env['SHELL'] = '/usr/local/bin/zsh';
      
      const result = detectShell();

      if (process.platform === 'win32') {
        expect(result.type).toBe('cmd');
        expect(result.isWindows).toBe(true);
        return;
      }
      
      expect(result.type).toBe('zsh');
      expect(result.path).toBe('/usr/local/bin/zsh');
      expect(result.isWindows).toBe(false);
    });

    it('should detect fish shell', () => {
      delete process.env['PSModulePath'];
      process.env['SHELL'] = '/usr/bin/fish';
      
      const result = detectShell();

      if (process.platform === 'win32') {
        expect(result.type).toBe('cmd');
        expect(result.isWindows).toBe(true);
        return;
      }
      
      expect(result.type).toBe('fish');
      expect(result.path).toBe('/usr/bin/fish');
      expect(result.isWindows).toBe(false);
    });

    it('should return unknown for unrecognized shell', () => {
      delete process.env['PSModulePath'];
      process.env['SHELL'] = '/usr/bin/custom-shell';
      
      const result = detectShell();

      if (process.platform === 'win32') {
        expect(result.type).toBe('cmd');
        expect(result.isWindows).toBe(true);
        return;
      }
      
      expect(result.type).toBe('unknown');
      expect(result.path).toBe('/usr/bin/custom-shell');
    });

    it('should handle missing SHELL env var', () => {
      delete process.env['PSModulePath'];
      delete process.env['SHELL'];
      
      const result = detectShell();

      if (process.platform === 'win32') {
        expect(result.type).toBe('cmd');
        expect(result.isWindows).toBe(true);
        return;
      }
      
      expect(result.type).toBe('unknown');
      expect(result.path).toBeUndefined();
    });
  });

  describe('getShellConfigPath', () => {
    it('should return .bashrc for bash', () => {
      process.env['HOME'] = '/home/testuser';
      
      const result = getShellConfigPath('bash');
      
      expect(result).toBe('/home/testuser/.bashrc');
    });

    it('should return .zshrc for zsh', () => {
      process.env['HOME'] = '/home/testuser';
      
      const result = getShellConfigPath('zsh');
      
      expect(result).toBe('/home/testuser/.zshrc');
    });

    it('should return fish config path for fish', () => {
      process.env['HOME'] = '/home/testuser';
      
      const result = getShellConfigPath('fish');
      
      expect(result).toBe('/home/testuser/.config/fish/config.fish');
    });

    it('should return undefined for powershell', () => {
      const result = getShellConfigPath('powershell');
      expect(result).toBeUndefined();
    });

    it('should return undefined for cmd', () => {
      const result = getShellConfigPath('cmd');
      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown', () => {
      const result = getShellConfigPath('unknown');
      expect(result).toBeUndefined();
    });

    it('should use USERPROFILE when HOME not set', () => {
      delete process.env['HOME'];
      process.env['USERPROFILE'] = 'C:\\Users\\testuser';
      
      const result = getShellConfigPath('bash');
      
      expect(result).toBe('C:\\Users\\testuser/.bashrc');
    });

    it('should return undefined when no home directory', () => {
      delete process.env['HOME'];
      delete process.env['USERPROFILE'];
      
      const result = getShellConfigPath('bash');
      
      expect(result).toBeUndefined();
    });
  });
});

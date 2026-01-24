/**
 * Path Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import {
  normalizePath,
  joinPath,
  getHomeDir,
  getConfigDir,
  getLocalStateDir,
  toForwardSlashes,
  resolvePath,
} from './paths.js';

describe('Path Utilities', () => {
  describe('normalizePath', () => {
    it('should normalize a path with redundant separators', () => {
      const input = 'a//b//c';
      const result = normalizePath(input);
      expect(result).toBe(path.normalize(input));
    });

    it('should normalize a path with dots', () => {
      const input = 'a/b/../c';
      const result = normalizePath(input);
      expect(result).toBe(path.normalize(input));
    });
  });

  describe('joinPath', () => {
    it('should join path segments', () => {
      const result = joinPath('a', 'b', 'c');
      expect(result).toBe(path.join('a', 'b', 'c'));
    });

    it('should handle empty segments', () => {
      const result = joinPath('a', '', 'c');
      expect(result).toBe(path.join('a', '', 'c'));
    });
  });

  describe('getHomeDir', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return HOME directory on Unix', () => {
      process.env['HOME'] = '/home/testuser';
      delete process.env['USERPROFILE'];
      
      const result = getHomeDir();
      expect(result).toBe('/home/testuser');
    });

    it('should return USERPROFILE on Windows when HOME not set', () => {
      delete process.env['HOME'];
      process.env['USERPROFILE'] = 'C:\\Users\\testuser';
      
      const result = getHomeDir();
      expect(result).toBe('C:\\Users\\testuser');
    });

    it('should throw when no home directory found', () => {
      delete process.env['HOME'];
      delete process.env['USERPROFILE'];
      
      expect(() => getHomeDir()).toThrow('Could not determine home directory');
    });
  });

  describe('getConfigDir', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use XDG_CONFIG_HOME when set', () => {
      process.env['HOME'] = '/home/testuser';
      process.env['XDG_CONFIG_HOME'] = '/custom/config';
      delete process.env['APPDATA'];
      
      const result = getConfigDir();
      expect(result).toBe(path.join('/custom/config', 'ghcralph'));
    });

    it('should fall back to ~/.config/ghcralph', () => {
      process.env['HOME'] = '/home/testuser';
      delete process.env['XDG_CONFIG_HOME'];
      delete process.env['APPDATA'];
      
      const result = getConfigDir();
      expect(result).toBe(path.join('/home/testuser', '.config', 'ghcralph'));
    });
  });

  describe('getLocalStateDir', () => {
    it('should return .ghcralph in project root', () => {
      const projectRoot = '/my/project';
      const result = getLocalStateDir(projectRoot);
      
      expect(result).toBe(path.join(projectRoot, '.ghcralph'));
    });

    it('should use cwd when no project root specified', () => {
      const result = getLocalStateDir();
      expect(result).toBe(path.join(process.cwd(), '.ghcralph'));
    });
  });

  describe('toForwardSlashes', () => {
    it('should convert backslashes to forward slashes', () => {
      const input = 'a\\b\\c';
      const result = toForwardSlashes(input);
      
      expect(result).toBe('a/b/c');
    });

    it('should leave forward slashes unchanged', () => {
      const input = 'a/b/c';
      const result = toForwardSlashes(input);
      
      expect(result).toBe('a/b/c');
    });

    it('should handle mixed slashes', () => {
      const input = 'a\\b/c\\d';
      const result = toForwardSlashes(input);
      
      expect(result).toBe('a/b/c/d');
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative path to absolute', () => {
      const result = resolvePath('relative/path');
      
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('relative');
      expect(result).toContain('path');
    });

    it('should leave absolute path unchanged', () => {
      const input = '/absolute/path';
      const result = resolvePath(input);
      
      expect(result).toBe(input);
    });
  });
});

/**
 * Config Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  CONFIG_KEYS,
  isValidConfigKey,
  validateConfigValue,
  parseConfigValue,
  type ConfigKey,
} from './config-schema.js';

describe('Config Schema', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have all required default values', () => {
      expect(DEFAULT_CONFIG.planSource).toBe('local');
      expect(DEFAULT_CONFIG.maxIterations).toBe(10);
      expect(DEFAULT_CONFIG.maxTokens).toBe(100000);
      expect(DEFAULT_CONFIG.defaultModel).toBe('gpt-4.1');
      expect(DEFAULT_CONFIG.autoCommit).toBe(true);
      expect(DEFAULT_CONFIG.branchPrefix).toBe('ghcralph/');
    });
  });

  describe('isValidConfigKey', () => {
    it('should return true for valid config keys', () => {
      expect(isValidConfigKey('planSource')).toBe(true);
      expect(isValidConfigKey('maxIterations')).toBe(true);
      expect(isValidConfigKey('maxTokens')).toBe(true);
      expect(isValidConfigKey('defaultModel')).toBe(true);
      expect(isValidConfigKey('autoCommit')).toBe(true);
      expect(isValidConfigKey('branchPrefix')).toBe(true);
      expect(isValidConfigKey('githubRepo')).toBe(true);
      expect(isValidConfigKey('githubLabel')).toBe(true);
      expect(isValidConfigKey('githubMilestone')).toBe(true);
      expect(isValidConfigKey('githubAssignee')).toBe(true);
      expect(isValidConfigKey('mcpServers')).toBe(true);
    });

    it('should return false for invalid config keys', () => {
      expect(isValidConfigKey('invalidKey')).toBe(false);
      expect(isValidConfigKey('')).toBe(false);
      expect(isValidConfigKey('MAXITERATIONS')).toBe(false);
    });
  });

  describe('validateConfigValue', () => {
    it('should validate planSource correctly', () => {
      expect(validateConfigValue('planSource', 'local').valid).toBe(true);
      expect(validateConfigValue('planSource', 'github').valid).toBe(true);
      expect(validateConfigValue('planSource', 'invalid').valid).toBe(false);
    });

    it('should validate numeric values correctly', () => {
      expect(validateConfigValue('maxIterations', 10).valid).toBe(true);
      expect(validateConfigValue('maxIterations', 0).valid).toBe(false);
      expect(validateConfigValue('maxIterations', -1).valid).toBe(false);
      expect(validateConfigValue('maxIterations', 'ten' as unknown as number).valid).toBe(false);

      expect(validateConfigValue('maxTokens', 50000).valid).toBe(true);
      expect(validateConfigValue('maxTokens', 0).valid).toBe(false);
    });

    it('should validate boolean values correctly', () => {
      expect(validateConfigValue('autoCommit', true).valid).toBe(true);
      expect(validateConfigValue('autoCommit', false).valid).toBe(true);
      expect(validateConfigValue('autoCommit', 'true' as unknown as boolean).valid).toBe(false);
    });

    it('should validate string values correctly', () => {
      expect(validateConfigValue('defaultModel', 'gpt-4.1').valid).toBe(true);
      expect(validateConfigValue('branchPrefix', 'feature/').valid).toBe(true);
      expect(validateConfigValue('githubRepo', 'owner/repo').valid).toBe(true);
      expect(validateConfigValue('githubLabel', 'my-label').valid).toBe(true);
      expect(validateConfigValue('githubMilestone', 'v1.0').valid).toBe(true);
      expect(validateConfigValue('githubAssignee', 'octocat').valid).toBe(true);
      expect(validateConfigValue('defaultModel', 123 as unknown as string).valid).toBe(false);
    });
  });

  describe('parseConfigValue', () => {
    it('should parse numeric string values', () => {
      expect(parseConfigValue('maxIterations', '15')).toBe(15);
      expect(parseConfigValue('maxTokens', '50000')).toBe(50000);
    });

    it('should parse boolean string values', () => {
      expect(parseConfigValue('autoCommit', 'true')).toBe(true);
      expect(parseConfigValue('autoCommit', 'TRUE')).toBe(true);
      expect(parseConfigValue('autoCommit', 'false')).toBe(false);
    });

    it('should return string values as-is for string keys', () => {
      expect(parseConfigValue('defaultModel', 'gpt-4')).toBe('gpt-4');
      expect(parseConfigValue('branchPrefix', 'my-prefix/')).toBe('my-prefix/');
      expect(parseConfigValue('planSource', 'github')).toBe('github');
    });
  });

  describe('CONFIG_KEYS', () => {
    it('should contain all expected keys', () => {
      const expectedKeys: ConfigKey[] = [
        'planSource',
        'maxIterations',
        'maxTokens',
        'defaultModel',
        'autoCommit',
        'branchPrefix',
        'githubRepo',
        'githubLabel',
        'githubMilestone',
        'githubAssignee',
        'localPlanFile',
        'promptTemplate',
        'mcpServers',
        'maxRetriesPerTask',
        'autoPush',
        'pushStrategy',
      ];
      expect(CONFIG_KEYS).toEqual(expectedKeys);
    });
  });
});

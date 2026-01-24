import { describe, it, expect } from 'vitest';
import {
  CREATE_EXAMPLE,
  EDIT_EXAMPLE,
  DELETE_EXAMPLE,
  EXECUTE_EXAMPLE,
  COMPLETE_EXAMPLE,
  ALL_EXAMPLES,
  MINIMAL_EXAMPLES,
  FORMAT_INSTRUCTIONS,
  getPromptExamples,
  getModelStrength,
  getExamplesForModel,
} from './prompt-examples.js';

describe('Prompt Examples', () => {
  describe('example constants', () => {
    it('should have valid CREATE_EXAMPLE with path and content', () => {
      expect(CREATE_EXAMPLE).toContain('[ACTION:CREATE]');
      expect(CREATE_EXAMPLE).toContain('path:');
      expect(CREATE_EXAMPLE).toContain('```bash');
    });

    it('should have valid EDIT_EXAMPLE with OLD and NEW markers', () => {
      expect(EDIT_EXAMPLE).toContain('[ACTION:EDIT]');
      expect(EDIT_EXAMPLE).toContain('path:');
      expect(EDIT_EXAMPLE).toContain('[OLD]');
      expect(EDIT_EXAMPLE).toContain('[NEW]');
    });

    it('should have valid DELETE_EXAMPLE with path', () => {
      expect(DELETE_EXAMPLE).toContain('[ACTION:DELETE]');
      expect(DELETE_EXAMPLE).toContain('path:');
    });

    it('should have valid EXECUTE_EXAMPLE with command', () => {
      expect(EXECUTE_EXAMPLE).toContain('[ACTION:EXECUTE]');
      expect(EXECUTE_EXAMPLE).toContain('command:');
    });

    it('should have valid COMPLETE_EXAMPLE with reason', () => {
      expect(COMPLETE_EXAMPLE).toContain('[ACTION:COMPLETE]');
      expect(COMPLETE_EXAMPLE).toContain('reason:');
    });
  });

  describe('ALL_EXAMPLES', () => {
    it('should include all action types', () => {
      expect(ALL_EXAMPLES).toContain('[ACTION:CREATE]');
      expect(ALL_EXAMPLES).toContain('[ACTION:EDIT]');
      expect(ALL_EXAMPLES).toContain('[ACTION:EXECUTE]');
      expect(ALL_EXAMPLES).toContain('[ACTION:COMPLETE]');
    });
  });

  describe('MINIMAL_EXAMPLES', () => {
    it('should include abbreviated examples', () => {
      expect(MINIMAL_EXAMPLES).toContain('Example CREATE:');
      expect(MINIMAL_EXAMPLES).toContain('Example EDIT:');
      expect(MINIMAL_EXAMPLES).toContain('Example EXECUTE:');
      expect(MINIMAL_EXAMPLES).toContain('Example COMPLETE:');
    });

    it('should be shorter than ALL_EXAMPLES', () => {
      expect(MINIMAL_EXAMPLES.length).toBeLessThan(ALL_EXAMPLES.length);
    });
  });

  describe('FORMAT_INSTRUCTIONS', () => {
    it('should include all action types', () => {
      expect(FORMAT_INSTRUCTIONS).toContain('[ACTION:CREATE]');
      expect(FORMAT_INSTRUCTIONS).toContain('[ACTION:EDIT]');
      expect(FORMAT_INSTRUCTIONS).toContain('[ACTION:EXECUTE]');
      expect(FORMAT_INSTRUCTIONS).toContain('[ACTION:COMPLETE]');
    });

    it('should include important rules', () => {
      expect(FORMAT_INSTRUCTIONS).toContain('Important Rules');
      expect(FORMAT_INSTRUCTIONS).toContain('EXACT text');
    });
  });

  describe('getModelStrength', () => {
    it('should classify Claude models as strong', () => {
      expect(getModelStrength('claude-3-opus')).toBe('strong');
      expect(getModelStrength('claude-sonnet-4.5')).toBe('strong');
      expect(getModelStrength('claude-haiku-4.5')).toBe('strong');
    });

    it('should classify GPT-4o/5 as strong', () => {
      expect(getModelStrength('gpt-4o')).toBe('strong');
      expect(getModelStrength('gpt-5')).toBe('strong');
      expect(getModelStrength('gpt-5.1')).toBe('strong');
    });

    it('should classify GPT-4-turbo as medium', () => {
      expect(getModelStrength('gpt-4-turbo')).toBe('medium');
    });

    it('should classify Gemini as medium', () => {
      expect(getModelStrength('gemini-pro')).toBe('medium');
      expect(getModelStrength('gemini-3-pro-preview')).toBe('medium');
    });

    it('should classify gpt-4.1 (default) as weak', () => {
      expect(getModelStrength('gpt-4.1')).toBe('weak');
    });

    it('should classify unknown models as weak (safe default)', () => {
      expect(getModelStrength('some-unknown-model')).toBe('weak');
      expect(getModelStrength('local-llama')).toBe('weak');
    });
  });

  describe('getPromptExamples', () => {
    it('should return format instructions for strong models', () => {
      const result = getPromptExamples('strong');
      expect(result).toBe(FORMAT_INSTRUCTIONS);
      expect(result).not.toContain('Example CREATE:');
    });

    it('should return format + minimal examples for medium models', () => {
      const result = getPromptExamples('medium');
      expect(result).toContain(FORMAT_INSTRUCTIONS);
      expect(result).toContain('Example CREATE:');
    });

    it('should return format + full examples for weak models', () => {
      const result = getPromptExamples('weak');
      expect(result).toContain(FORMAT_INSTRUCTIONS);
      expect(result).toContain('Detailed Examples');
      expect(result).toContain(CREATE_EXAMPLE);
    });
  });

  describe('getExamplesForModel', () => {
    it('should return appropriate examples for claude', () => {
      const result = getExamplesForModel('claude-3-opus');
      expect(result).toBe(FORMAT_INSTRUCTIONS);
    });

    it('should return detailed examples for gpt-4.1', () => {
      const result = getExamplesForModel('gpt-4.1');
      expect(result).toContain('Detailed Examples');
    });

    it('should return minimal examples for gemini', () => {
      const result = getExamplesForModel('gemini-pro');
      expect(result).toContain('Example CREATE:');
      expect(result).not.toContain('Detailed Examples');
    });
  });
});

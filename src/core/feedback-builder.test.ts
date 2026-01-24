import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackBuilder, createFeedbackBuilder } from './feedback-builder.js';
import type { ExecutionResult } from './action-executor.js';
import type { VerificationResult } from './verification-hooks.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  exec: vi.fn(
    (
      cmd: string,
      _options: unknown,
      callback?: (error: Error | null, result: { stdout: string }) => void
    ) => {
    // If callback provided, use it
    if (typeof callback === 'function') {
      if (cmd.includes('--stat')) {
        callback(null, { stdout: ' file.ts | 10 ++++\n 1 file changed' });
      } else if (cmd.includes('git diff')) {
        callback(null, { stdout: 'diff --git a/file.ts\n+added line' });
      }
    }
    // Return a mock ChildProcess for promise-based usage
      return { stdout: '', stderr: '' };
    }
  ),
}));

describe('FeedbackBuilder', () => {
  let builder: FeedbackBuilder;

  beforeEach(() => {
    builder = new FeedbackBuilder({ cwd: '/test' });
  });

  describe('buildFromActions', () => {
    it('should format successful action results', () => {
      const executionResult: ExecutionResult = {
        results: [
          {
            action: { type: 'CREATE', path: 'test.ts', content: 'code' },
            success: true,
            message: 'Created file: test.ts',
          },
          {
            action: { type: 'EDIT', path: 'app.ts', oldContent: 'old', newContent: 'new' },
            success: true,
            message: 'Edited file: app.ts',
          },
        ],
        allSucceeded: true,
        taskComplete: false,
      };

      const section = builder.buildFromActions(executionResult);

      expect(section.type).toBe('actions');
      expect(section.title).toBe('Action Results');
      expect(section.success).toBe(true);
      expect(section.content).toContain('✓ Created file: test.ts');
      expect(section.content).toContain('✓ Edited file: app.ts');
    });

    it('should format failed action results with error details', () => {
      const executionResult: ExecutionResult = {
        results: [
          {
            action: { type: 'CREATE', path: 'test.ts', content: 'code' },
            success: false,
            message: 'Failed to create: test.ts',
            error: 'Permission denied',
          },
        ],
        allSucceeded: false,
        taskComplete: false,
      };

      const section = builder.buildFromActions(executionResult);

      expect(section.success).toBe(false);
      expect(section.content).toContain('✗ Failed to create: test.ts');
      expect(section.content).toContain('Error: Permission denied');
    });

    it('should include command output for EXECUTE actions', () => {
      const executionResult: ExecutionResult = {
        results: [
          {
            action: { type: 'EXECUTE', command: 'npm test' },
            success: true,
            message: 'Executed: npm test',
            output: 'PASS test.ts\n10 tests passed',
          },
        ],
        allSucceeded: true,
        taskComplete: false,
      };

      const section = builder.buildFromActions(executionResult);

      expect(section.content).toContain('```');
      expect(section.content).toContain('PASS test.ts');
      expect(section.content).toContain('10 tests passed');
    });

    it('should truncate long output', () => {
      const longOutput = Array(100).fill('line').join('\n');
      const executionResult: ExecutionResult = {
        results: [
          {
            action: { type: 'EXECUTE', command: 'npm test' },
            success: true,
            message: 'Executed: npm test',
            output: longOutput,
          },
        ],
        allSucceeded: true,
        taskComplete: false,
      };

      const section = builder.buildFromActions(executionResult);

      expect(section.content).toContain('... (50 more lines)');
    });
  });

  describe('buildFromVerification', () => {
    it('should format passing verification results', () => {
      const results: VerificationResult[] = [
        {
          hook: 'test',
          passed: true,
          message: 'Tests passed',
          durationMs: 1500,
        },
        {
          hook: 'build',
          passed: true,
          message: 'Build succeeded',
          durationMs: 3000,
        },
      ];

      const section = builder.buildFromVerification(results);

      expect(section.type).toBe('verification');
      expect(section.success).toBe(true);
      expect(section.content).toContain('✓ Tests passed (1500ms)');
      expect(section.content).toContain('✓ Build succeeded (3000ms)');
    });

    it('should format failing verification with output', () => {
      const results: VerificationResult[] = [
        {
          hook: 'test',
          passed: false,
          message: 'Tests failed',
          durationMs: 1000,
          output: 'FAIL test.ts\nExpected: true\nReceived: false',
        },
      ];

      const section = builder.buildFromVerification(results);

      expect(section.success).toBe(false);
      expect(section.content).toContain('✗ Tests failed');
      expect(section.content).toContain('Expected: true');
      expect(section.content).toContain('Received: false');
    });

    it('should handle empty verification results', () => {
      const section = builder.buildFromVerification([]);

      expect(section.success).toBe(true);
      expect(section.content).toBe('No verification hooks configured.');
    });
  });

  describe('buildFromGitDiff', () => {
    it('should return null when git diff disabled', async () => {
      const builder = new FeedbackBuilder({
        cwd: '/test',
        includeGitDiff: false,
      });

      const section = await builder.buildFromGitDiff();
      expect(section).toBeNull();
    });
  });

  describe('buildError', () => {
    it('should format Error object', () => {
      const error = new Error('Something went wrong');
      const section = builder.buildError(error);

      expect(section.type).toBe('error');
      expect(section.success).toBe(false);
      expect(section.content).toContain('Something went wrong');
    });

    it('should format error string', () => {
      const section = builder.buildError('Custom error message');

      expect(section.content).toContain('Custom error message');
    });
  });

  describe('buildSuggestion', () => {
    it('should create suggestion section', () => {
      const section = builder.buildSuggestion('Try running tests first');

      expect(section.type).toBe('suggestion');
      expect(section.success).toBe(true);
      expect(section.title).toBe('Suggestion');
      expect(section.content).toBe('Try running tests first');
    });
  });

  describe('buildComplete', () => {
    it('should combine all sections', async () => {
      const actionResult: ExecutionResult = {
        results: [
          {
            action: { type: 'CREATE', path: 'test.ts', content: 'code' },
            success: true,
            message: 'Created test.ts',
          },
        ],
        allSucceeded: true,
        taskComplete: false,
      };

      const verificationResults: VerificationResult[] = [
        {
          hook: 'test',
          passed: true,
          message: 'Tests passed',
          durationMs: 1000,
        },
      ];

      const feedback = await builder.buildComplete(
        actionResult,
        verificationResults,
        { includeGitDiff: false }
      );

      expect(feedback.sections).toHaveLength(2);
      expect(feedback.overallSuccess).toBe(true);
      expect(feedback.taskComplete).toBe(false);
      expect(feedback.formatted).toContain('## Feedback from Previous Iteration');
    });

    it('should detect task complete when all conditions met', async () => {
      const actionResult: ExecutionResult = {
        results: [
          {
            action: { type: 'COMPLETE', reason: 'Done' },
            success: true,
            message: 'Task marked complete',
          },
        ],
        allSucceeded: true,
        taskComplete: true,
      };

      const verificationResults: VerificationResult[] = [
        {
          hook: 'test',
          passed: true,
          message: 'Tests passed',
          durationMs: 1000,
        },
      ];

      const feedback = await builder.buildComplete(
        actionResult,
        verificationResults,
        { includeGitDiff: false }
      );

      expect(feedback.taskComplete).toBe(true);
      expect(feedback.formatted).toContain('✅ **Task verified complete!**');
    });

    it('should not mark complete if verification fails', async () => {
      const actionResult: ExecutionResult = {
        results: [
          {
            action: { type: 'COMPLETE', reason: 'Done' },
            success: true,
            message: 'Task marked complete',
          },
        ],
        allSucceeded: true,
        taskComplete: true,
      };

      const verificationResults: VerificationResult[] = [
        {
          hook: 'test',
          passed: false,
          message: 'Tests failed',
          durationMs: 1000,
        },
      ];

      const feedback = await builder.buildComplete(
        actionResult,
        verificationResults,
        { includeGitDiff: false }
      );

      expect(feedback.taskComplete).toBe(false);
      expect(feedback.formatted).toContain('### Next Steps');
    });

    it('should include suggestion when provided', async () => {
      const feedback = await builder.buildComplete(null, [], {
        includeGitDiff: false,
        suggestion: 'Remember to run tests',
      });

      expect(feedback.sections).toHaveLength(1);
      expect(feedback.sections[0].type).toBe('suggestion');
      expect(feedback.formatted).toContain('Remember to run tests');
    });
  });

  describe('formatForPrompt', () => {
    it('should format sections for prompt inclusion', () => {
      const sections = [
        {
          type: 'actions' as const,
          title: 'Actions',
          content: '✓ Created file',
          success: true,
        },
        {
          type: 'verification' as const,
          title: 'Verification',
          content: '✓ Tests passed',
          success: true,
        },
      ];

      const formatted = builder.formatForPrompt(sections, false);

      expect(formatted).toContain('## Feedback from Previous Iteration');
      expect(formatted).toContain('### Actions');
      expect(formatted).toContain('### Verification');
    });

    it('should show next steps when failures present', () => {
      const sections = [
        {
          type: 'verification' as const,
          title: 'Verification',
          content: '✗ Tests failed',
          success: false,
        },
      ];

      const formatted = builder.formatForPrompt(sections, false);

      expect(formatted).toContain('### Next Steps');
      expect(formatted).toContain('Review the failures');
    });
  });
});

describe('createFeedbackBuilder', () => {
  it('should create builder with default config', () => {
    const builder = createFeedbackBuilder();
    expect(builder).toBeInstanceOf(FeedbackBuilder);
  });

  it('should create builder with custom config', () => {
    const builder = createFeedbackBuilder({
      maxOutputLines: 100,
      includeGitDiff: false,
    });
    expect(builder).toBeInstanceOf(FeedbackBuilder);
  });
});

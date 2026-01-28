/**
 * Model Compatibility Tests
 *
 * Parameterized tests that validate response parsing across
 * different model output styles. Different models may format
 * ACTION blocks slightly differently, and these tests ensure
 * our parser handles common variations.
 *
 * These tests document the CURRENT parser behavior. Any failing
 * tests indicate the parser doesn't support that variation.
 */

import { describe, it, expect } from 'vitest';
import { parseResponse, type ParsedAction } from './response-parser.js';

/**
 * Simulated model output variations
 * Each entry represents a different model's style of formatting ACTION blocks
 */
interface ModelOutputVariation {
  /** Model name for test description */
  model: string;
  /** The response content from the model */
  response: string;
  /** Expected action type */
  expectedType: string;
  /** Expected path (for CREATE/EDIT actions) */
  expectedPath?: string;
  /** Whether parsing should succeed */
  shouldSucceed: boolean;
}

const MODEL_CREATE_VARIATIONS: ModelOutputVariation[] = [
  {
    model: 'gpt-4.1 (standard format)',
    response: `[ACTION:CREATE]
path: src/hello.ts
\`\`\`typescript
export const hello = "world";
\`\`\``,
    expectedType: 'CREATE',
    expectedPath: 'src/hello.ts',
    shouldSucceed: true,
  },
  {
    model: 'claude-sonnet-4.5 (extra whitespace)',
    response: `[ACTION:CREATE]
path:   src/hello.ts  
\`\`\`typescript
export const hello = "world";
\`\`\``,
    expectedType: 'CREATE',
    expectedPath: 'src/hello.ts',
    shouldSucceed: true,
  },
  {
    model: 'gpt-5 (lowercase action)',
    response: `[action:create]
path: src/hello.ts
\`\`\`typescript
export const hello = "world";
\`\`\``,
    expectedType: 'CREATE',
    expectedPath: 'src/hello.ts',
    shouldSucceed: true,
  },
  {
    model: 'gemini (no language hint)',
    response: `[ACTION:CREATE]
path: src/hello.ts
\`\`\`
export const hello = "world";
\`\`\``,
    expectedType: 'CREATE',
    expectedPath: 'src/hello.ts',
    shouldSucceed: true,
  },
  {
    model: 'gpt-4-turbo (with preamble)',
    response: `Sure, I'll create that file for you.

[ACTION:CREATE]
path: src/hello.ts
\`\`\`typescript
export const hello = "world";
\`\`\`

This creates a simple TypeScript module.`,
    expectedType: 'CREATE',
    expectedPath: 'src/hello.ts',
    shouldSucceed: true,
  },
];

const MODEL_EDIT_VARIATIONS: ModelOutputVariation[] = [
  {
    model: 'gpt-4.1 (standard format)',
    response: `[ACTION:EDIT]
path: src/index.ts
[OLD]
const x = 1;
[NEW]
const x = 42;`,
    expectedType: 'EDIT',
    expectedPath: 'src/index.ts',
    shouldSucceed: true,
  },
  {
    model: 'gpt-5 (extra blank lines)',
    response: `[ACTION:EDIT]
path: src/index.ts

[OLD]
const x = 1;

[NEW]
const x = 42;`,
    expectedType: 'EDIT',
    expectedPath: 'src/index.ts',
    shouldSucceed: true,
  },
];

const MODEL_EXECUTE_VARIATIONS: ModelOutputVariation[] = [
  {
    model: 'gpt-4.1 (command field format)',
    response: `[ACTION:EXECUTE]
command: npm test`,
    expectedType: 'EXECUTE',
    shouldSucceed: true,
  },
  {
    model: 'claude-sonnet-4.5 (multiline command)',
    response: `[ACTION:EXECUTE]
command: npm run build && npm test`,
    expectedType: 'EXECUTE',
    shouldSucceed: true,
  },
];

const MODEL_COMPLETE_VARIATIONS: ModelOutputVariation[] = [
  {
    model: 'gpt-4.1 (with reason)',
    response: `[ACTION:COMPLETE]
reason: All tests pass, task complete.`,
    expectedType: 'COMPLETE',
    shouldSucceed: true,
  },
  {
    model: 'claude-sonnet-4.5 (simple reason)',
    response: `[ACTION:COMPLETE]
reason: Successfully implemented the feature.`,
    expectedType: 'COMPLETE',
    shouldSucceed: true,
  },
];

const MODEL_STUCK_VARIATIONS: ModelOutputVariation[] = [
  {
    model: 'gpt-4.1 (full stuck format)',
    response: `[ACTION:STUCK]
attempted: Tried to access external API
blocker: API credentials not available
suggestion: Please provide API credentials`,
    expectedType: 'STUCK',
    shouldSucceed: true,
  },
  {
    model: 'claude-sonnet-4.5 (no suggestion)',
    response: `[ACTION:STUCK]
attempted: Tried to write files
blocker: File system is read-only`,
    expectedType: 'STUCK',
    shouldSucceed: true,
  },
];

describe('Model Compatibility - Response Parsing', () => {
  describe('CREATE action variations', () => {
    it.each(MODEL_CREATE_VARIATIONS)(
      'parses $model correctly',
      ({ response, expectedType, expectedPath, shouldSucceed }) => {
        const result = parseResponse(response);

        if (shouldSucceed) {
          expect(result.hasActions).toBe(true);
          expect(result.actions).toHaveLength(1);
          expect(result.actions[0].type).toBe(expectedType);
          if (expectedPath) {
            expect((result.actions[0] as ParsedAction & { path: string }).path).toBe(expectedPath);
          }
        } else {
          expect(result.hasActions).toBe(false);
        }
      }
    );
  });

  describe('EDIT action variations', () => {
    it.each(MODEL_EDIT_VARIATIONS)(
      'parses $model correctly',
      ({ response, expectedType, expectedPath, shouldSucceed }) => {
        const result = parseResponse(response);

        if (shouldSucceed) {
          expect(result.hasActions).toBe(true);
          expect(result.actions).toHaveLength(1);
          expect(result.actions[0].type).toBe(expectedType);
          if (expectedPath) {
            expect((result.actions[0] as ParsedAction & { path: string }).path).toBe(expectedPath);
          }
        } else {
          expect(result.hasActions).toBe(false);
        }
      }
    );
  });

  describe('EXECUTE action variations', () => {
    it.each(MODEL_EXECUTE_VARIATIONS)(
      'parses $model correctly',
      ({ response, expectedType, shouldSucceed }) => {
        const result = parseResponse(response);

        if (shouldSucceed) {
          expect(result.hasActions).toBe(true);
          expect(result.actions).toHaveLength(1);
          expect(result.actions[0].type).toBe(expectedType);
        } else {
          expect(result.hasActions).toBe(false);
        }
      }
    );
  });

  describe('COMPLETE action variations', () => {
    it.each(MODEL_COMPLETE_VARIATIONS)(
      'parses $model correctly',
      ({ response, expectedType, shouldSucceed }) => {
        const result = parseResponse(response);

        if (shouldSucceed) {
          expect(result.hasActions).toBe(true);
          expect(result.actions).toHaveLength(1);
          expect(result.actions[0].type).toBe(expectedType);
        } else {
          expect(result.hasActions).toBe(false);
        }
      }
    );
  });

  describe('STUCK action variations', () => {
    it.each(MODEL_STUCK_VARIATIONS)(
      'parses $model correctly',
      ({ response, expectedType, shouldSucceed }) => {
        const result = parseResponse(response);

        if (shouldSucceed) {
          expect(result.hasActions).toBe(true);
          expect(result.actions).toHaveLength(1);
          expect(result.actions[0].type).toBe(expectedType);
        } else {
          expect(result.hasActions).toBe(false);
        }
      }
    );
  });

  describe('Multiple actions in single response', () => {
    it('parses multiple actions from verbose model output', () => {
      const response = `I'll implement this in two steps.

First, let me create the file:

[ACTION:CREATE]
path: src/feature.ts
\`\`\`typescript
export function feature() { return true; }
\`\`\`

Now let me run the tests:

[ACTION:EXECUTE]
command: npm test`;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].type).toBe('CREATE');
      expect(result.actions[1].type).toBe('EXECUTE');
    });
  });

  describe('Edge cases across models', () => {
    it('handles Windows-style line endings', () => {
      const response = '[ACTION:CREATE]\r\npath: src/hello.ts\r\n```typescript\r\nconst x = 1;\r\n```';
      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions[0].type).toBe('CREATE');
    });

    it('handles mixed case action types', () => {
      const response = `[Action:Create]
path: src/hello.ts
\`\`\`typescript
const x = 1;
\`\`\``;
      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions[0].type).toBe('CREATE');
    });

    it('rejects malformed action blocks gracefully', () => {
      const response = `[ACTION:UNKNOWN_TYPE]
some content`;
      const result = parseResponse(response);

      // Should either have no valid actions or have errors
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});


/**
 * Response Parser Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseResponse,
  hasCompleteAction,
  getCompleteAction,
  getActionsByType,
  type CreateAction,
  type EditAction,
  type ExecuteAction,
} from './response-parser.js';

describe('Response Parser', () => {
  describe('parseResponse', () => {
    it('should return no actions for plain text response', () => {
      const response = 'This is just some text without any actions.';
      const result = parseResponse(response);

      expect(result.hasActions).toBe(false);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toContain('No action blocks found in response');
    });

    it('should parse a CREATE action', () => {
      const response = `[ACTION:CREATE]
path: src/hello.ts
\`\`\`typescript
export function hello() {
  return 'Hello, world!';
}
\`\`\``;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('CREATE');

      const action = result.actions[0] as CreateAction;
      expect(action.path).toBe('src/hello.ts');
      expect(action.content).toContain("return 'Hello, world!'");
    });

    it('should parse a CREATE action with language hint', () => {
      const response = `[ACTION:CREATE]
path: calculator.sh
\`\`\`bash
#!/bin/bash
echo "Hello"
\`\`\``;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      const action = result.actions[0] as CreateAction;
      expect(action.path).toBe('calculator.sh');
      expect(action.content).toContain('#!/bin/bash');
    });

    it('should parse an EDIT action', () => {
      const response = `[ACTION:EDIT]
path: src/index.ts
[OLD]
const x = 1;
[NEW]
const x = 42;`;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('EDIT');

      const action = result.actions[0] as EditAction;
      expect(action.path).toBe('src/index.ts');
      expect(action.oldContent).toBe('const x = 1;');
      expect(action.newContent).toBe('const x = 42;');
    });

    it('should parse a DELETE action', () => {
      const response = `[ACTION:DELETE]
path: temp/file.txt`;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions[0].type).toBe('DELETE');
      expect(result.actions[0]).toHaveProperty('path', 'temp/file.txt');
    });

    it('should parse an EXECUTE action', () => {
      const response = `[ACTION:EXECUTE]
command: npm test`;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions[0].type).toBe('EXECUTE');

      const action = result.actions[0] as ExecuteAction;
      expect(action.command).toBe('npm test');
    });

    it('should parse a COMPLETE action', () => {
      const response = `[ACTION:COMPLETE]
reason: All tests are passing and the feature is implemented`;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions[0].type).toBe('COMPLETE');
      expect(result.actions[0]).toHaveProperty('reason', 'All tests are passing and the feature is implemented');
    });

    it('should parse multiple actions in sequence', () => {
      const response = `[ACTION:CREATE]
path: src/add.ts
\`\`\`typescript
export const add = (a: number, b: number) => a + b;
\`\`\`

[ACTION:CREATE]
path: src/subtract.ts
\`\`\`typescript
export const subtract = (a: number, b: number) => a - b;
\`\`\`

[ACTION:EXECUTE]
command: npm test

[ACTION:COMPLETE]
reason: Both functions implemented and tested`;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions).toHaveLength(4);
      expect(result.actions[0].type).toBe('CREATE');
      expect(result.actions[1].type).toBe('CREATE');
      expect(result.actions[2].type).toBe('EXECUTE');
      expect(result.actions[3].type).toBe('COMPLETE');
    });

    it('should handle mixed case action types', () => {
      const response = `[ACTION:create]
path: file.txt
\`\`\`
content
\`\`\``;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      expect(result.actions[0].type).toBe('CREATE');
    });

    it('should report errors for malformed CREATE actions', () => {
      const response = `[ACTION:CREATE]
missing path field
\`\`\`
content
\`\`\``;

      const result = parseResponse(response);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing path field');
    });

    it('should report errors for malformed EDIT actions', () => {
      const response = `[ACTION:EDIT]
path: file.txt
no old/new markers here`;

      const result = parseResponse(response);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing [OLD]...[NEW] markers');
    });

    it('should capture free text before action blocks', () => {
      const response = `Here's what I'll do:

[ACTION:CREATE]
path: file.txt
\`\`\`
content
\`\`\``;

      const result = parseResponse(response);

      expect(result.freeText).toContain("Here's what I'll do:");
    });

    it('should handle multiline content in CREATE action', () => {
      const response = `[ACTION:CREATE]
path: script.sh
\`\`\`bash
#!/bin/bash

# This is a comment
echo "Line 1"
echo "Line 2"

if [ "$1" == "test" ]; then
  echo "Testing"
fi
\`\`\``;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      const action = result.actions[0] as CreateAction;
      expect(action.content).toContain('#!/bin/bash');
      expect(action.content).toContain('echo "Line 1"');
      expect(action.content).toContain('if [ "$1" == "test" ]');
    });

    it('should handle multiline content in EDIT action', () => {
      const response = `[ACTION:EDIT]
path: file.ts
[OLD]
function old() {
  return 1;
}
[NEW]
function new() {
  const x = 1;
  const y = 2;
  return x + y;
}`;

      const result = parseResponse(response);

      expect(result.hasActions).toBe(true);
      const action = result.actions[0] as EditAction;
      expect(action.oldContent).toContain('function old()');
      expect(action.newContent).toContain('const x = 1');
      expect(action.newContent).toContain('return x + y');
    });
  });

  describe('hasCompleteAction', () => {
    it('should return true when COMPLETE action exists', () => {
      const result = parseResponse(`[ACTION:COMPLETE]
reason: Done`);

      expect(hasCompleteAction(result)).toBe(true);
    });

    it('should return false when no COMPLETE action', () => {
      const result = parseResponse(`[ACTION:CREATE]
path: file.txt
\`\`\`
content
\`\`\``);

      expect(hasCompleteAction(result)).toBe(false);
    });
  });

  describe('getCompleteAction', () => {
    it('should return the COMPLETE action when present', () => {
      const result = parseResponse(`[ACTION:COMPLETE]
reason: All done`);

      const complete = getCompleteAction(result);
      expect(complete).not.toBeNull();
      expect(complete?.reason).toBe('All done');
    });

    it('should return null when no COMPLETE action', () => {
      const result = parseResponse(`[ACTION:EXECUTE]
command: echo hello`);

      expect(getCompleteAction(result)).toBeNull();
    });
  });

  describe('getActionsByType', () => {
    it('should filter actions by type', () => {
      const response = `[ACTION:CREATE]
path: file1.txt
\`\`\`
content1
\`\`\`

[ACTION:EXECUTE]
command: npm test

[ACTION:CREATE]
path: file2.txt
\`\`\`
content2
\`\`\``;

      const result = parseResponse(response);
      const createActions = getActionsByType<CreateAction>(result, 'CREATE');

      expect(createActions).toHaveLength(2);
      expect(createActions[0].path).toBe('file1.txt');
      expect(createActions[1].path).toBe('file2.txt');
    });
  });
});

/**
 * Verification Hooks Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createVerificationManager, type VerificationHook } from './verification-hooks.js';

describe('VerificationManager', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verification-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should detect npm test script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          test: 'vitest',
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const manager = createVerificationManager({ cwd: tempDir });
      await manager.initialize();

      const hooks = manager.getHooks();
      expect(hooks.some((h) => h.type === 'test' && h.command === 'npm test')).toBe(true);
    });

    it('should detect npm build script', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'tsc',
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const manager = createVerificationManager({ cwd: tempDir });
      await manager.initialize();

      const hooks = manager.getHooks();
      expect(hooks.some((h) => h.type === 'build' && h.command === 'npm run build')).toBe(true);
    });

    it('should detect npm lint script as non-required', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          lint: 'eslint .',
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const manager = createVerificationManager({ cwd: tempDir });
      await manager.initialize();

      const hooks = manager.getHooks();
      const lintHook = hooks.find((h) => h.type === 'lint');
      expect(lintHook).toBeDefined();
      expect(lintHook?.required).toBe(false);
    });

    it('should detect Makefile targets', async () => {
      const makefile = `
.PHONY: test build

test:
\t@echo "Running tests"

build:
\t@echo "Building"
`;
      await fs.writeFile(path.join(tempDir, 'Makefile'), makefile);

      const manager = createVerificationManager({ cwd: tempDir });
      await manager.initialize();

      const hooks = manager.getHooks();
      expect(hooks.some((h) => h.command === 'make test')).toBe(true);
      expect(hooks.some((h) => h.command === 'make build')).toBe(true);
    });

    it('should handle missing package.json gracefully', async () => {
      const manager = createVerificationManager({ cwd: tempDir });
      await manager.initialize();

      // Should not throw, just return empty hooks
      expect(manager.getHooks()).toHaveLength(0);
    });
  });

  describe('addHook', () => {
    it('should add custom hooks', async () => {
      const manager = createVerificationManager({ cwd: tempDir });

      const customHook: VerificationHook = {
        type: 'custom',
        command: 'echo "custom check"',
        name: 'Custom Check',
        required: true,
        timeoutMs: 5000,
      };

      manager.addHook(customHook);

      const hooks = manager.getHooks();
      expect(hooks).toContainEqual(customHook);
    });
  });

  describe('runHook', () => {
    it('should run a passing hook', async () => {
      const manager = createVerificationManager({ cwd: tempDir });

      const hook: VerificationHook = {
        type: 'test',
        command: 'echo "test passed"',
        name: 'Echo Test',
        required: true,
        timeoutMs: 5000,
      };

      const result = await manager.runHook(hook);

      expect(result.passed).toBe(true);
      expect(result.hookType).toBe('test');
      expect(result.output).toContain('test passed');
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should run a failing hook', async () => {
      const manager = createVerificationManager({ cwd: tempDir });

      const hook: VerificationHook = {
        type: 'test',
        command: 'exit 1',
        name: 'Failing Test',
        required: true,
        timeoutMs: 5000,
      };

      const result = await manager.runHook(hook);

      expect(result.passed).toBe(false);
      expect(result.hookType).toBe('test');
      expect(result.error).toBeDefined();
    });

    it('should capture command output', async () => {
      const manager = createVerificationManager({ cwd: tempDir });

      const hook: VerificationHook = {
        type: 'custom',
        command: 'echo "line1" && echo "line2"',
        name: 'Multi-line Output',
        required: false,
        timeoutMs: 5000,
      };

      const result = await manager.runHook(hook);

      expect(result.output).toContain('line1');
      expect(result.output).toContain('line2');
    });

    it('should handle timeout', async () => {
      const manager = createVerificationManager({ cwd: tempDir });

      const hook: VerificationHook = {
        type: 'test',
        command: 'sleep 10',
        name: 'Slow Test',
        required: true,
        timeoutMs: 100, // Very short timeout
      };

      const result = await manager.runHook(hook);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('timed out');
    });
  });

  describe('runAll', () => {
    it('should run all hooks', async () => {
      const manager = createVerificationManager({
        cwd: tempDir,
        hooks: [
          { type: 'test', command: 'echo "test1"', required: true, timeoutMs: 5000 },
          { type: 'build', command: 'echo "build"', required: true, timeoutMs: 5000 },
        ],
      });

      const results = await manager.runAll();

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('should stop on first required failure when configured', async () => {
      const manager = createVerificationManager({
        cwd: tempDir,
        stopOnFirstFailure: true,
        hooks: [
          { type: 'test', command: 'exit 1', name: 'Fail', required: true, timeoutMs: 5000 },
          { type: 'build', command: 'echo "build"', name: 'Build', required: true, timeoutMs: 5000 },
        ],
      });

      const results = await manager.runAll();

      expect(results).toHaveLength(1); // Stopped after first failure
      expect(results[0].passed).toBe(false);
    });

    it('should continue past non-required failures', async () => {
      const manager = createVerificationManager({
        cwd: tempDir,
        stopOnFirstFailure: true,
        hooks: [
          { type: 'lint', command: 'exit 1', name: 'Lint', required: false, timeoutMs: 5000 },
          { type: 'test', command: 'echo "test"', name: 'Test', required: true, timeoutMs: 5000 },
        ],
      });

      const results = await manager.runAll();

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(false); // Lint failed
      expect(results[1].passed).toBe(true); // Test passed
    });
  });

  describe('allRequiredPassed', () => {
    it('should return true when all required hooks pass', async () => {
      const manager = createVerificationManager({
        cwd: tempDir,
        hooks: [
          { type: 'test', command: 'echo "test"', required: true, timeoutMs: 5000 },
          { type: 'build', command: 'echo "build"', required: true, timeoutMs: 5000 },
        ],
      });

      const results = await manager.runAll();

      expect(manager.allRequiredPassed(results)).toBe(true);
    });

    it('should return false when a required hook fails', async () => {
      const manager = createVerificationManager({
        cwd: tempDir,
        stopOnFirstFailure: false,
        hooks: [
          { type: 'test', command: 'exit 1', required: true, timeoutMs: 5000 },
          { type: 'build', command: 'echo "build"', required: true, timeoutMs: 5000 },
        ],
      });

      const results = await manager.runAll();

      expect(manager.allRequiredPassed(results)).toBe(false);
    });

    it('should return true when only non-required hooks fail', async () => {
      const manager = createVerificationManager({
        cwd: tempDir,
        hooks: [
          { type: 'lint', command: 'exit 1', required: false, timeoutMs: 5000 },
          { type: 'test', command: 'echo "test"', required: true, timeoutMs: 5000 },
        ],
      });

      const results = await manager.runAll();

      expect(manager.allRequiredPassed(results)).toBe(true);
    });

    it('should return true when no hooks configured', async () => {
      const manager = createVerificationManager({ cwd: tempDir });

      const results = await manager.runAll();

      expect(manager.allRequiredPassed(results)).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should generate a readable summary', async () => {
      const manager = createVerificationManager({
        cwd: tempDir,
        hooks: [
          { type: 'test', command: 'echo "test"', name: 'Unit Tests', required: true, timeoutMs: 5000 },
          { type: 'build', command: 'echo "build"', name: 'Build', required: true, timeoutMs: 5000 },
        ],
      });

      const results = await manager.runAll();
      const summary = manager.getSummary(results);

      expect(summary).toContain('2 passed');
      expect(summary).toContain('0 failed');
      expect(summary).toContain('✓');
    });

    it('should show failures in summary', async () => {
      const manager = createVerificationManager({
        cwd: tempDir,
        hooks: [
          { type: 'test', command: 'exit 1', name: 'Failing', required: true, timeoutMs: 5000 },
        ],
      });

      const results = await manager.runAll();
      const summary = manager.getSummary(results);

      expect(summary).toContain('0 passed');
      expect(summary).toContain('1 failed');
      expect(summary).toContain('✗');
    });

    it('should handle empty results', () => {
      const manager = createVerificationManager({ cwd: tempDir });

      const summary = manager.getSummary([]);

      expect(summary).toContain('No verification hooks ran');
    });
  });
});

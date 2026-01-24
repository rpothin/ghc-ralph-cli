/**
 * Calculator Integration Tests
 * 
 * These tests validate the calculator.sh script output.
 * Run after the CLI has implemented the calculator script.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { access, chmod } from 'node:fs/promises';
import path from 'node:path';

const execAsync = promisify(exec);

const CALCULATOR_PATH = path.join(__dirname, 'calculator.sh');

describe('Calculator Script', () => {
  beforeAll(async () => {
    // Check if calculator.sh exists
    try {
      await access(CALCULATOR_PATH);
      // Ensure it's executable
      await chmod(CALCULATOR_PATH, 0o755);
    } catch {
      // Script doesn't exist yet - tests will fail with clear message
    }
  });

  async function runCalculator(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execAsync(`bash "${CALCULATOR_PATH}" ${args}`);
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: (execError.stdout ?? '').trim(),
        stderr: (execError.stderr ?? '').trim(),
        exitCode: execError.code ?? 1,
      };
    }
  }

  describe('Addition', () => {
    it('should add two positive numbers', async () => {
      const result = await runCalculator('5 + 3');
      expect(result.stdout).toBe('8');
      expect(result.exitCode).toBe(0);
    });

    it('should add negative numbers', async () => {
      const result = await runCalculator('-5 + 3');
      expect(result.stdout).toBe('-2');
      expect(result.exitCode).toBe(0);
    });

    it('should add zero', async () => {
      const result = await runCalculator('10 + 0');
      expect(result.stdout).toBe('10');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Subtraction', () => {
    it('should subtract two numbers', async () => {
      const result = await runCalculator('10 - 4');
      expect(result.stdout).toBe('6');
      expect(result.exitCode).toBe(0);
    });

    it('should handle negative result', async () => {
      const result = await runCalculator('3 - 10');
      expect(result.stdout).toBe('-7');
      expect(result.exitCode).toBe(0);
    });

    it('should subtract zero', async () => {
      const result = await runCalculator('5 - 0');
      expect(result.stdout).toBe('5');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Multiplication', () => {
    it('should multiply two numbers', async () => {
      const result = await runCalculator('6 x 7');
      expect(result.stdout).toBe('42');
      expect(result.exitCode).toBe(0);
    });

    it('should multiply by zero', async () => {
      const result = await runCalculator('100 x 0');
      expect(result.stdout).toBe('0');
      expect(result.exitCode).toBe(0);
    });

    it('should multiply negative numbers', async () => {
      const result = await runCalculator('-3 x 4');
      expect(result.stdout).toBe('-12');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Division', () => {
    it('should divide two numbers', async () => {
      const result = await runCalculator('20 / 4');
      expect(result.stdout).toBe('5');
      expect(result.exitCode).toBe(0);
    });

    it('should handle integer division', async () => {
      const result = await runCalculator('7 / 2');
      expect(result.stdout).toBe('3');
      expect(result.exitCode).toBe(0);
    });

    it('should handle division by zero', async () => {
      const result = await runCalculator('10 / 0');
      expect(result.stderr).toContain('Division by zero');
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should show usage for missing arguments', async () => {
      const result = await runCalculator('');
      expect(result.stderr).toContain('Usage');
      expect(result.exitCode).not.toBe(0);
    });

    it('should show error for invalid operation', async () => {
      const result = await runCalculator('5 % 3');
      expect(result.stderr).toContain('Invalid operation');
      expect(result.exitCode).not.toBe(0);
    });

    it('should show error for non-numeric input', async () => {
      const result = await runCalculator('abc + 3');
      expect(result.stderr).toContain('numeric');
      expect(result.exitCode).not.toBe(0);
    });
  });
});

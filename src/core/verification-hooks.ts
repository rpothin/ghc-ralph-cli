/**
 * Verification Hooks
 *
 * Implements objective exit criteria for the Ralph loop.
 * The original Ralph pattern requires external, objective verification
 * (tests pass, build succeeds) rather than trusting the AI to say "I'm done".
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { debug, info, warn } from '../utils/index.js';

const execAsync = promisify(exec);

/**
 * Result of running a verification hook
 */
export interface VerificationResult {
  /** Whether verification passed */
  passed: boolean;
  /** The hook that was run */
  hookType: VerificationHookType;
  /** Human-readable message */
  message: string;
  /** Command output (stdout + stderr) */
  output?: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error if verification failed to run */
  error?: string;
}

/**
 * Types of verification hooks
 */
export type VerificationHookType = 'test' | 'build' | 'lint' | 'custom';

/**
 * Configuration for a verification hook
 */
export interface VerificationHook {
  /** Type of hook */
  type: VerificationHookType;
  /** Command to run */
  command: string;
  /** Optional name for display */
  name?: string;
  /** Whether this hook is required to pass */
  required: boolean;
  /** Timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Verification manager configuration
 */
export interface VerificationConfig {
  /** Working directory */
  cwd: string;
  /** Hooks to run */
  hooks: VerificationHook[];
  /** Whether to stop on first failure */
  stopOnFirstFailure: boolean;
}

/**
 * Default hooks based on common project patterns
 */
export function detectDefaultHooks(cwd: string): VerificationHook[] {
  const hooks: VerificationHook[] = [];

  // These will be populated asynchronously, so this returns a starting point
  // The actual detection happens in VerificationManager.initialize()

  return hooks;
}

/**
 * Verification Manager
 * 
 * Runs objective verification hooks after each iteration to determine
 * if the task is actually complete (not just AI-declared complete).
 */
export class VerificationManager {
  private config: VerificationConfig;
  private detectedHooks: VerificationHook[] = [];
  private initialized = false;

  constructor(config: Partial<VerificationConfig> = {}) {
    this.config = {
      cwd: config.cwd ?? process.cwd(),
      hooks: config.hooks ?? [],
      stopOnFirstFailure: config.stopOnFirstFailure ?? true,
    };
  }

  /**
   * Initialize by detecting available verification hooks
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const cwd = this.config.cwd;

    // Detect npm scripts
    try {
      const packageJsonPath = path.join(cwd, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content) as { scripts?: Record<string, string> };

      if (pkg.scripts) {
        // Check for test script
        if (pkg.scripts['test']) {
          this.detectedHooks.push({
            type: 'test',
            command: 'npm test',
            name: 'npm test',
            required: true,
            timeoutMs: 120000, // 2 minutes
          });
        }

        // Check for build script
        if (pkg.scripts['build']) {
          this.detectedHooks.push({
            type: 'build',
            command: 'npm run build',
            name: 'npm build',
            required: true,
            timeoutMs: 120000,
          });
        }

        // Check for lint script
        if (pkg.scripts['lint']) {
          this.detectedHooks.push({
            type: 'lint',
            command: 'npm run lint',
            name: 'npm lint',
            required: false, // Lint failures shouldn't block completion
            timeoutMs: 60000,
          });
        }
      }
    } catch {
      debug('No package.json found or unable to parse');
    }

    // Detect Makefile
    try {
      await fs.access(path.join(cwd, 'Makefile'));
      // Check for common targets
      const makefileContent = await fs.readFile(path.join(cwd, 'Makefile'), 'utf-8');

      if (makefileContent.includes('test:')) {
        this.detectedHooks.push({
          type: 'test',
          command: 'make test',
          name: 'make test',
          required: true,
          timeoutMs: 120000,
        });
      }

      if (makefileContent.includes('build:')) {
        this.detectedHooks.push({
          type: 'build',
          command: 'make build',
          name: 'make build',
          required: true,
          timeoutMs: 120000,
        });
      }
    } catch {
      debug('No Makefile found');
    }

    // Detect pytest
    try {
      await fs.access(path.join(cwd, 'pytest.ini'));
      this.detectedHooks.push({
        type: 'test',
        command: 'pytest',
        name: 'pytest',
        required: true,
        timeoutMs: 120000,
      });
    } catch {
      // Also check for pyproject.toml with pytest
      try {
        const pyprojectPath = path.join(cwd, 'pyproject.toml');
        const content = await fs.readFile(pyprojectPath, 'utf-8');
        if (content.includes('[tool.pytest')) {
          this.detectedHooks.push({
            type: 'test',
            command: 'pytest',
            name: 'pytest',
            required: true,
            timeoutMs: 120000,
          });
        }
      } catch {
        debug('No pytest configuration found');
      }
    }

    this.initialized = true;
    debug(`Detected ${this.detectedHooks.length} verification hooks`);
  }

  /**
   * Get all configured hooks (explicit + detected)
   */
  getHooks(): VerificationHook[] {
    return [...this.config.hooks, ...this.detectedHooks];
  }

  /**
   * Add a custom hook
   */
  addHook(hook: VerificationHook): void {
    this.config.hooks.push(hook);
  }

  /**
   * Run a single verification hook
   */
  async runHook(hook: VerificationHook): Promise<VerificationResult> {
    const startTime = Date.now();
    const name = hook.name ?? hook.command;

    info(`Running verification: ${name}`);

    try {
      const { stdout, stderr } = await execAsync(hook.command, {
        cwd: this.config.cwd,
        timeout: hook.timeoutMs,
        maxBuffer: 5 * 1024 * 1024, // 5MB
      });

      const durationMs = Date.now() - startTime;
      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');

      info(`✓ ${name} passed (${durationMs}ms)`);

      return {
        passed: true,
        hookType: hook.type,
        message: `${name} passed`,
        output: output.trim(),
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const execError = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean };

      const output = (execError.stdout ?? '') + (execError.stderr ? `\nSTDERR:\n${execError.stderr}` : '');
      const message = execError.killed
        ? `${name} timed out after ${hook.timeoutMs}ms`
        : `${name} failed`;

      warn(`✗ ${message}`);

      const result: VerificationResult = {
        passed: false,
        hookType: hook.type,
        message,
        output: output.trim(),
        durationMs,
      };

      if (execError.message) {
        result.error = execError.message;
      }

      return result;
    }
  }

  /**
   * Run all verification hooks
   */
  async runAll(): Promise<VerificationResult[]> {
    await this.initialize();

    const hooks = this.getHooks();
    if (hooks.length === 0) {
      debug('No verification hooks configured');
      return [];
    }

    const results: VerificationResult[] = [];

    for (const hook of hooks) {
      const result = await this.runHook(hook);
      results.push(result);

      // Stop on first failure if configured
      if (!result.passed && hook.required && this.config.stopOnFirstFailure) {
        debug('Stopping verification on first required failure');
        break;
      }
    }

    return results;
  }

  /**
   * Check if all required hooks passed
   */
  allRequiredPassed(results: VerificationResult[]): boolean {
    const hooks = this.getHooks();
    const requiredHooks = hooks.filter((h) => h.required);

    if (requiredHooks.length === 0) {
      return true; // No required hooks = passes by default
    }

    // Check that all required hook types have at least one passing result
    for (const hook of requiredHooks) {
      const matchingResults = results.filter(
        (r) => r.hookType === hook.type && (hook.name ? r.message.includes(hook.name) : true)
      );

      if (matchingResults.length === 0 || !matchingResults.some((r) => r.passed)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get a summary of verification results
   */
  getSummary(results: VerificationResult[]): string {
    if (results.length === 0) {
      return 'No verification hooks ran';
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    const lines: string[] = [`Verification: ${passed} passed, ${failed} failed`];

    for (const result of results) {
      const icon = result.passed ? '✓' : '✗';
      lines.push(`  ${icon} ${result.message} (${result.durationMs}ms)`);
    }

    return lines.join('\n');
  }
}

/**
 * Create a verification manager with custom configuration
 */
export function createVerificationManager(
  config?: Partial<VerificationConfig>
): VerificationManager {
  return new VerificationManager(config);
}

/**
 * CLI Output Utilities
 *
 * Provides consistent, colored console output across the CLI
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { isTTY } from './index.js';

/**
 * Output verbosity level
 */
export type Verbosity = 'quiet' | 'normal' | 'verbose';

let currentVerbosity: Verbosity = 'normal';

/**
 * Set the global verbosity level
 */
export function setVerbosity(level: Verbosity): void {
  currentVerbosity = level;
}

/**
 * Get the current verbosity level
 */
export function getVerbosity(): Verbosity {
  return currentVerbosity;
}

/**
 * Log an info message (only in normal or verbose mode)
 */
export function info(message: string): void {
  if (currentVerbosity !== 'quiet') {
    console.log(chalk.blue('ℹ'), message);
  }
}

/**
 * Log a success message (only in normal or verbose mode)
 */
export function success(message: string): void {
  if (currentVerbosity !== 'quiet') {
    console.log(chalk.green('✔'), message);
  }
}

/**
 * Log a warning message (always shown)
 */
export function warn(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

/**
 * Log an error message (always shown)
 */
export function error(message: string): void {
  console.error(chalk.red('✖'), message);
}

/**
 * Log a debug message (only in verbose mode)
 */
export function debug(message: string): void {
  if (currentVerbosity === 'verbose') {
    console.log(chalk.gray('⬤'), chalk.gray(message));
  }
}

/**
 * Create a spinner for async operations
 */
export function spinner(text: string): Ora {
  return ora({
    text,
    isEnabled: isTTY() && currentVerbosity !== 'quiet',
  });
}

/**
 * Format a title/heading
 */
export function heading(text: string): string {
  return chalk.bold.cyan(text);
}

/**
 * Format a command/code snippet
 */
export function code(text: string): string {
  return chalk.cyan(text);
}

/**
 * Format a dim/secondary text
 */
export function dim(text: string): string {
  return chalk.dim(text);
}

/**
 * Print a banner with the Ralph CLI branding
 */
export function banner(): void {
  if (currentVerbosity === 'quiet') return;

  console.log('');
  console.log(chalk.cyan.bold('  🤖 Ralph CLI'));
  console.log(chalk.dim('  Autonomous agentic coding loops'));
  console.log('');
}

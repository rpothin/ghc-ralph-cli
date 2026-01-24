/**
 * Shared Utilities
 *
 * Common utility functions used across Ralph CLI
 */

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if running in a TTY environment
 */
export function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

/**
 * Get the current platform
 */
export function getPlatform(): 'windows' | 'macos' | 'linux' {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      return 'linux';
  }
}

// Re-export utilities
export * from './output.js';
export * from './shell.js';
export * from './paths.js';
export * from './validation.js';

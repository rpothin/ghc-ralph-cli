/**
 * Path Utilities
 *
 * Cross-platform path handling utilities
 */

import path from 'node:path';
import { getPlatform } from './index.js';

/**
 * Normalize a path for the current platform
 */
export function normalizePath(inputPath: string): string {
  return path.normalize(inputPath);
}

/**
 * Join path segments with platform-appropriate separators
 */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Get the home directory
 */
export function getHomeDir(): string {
  const home = process.env['HOME'] ?? process.env['USERPROFILE'];
  if (!home) {
    throw new Error('Could not determine home directory');
  }
  return home;
}

/**
 * Get the Ralph config directory
 */
export function getConfigDir(): string {
  const platform = getPlatform();

  if (platform === 'windows') {
    const appData = process.env['APPDATA'];
    if (appData) {
      return path.join(appData, 'ralph-cli');
    }
  }

  // XDG Base Directory Specification for Unix-like systems
  const xdgConfig = process.env['XDG_CONFIG_HOME'];
  if (xdgConfig) {
    return path.join(xdgConfig, 'ralph');
  }

  return path.join(getHomeDir(), '.config', 'ralph');
}

/**
 * Get the Ralph local state directory (in the current project)
 */
export function getLocalStateDir(projectRoot?: string): string {
  const root = projectRoot ?? process.cwd();
  return path.join(root, '.ralph');
}

/**
 * Convert a path to use forward slashes (for display/config)
 */
export function toForwardSlashes(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

/**
 * Resolve a path relative to the current working directory
 */
export function resolvePath(inputPath: string): string {
  return path.resolve(inputPath);
}

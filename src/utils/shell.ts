/**
 * Shell Detection Utilities
 *
 * Detect the current shell environment for cross-platform compatibility
 */

import { getPlatform } from './index.js';

/**
 * Supported shell types
 */
export type ShellType = 'bash' | 'zsh' | 'fish' | 'powershell' | 'cmd' | 'unknown';

/**
 * Shell detection result
 */
export interface ShellInfo {
  type: ShellType;
  path: string | undefined;
  isWindows: boolean;
}

/**
 * Detect the current shell environment
 */
export function detectShell(): ShellInfo {
  const platform = getPlatform();
  const isWindows = platform === 'windows';

  if (isWindows) {
    // Check for PowerShell
    const psModulePath = process.env['PSModulePath'];
    if (psModulePath) {
      return {
        type: 'powershell',
        path: process.env['ComSpec'],
        isWindows: true,
      };
    }

    // Default to CMD on Windows
    return {
      type: 'cmd',
      path: process.env['ComSpec'],
      isWindows: true,
    };
  }

  // Unix-like systems
  const shell = process.env['SHELL'] ?? '';

  if (shell.includes('zsh')) {
    return { type: 'zsh', path: shell, isWindows: false };
  }
  if (shell.includes('fish')) {
    return { type: 'fish', path: shell, isWindows: false };
  }
  if (shell.includes('bash')) {
    return { type: 'bash', path: shell, isWindows: false };
  }

  return { type: 'unknown', path: shell || undefined, isWindows: false };
}

/**
 * Get shell-specific configuration file path
 */
export function getShellConfigPath(shellType: ShellType): string | undefined {
  const home = process.env['HOME'] ?? process.env['USERPROFILE'];
  if (!home) return undefined;

  switch (shellType) {
    case 'bash':
      return `${home}/.bashrc`;
    case 'zsh':
      return `${home}/.zshrc`;
    case 'fish':
      return `${home}/.config/fish/config.fish`;
    case 'powershell':
      return undefined; // PowerShell profile location varies
    case 'cmd':
      return undefined;
    default:
      return undefined;
  }
}

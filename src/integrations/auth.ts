/**
 * GitHub Authentication
 *
 * Handles authentication with GitHub for Copilot access
 */

import { execSync } from 'node:child_process';
import { debug, warn } from '../utils/index.js';

/**
 * Authentication result
 */
export interface AuthResult {
  /** Whether authentication succeeded */
  authenticated: boolean;
  /** Authentication token if available */
  token?: string;
  /** Authentication method used */
  method?: 'gh-cli' | 'env-token' | 'none';
  /** Error message if authentication failed */
  error?: string;
}

/**
 * Try to get authentication from the GitHub CLI
 */
function tryGhCliAuth(): AuthResult {
  try {
    // Check if gh is available and authenticated
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (token) {
      debug('Authenticated via GitHub CLI');
      return {
        authenticated: true,
        token,
        method: 'gh-cli',
      };
    }
  } catch {
    debug('GitHub CLI authentication not available');
  }

  return { authenticated: false };
}

/**
 * Try to get authentication from environment variable
 */
function tryEnvAuth(): AuthResult {
  const token = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];

  if (token) {
    debug('Authenticated via environment token');
    return {
      authenticated: true,
      token,
      method: 'env-token',
    };
  }

  return { authenticated: false };
}

/**
 * Get GitHub authentication using available methods
 * Priority: 1. GitHub CLI, 2. Environment variable
 */
export function getGitHubAuth(): AuthResult {
  // Try GitHub CLI first
  const ghCliResult = tryGhCliAuth();
  if (ghCliResult.authenticated) {
    return ghCliResult;
  }

  // Try environment variable
  const envResult = tryEnvAuth();
  if (envResult.authenticated) {
    return envResult;
  }

  // No authentication available
  warn('No GitHub authentication found');
  return {
    authenticated: false,
    method: 'none',
    error: 'No GitHub authentication available. Run "gh auth login" or set GITHUB_TOKEN.',
  };
}

/**
 * Check if GitHub authentication is available
 */
export function isAuthenticated(): boolean {
  return getGitHubAuth().authenticated;
}

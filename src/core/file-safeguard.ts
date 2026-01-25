/**
 * File Safeguard Manager
 *
 * Protects existing files from accidental deletion while allowing
 * cleanup of agent-created files.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { debug, warn } from '../utils/index.js';

const execAsync = promisify(exec);

/**
 * File safeguard configuration
 */
export interface FileSafeguardConfig {
  /** Working directory */
  cwd: string;
  /** Whether to allow deletion of existing files */
  allowDeleteExisting: boolean;
  /** Path to store baseline snapshot */
  baselinePath: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: FileSafeguardConfig = {
  cwd: process.cwd(),
  allowDeleteExisting: false,
  baselinePath: '.ghcralph/baseline-files.json',
};

/**
 * Baseline snapshot data
 */
export interface BaselineSnapshot {
  /** When the snapshot was created */
  createdAt: string;
  /** List of files that existed at session start */
  files: string[];
  /** Number of files in the baseline */
  count: number;
}

/**
 * File operation tracking
 */
export interface FileOperations {
  /** Files that existed before session */
  baselineFiles: Set<string>;
  /** Files created during session */
  createdFiles: Set<string>;
  /** Files modified during session */
  modifiedFiles: Set<string>;
  /** Deletion attempts that were blocked */
  blockedDeletions: string[];
}

/**
 * File Safeguard Manager class
 */
export class FileSafeguardManager {
  private config: FileSafeguardConfig;
  private operations: FileOperations;
  private initialized: boolean = false;

  constructor(config: Partial<FileSafeguardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.operations = {
      baselineFiles: new Set(),
      createdFiles: new Set(),
      modifiedFiles: new Set(),
      blockedDeletions: [],
    };
  }

  private getNormalizedRelativePath(filePath: string): string {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.cwd, filePath);
    return path.relative(this.config.cwd, absolutePath).replace(/\\/g, '/');
  }

  /**
   * Initialize by creating baseline snapshot
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try to load existing baseline
      const loaded = await this.loadBaseline();
      if (loaded) {
        debug('Loaded existing baseline snapshot');
        this.initialized = true;
        return;
      }

      // Create new baseline
      await this.createBaseline();
      this.initialized = true;
    } catch (err) {
      warn('Failed to initialize file safeguards: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * Create baseline snapshot of existing files
   */
  private async createBaseline(): Promise<void> {
    try {
      // Get list of tracked files from git
      const { stdout } = await execAsync('git ls-files', { cwd: this.config.cwd });
      const files = stdout.trim().split('\n').filter(Boolean);

      // Store in memory
      this.operations.baselineFiles = new Set(files);

      // Save to file
      const snapshot: BaselineSnapshot = {
        createdAt: new Date().toISOString(),
        files,
        count: files.length,
      };

      const baselinePath = path.join(this.config.cwd, this.config.baselinePath);
      const baselineDir = path.dirname(baselinePath);

      // Ensure directory exists
      await fs.mkdir(baselineDir, { recursive: true });
      await fs.writeFile(baselinePath, JSON.stringify(snapshot, null, 2));

      debug(`Created baseline with ${files.length} files`);
    } catch (err) {
      debug('Failed to create baseline: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * Load existing baseline from file
   */
  private async loadBaseline(): Promise<boolean> {
    try {
      const baselinePath = path.join(this.config.cwd, this.config.baselinePath);
      const content = await fs.readFile(baselinePath, 'utf-8');
      const snapshot = JSON.parse(content) as BaselineSnapshot;

      this.operations.baselineFiles = new Set(snapshot.files);
      debug(`Loaded baseline with ${snapshot.count} files from ${snapshot.createdAt}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file existed before the session
   */
  isBaselineFile(filePath: string): boolean {
    const relativePath = this.getNormalizedRelativePath(filePath);
    return this.operations.baselineFiles.has(relativePath);
  }

  /**
   * Check if a file was created during this session
   */
  isCreatedFile(filePath: string): boolean {
    const relativePath = this.getNormalizedRelativePath(filePath);
    return this.operations.createdFiles.has(relativePath);
  }

  /**
   * Track a file creation
   */
  trackFileCreation(filePath: string): void {
    const relativePath = this.getNormalizedRelativePath(filePath);
    if (!this.operations.baselineFiles.has(relativePath)) {
      this.operations.createdFiles.add(relativePath);
      debug(`Tracked file creation: ${relativePath}`);
    }
  }

  /**
   * Track a file modification
   */
  trackFileModification(filePath: string): void {
    const relativePath = this.getNormalizedRelativePath(filePath);
    this.operations.modifiedFiles.add(relativePath);
  }

  /**
   * Check if a file can be deleted
   */
  canDelete(filePath: string): boolean {
    // Always allow if override is set
    if (this.config.allowDeleteExisting) {
      return true;
    }

    const relativePath = this.getNormalizedRelativePath(filePath);

    // Allow deletion of files created during session
    if (this.operations.createdFiles.has(relativePath)) {
      return true;
    }

    // Block deletion of baseline files
    if (this.operations.baselineFiles.has(relativePath)) {
      this.operations.blockedDeletions.push(relativePath);
      warn(`Blocked deletion of pre-existing file: ${relativePath}`);
      return false;
    }

    // Allow deletion of unknown files (not in baseline, not tracked as created)
    return true;
  }

  /**
   * Get summary of file operations
   */
  getSummary(): {
    baselineCount: number;
    createdCount: number;
    modifiedCount: number;
    blockedCount: number;
  } {
    return {
      baselineCount: this.operations.baselineFiles.size,
      createdCount: this.operations.createdFiles.size,
      modifiedCount: this.operations.modifiedFiles.size,
      blockedCount: this.operations.blockedDeletions.length,
    };
  }

  /**
   * Get detailed file operation info
   */
  getDetails(): {
    created: string[];
    modified: string[];
    blockedDeletions: string[];
  } {
    return {
      created: Array.from(this.operations.createdFiles),
      modified: Array.from(this.operations.modifiedFiles),
      blockedDeletions: this.operations.blockedDeletions,
    };
  }

  /**
   * Clean up baseline file (call at end of session)
   */
  async cleanup(): Promise<void> {
    try {
      const baselinePath = path.join(this.config.cwd, this.config.baselinePath);
      await fs.unlink(baselinePath);
      debug('Cleaned up baseline file');
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Create a file safeguard manager
 */
export function createFileSafeguardManager(config?: Partial<FileSafeguardConfig>): FileSafeguardManager {
  return new FileSafeguardManager(config);
}

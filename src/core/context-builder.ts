/**
 * Context Builder
 *
 * Builds rich context for AI agent prompts including relevant files,
 * git history, and previous iteration results.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { glob } from 'glob';
import { debug, warn } from '../utils/index.js';
import type { Task } from '../types/index.js';
import type { IterationRecord } from './loop-state.js';
import { getExamplesForModel } from './prompt-examples.js';

const execAsync = promisify(exec);

/**
 * Default Ralph prompt template (simplified per Ralph pattern)
 * The {output_format} placeholder is replaced with model-appropriate examples
 */
const DEFAULT_PROMPT_TEMPLATE = `You are an expert software engineer. Your task is: {task_title}

## Task Description
{task_content}

{state_section}
{context_section}
{previous_progress}
{feedback_section}

{output_format}

## Instructions
- Make small, focused changes
- Test your changes with [ACTION:EXECUTE]
- Use [ACTION:COMPLETE] when tests pass and task is done`;

/**
 * Legacy prompt template with meta info (for backwards compatibility)
 */
const LEGACY_PROMPT_TEMPLATE = `You are an expert software engineer. Your task is: {task_title}

## Task Description
{task_content}

## Current State
- Iteration: {iteration} of {max_iterations}
- Tokens used: {tokens_used} of {max_tokens}

{context_section}
{previous_progress}

## Instructions
- Make small, focused changes
- Test your changes when possible
- Explain your reasoning
- Stop when the task is complete`;

/**
 * Context builder configuration
 */
export interface ContextBuilderConfig {
  /** Maximum tokens to allow for context */
  maxContextTokens: number;
  /** Glob patterns for explicit context files */
  contextGlobs?: string[];
  /** Custom prompt template */
  promptTemplate?: string;
  /** Whether to include git diff in context */
  includeGitDiff?: boolean;
  /** Whether to include git history in context */
  includeGitHistory?: boolean;
  /** Number of git history entries to include */
  gitHistoryLimit?: number;
  /** Whether to include project structure */
  includeProjectStructure?: boolean;
  /** 
   * Fresh context per iteration (Ralph pattern core principle)
   * When true, previous iteration summaries are NOT included.
   * The AI should rely on filesystem state (git diff) instead.
   */
  freshContextPerIteration?: boolean;
  /**
   * Whether to include meta info like iteration counts in prompt.
   * Default: false (Ralph pattern recommendation)
   * Set to true for legacy behavior with iteration/token counts
   */
  includeMetaInfo?: boolean;
  /**
   * Model name for prompt customization.
   * Used to determine how many examples to include.
   * Weaker models get more detailed examples.
   * Default: 'gpt-4.1'
   */
  model?: string;
}

/**
 * Default context builder configuration
 */
const DEFAULT_CONFIG: ContextBuilderConfig = {
  maxContextTokens: 8000,
  includeGitDiff: true,
  includeGitHistory: true,
  gitHistoryLimit: 5,
  includeProjectStructure: true,
  freshContextPerIteration: true, // Ralph pattern: rely on filesystem, not history
  includeMetaInfo: false, // Ralph pattern: don't include iteration/token counts
  model: 'gpt-4.1', // Default model (0x cost multiplier)
};

/**
 * Built context result
 */
export interface BuiltContext {
  /** The complete prompt */
  prompt: string;
  /** Estimated token count */
  estimatedTokens: number;
  /** Files included in context */
  filesIncluded: string[];
  /** Whether context was truncated due to limits */
  truncated: boolean;
}

/**
 * Context builder for creating rich AI prompts
 */
export class ContextBuilder {
  private config: ContextBuilderConfig;
  private cwd: string;

  constructor(config: Partial<ContextBuilderConfig> = {}, cwd?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cwd = cwd ?? process.cwd();
  }

  /**
   * Build a complete context prompt for the current iteration
   */
  async buildContext(
    task: Task,
    iteration: number,
    maxIterations: number,
    tokensUsed: number,
    maxTokens: number,
    previousIterations: IterationRecord[] = [],
    feedbackSection?: string
  ): Promise<BuiltContext> {
    const filesIncluded: string[] = [];
    let truncated = false;

    // Select template based on configuration
    let template: string;
    if (this.config.promptTemplate) {
      template = this.config.promptTemplate;
    } else if (this.config.includeMetaInfo) {
      template = LEGACY_PROMPT_TEMPLATE;
    } else {
      template = DEFAULT_PROMPT_TEMPLATE;
    }

    // Build context sections
    const contextParts: string[] = [];

    // 1. Add explicit context files first (highest priority)
    if (this.config.contextGlobs && this.config.contextGlobs.length > 0) {
      const explicitContext = await this.getExplicitContextFiles();
      if (explicitContext.content) {
        contextParts.push('## Relevant Files\n' + explicitContext.content);
        filesIncluded.push(...explicitContext.files);
      }
    }

    // 2. Add task-relevant files (based on keywords)
    const keywordFiles = await this.findRelevantFiles(task);
    if (keywordFiles.content && !this.exceedsTokenLimit(contextParts.join('\n'), keywordFiles.content)) {
      contextParts.push(keywordFiles.content);
      filesIncluded.push(...keywordFiles.files);
    }

    // 3. Add git diff (current changes) - CRITICAL for Ralph pattern
    // This is the primary way the AI knows what has been done
    if (this.config.includeGitDiff) {
      const gitDiff = await this.getGitDiff();
      if (gitDiff && !this.exceedsTokenLimit(contextParts.join('\n'), gitDiff)) {
        contextParts.push('## Current Changes (git diff)\n```diff\n' + gitDiff + '\n```');
      }
    }

    // 4. Add git history
    if (this.config.includeGitHistory) {
      const gitHistory = await this.getGitHistory();
      if (gitHistory && !this.exceedsTokenLimit(contextParts.join('\n'), gitHistory)) {
        contextParts.push('## Recent Git History\n' + gitHistory);
      }
    }

    // 5. Add project structure overview
    if (this.config.includeProjectStructure) {
      const structure = await this.getProjectStructure();
      if (structure && !this.exceedsTokenLimit(contextParts.join('\n'), structure)) {
        contextParts.push('## Project Structure\n```\n' + structure + '\n```');
      }
    }

    // Build previous progress section
    // In fresh context mode (Ralph pattern), we skip this - rely on git diff instead
    let previousProgress = '';
    if (!this.config.freshContextPerIteration) {
      previousProgress = this.buildPreviousProgress(previousIterations);
    }

    // Build state section (only if includeMetaInfo is true)
    let stateSection = '';
    if (this.config.includeMetaInfo) {
      stateSection = `## Current State
- Iteration: ${iteration} of ${maxIterations}
- Tokens used: ${tokensUsed} of ${maxTokens}`;
    }

    // Build context section
    const contextSection = contextParts.length > 0 
      ? '## Context\n' + contextParts.join('\n\n')
      : '';

    // Get model-appropriate output format examples
    const outputFormat = getExamplesForModel(this.config.model ?? 'gpt-4.1');

    // Build the final prompt
    let prompt = template
      .replace('{task_title}', task.title)
      .replace('{task_content}', task.content)
      .replace('{iteration}', String(iteration))
      .replace('{max_iterations}', String(maxIterations))
      .replace('{tokens_used}', String(tokensUsed))
      .replace('{max_tokens}', String(maxTokens))
      .replace('{state_section}', stateSection)
      .replace('{context_section}', contextSection)
      .replace('{previous_progress}', previousProgress)
      .replace('{feedback_section}', feedbackSection ?? '')
      .replace('{output_format}', outputFormat);

    // Clean up multiple consecutive newlines
    prompt = prompt.replace(/\n{3,}/g, '\n\n').trim();

    // Estimate token count
    const estimatedTokens = this.estimateTokens(prompt);

    // Check if we exceeded limits and need to truncate
    if (estimatedTokens > this.config.maxContextTokens) {
      truncated = true;
      prompt = this.truncatePrompt(prompt);
    }

    return {
      prompt,
      estimatedTokens: this.estimateTokens(prompt),
      filesIncluded,
      truncated,
    };
  }

  /**
   * Get explicit context files from glob patterns
   */
  private async getExplicitContextFiles(): Promise<{ content: string; files: string[] }> {
    if (!this.config.contextGlobs || this.config.contextGlobs.length === 0) {
      return { content: '', files: [] };
    }

    const files: string[] = [];
    const contentParts: string[] = [];

    for (const pattern of this.config.contextGlobs) {
      try {
        const matches = await glob(pattern, { cwd: this.cwd, nodir: true });
        for (const file of matches) {
          try {
            const fullPath = path.join(this.cwd, file);
            const content = await fs.readFile(fullPath, 'utf-8');
            
            // Skip very large files
            if (content.length > 50000) {
              debug(`Skipping large file: ${file}`);
              continue;
            }

            files.push(file);
            contentParts.push(`### ${file}\n\`\`\`\n${content}\n\`\`\``);
          } catch {
            debug(`Failed to read file: ${file}`);
          }
        }
      } catch {
        debug(`Failed to glob pattern: ${pattern}`);
      }
    }

    return {
      content: contentParts.join('\n\n'),
      files,
    };
  }

  /**
   * Find relevant files based on task keywords
   */
  private async findRelevantFiles(task: Task): Promise<{ content: string; files: string[] }> {
    // Extract keywords from task
    const keywords = this.extractKeywords(task.title + ' ' + task.content);
    
    if (keywords.length === 0) {
      return { content: '', files: [] };
    }

    const files: string[] = [];
    const contentParts: string[] = [];

    // Try to find files matching keywords
    for (const keyword of keywords.slice(0, 3)) { // Limit to top 3 keywords
      try {
        // Search for files containing the keyword
        const { stdout } = await execAsync(
          `git grep -l "${keyword}" 2>/dev/null | head -3`,
          { cwd: this.cwd }
        );

        const matchedFiles = stdout.trim().split('\n').filter(Boolean);
        
        for (const file of matchedFiles) {
          if (files.includes(file)) continue;
          
          try {
            const fullPath = path.join(this.cwd, file);
            const content = await fs.readFile(fullPath, 'utf-8');
            
            // Skip large files
            if (content.length > 30000) continue;

            files.push(file);
            contentParts.push(`### ${file}\n\`\`\`\n${content.substring(0, 5000)}${content.length > 5000 ? '\n...(truncated)' : ''}\n\`\`\``);
            
            // Limit total files
            if (files.length >= 5) break;
          } catch {
            // Skip files we can't read
          }
        }

        if (files.length >= 5) break;
      } catch {
        // git grep not available or no matches
      }
    }

    if (contentParts.length === 0) {
      return { content: '', files: [] };
    }

    return {
      content: '## Relevant Files (keyword matches)\n' + contentParts.join('\n\n'),
      files,
    };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this', 'that',
      'these', 'those', 'it', 'its', 'add', 'update', 'create', 'fix', 'implement',
    ]);

    // Extract words
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Return unique words, prioritizing longer ones
    return [...new Set(words)].sort((a, b) => b.length - a.length);
  }

  /**
   * Get current git diff
   */
  private async getGitDiff(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git diff --staged HEAD 2>/dev/null || git diff HEAD 2>/dev/null', {
        cwd: this.cwd,
        maxBuffer: 100000,
      });
      
      const diff = stdout.trim();
      if (!diff) return null;
      
      // Truncate if too long
      if (diff.length > 10000) {
        return diff.substring(0, 10000) + '\n...(truncated)';
      }
      
      return diff;
    } catch {
      return null;
    }
  }

  /**
   * Get recent git history
   */
  private async getGitHistory(): Promise<string | null> {
    try {
      const limit = this.config.gitHistoryLimit ?? 5;
      const { stdout } = await execAsync(
        `git log --oneline -n ${limit} 2>/dev/null`,
        { cwd: this.cwd }
      );
      
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Get project structure overview
   */
  private async getProjectStructure(): Promise<string | null> {
    try {
      // Use find to get directory structure, limited depth
      const { stdout } = await execAsync(
        'find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" | head -50',
        { cwd: this.cwd }
      );
      
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Build previous progress section
   */
  private buildPreviousProgress(iterations: IterationRecord[]): string {
    const successful = iterations.filter(i => i.success && i.summary);
    
    if (successful.length === 0) {
      return '';
    }

    const summaries = successful
      .map(i => `- Iteration ${i.iteration}: ${i.summary}`)
      .join('\n');

    return `## Previous Progress\n${summaries}`;
  }

  /**
   * Check if adding content would exceed token limit
   */
  private exceedsTokenLimit(existing: string, additional: string): boolean {
    const estimatedTokens = this.estimateTokens(existing + additional);
    return estimatedTokens > this.config.maxContextTokens;
  }

  /**
   * Estimate token count (rough approximation: ~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate prompt to fit within limits
   */
  private truncatePrompt(prompt: string): string {
    const maxChars = this.config.maxContextTokens * 4;
    
    if (prompt.length <= maxChars) {
      return prompt;
    }

    warn(`Truncating prompt from ${prompt.length} to ${maxChars} characters`);
    
    // Keep start and end, truncate middle
    const keepStart = Math.floor(maxChars * 0.7);
    const keepEnd = Math.floor(maxChars * 0.25);
    
    return prompt.substring(0, keepStart) + 
      '\n\n...(context truncated due to size limits)...\n\n' +
      prompt.substring(prompt.length - keepEnd);
  }
}

/**
 * Create a context builder with custom configuration
 */
export function createContextBuilder(
  config?: Partial<ContextBuilderConfig>,
  cwd?: string
): ContextBuilder {
  return new ContextBuilder(config, cwd);
}

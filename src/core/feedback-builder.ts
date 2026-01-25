/**
 * Feedback Builder
 *
 * Builds feedback prompts to show the AI the results of its actions.
 * This is a core component of the Ralph pattern - the AI must see
 * actual results (test output, errors, git diff) to iterate effectively.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { debug } from '../utils/index.js';
import type { ExecutionResult } from './action-executor.js';
import type { VerificationResult } from './verification-hooks.js';

const execAsync = promisify(exec);

/**
 * Feedback section types
 */
export type FeedbackSectionType =
  | 'actions'
  | 'verification'
  | 'git-diff'
  | 'error'
  | 'suggestion';

/**
 * A section of feedback
 */
export interface FeedbackSection {
  type: FeedbackSectionType;
  title: string;
  content: string;
  success: boolean;
}

/**
 * Complete feedback for the next iteration
 */
export interface IterationFeedback {
  /** All feedback sections */
  sections: FeedbackSection[];
  /** Overall success status */
  overallSuccess: boolean;
  /** Whether task should be marked complete */
  taskComplete: boolean;
  /** Formatted feedback for prompt */
  formatted: string;
}

/**
 * Feedback builder configuration
 */
export interface FeedbackBuilderConfig {
  /** Working directory */
  cwd: string;
  /** Maximum lines of output to include per section */
  maxOutputLines: number;
  /** Whether to include git diff */
  includeGitDiff: boolean;
  /** Maximum git diff size in characters */
  maxDiffSize: number;
}

const DEFAULT_CONFIG: FeedbackBuilderConfig = {
  cwd: process.cwd(),
  maxOutputLines: 50,
  includeGitDiff: true,
  maxDiffSize: 5000,
};

/**
 * Feedback Builder
 *
 * Creates structured feedback for the AI based on what happened
 * in the previous iteration.
 */
export class FeedbackBuilder {
  private config: FeedbackBuilderConfig;

  constructor(config: Partial<FeedbackBuilderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build feedback from action execution results
   */
  buildFromActions(executionResult: ExecutionResult): FeedbackSection {
    const lines: string[] = [];

    for (const result of executionResult.results) {
      const icon = result.success ? '✓' : '✗';
      lines.push(`${icon} ${result.message}`);

      // Include output for EXECUTE actions or failures
      if (result.output && (result.action.type === 'EXECUTE' || !result.success)) {
        const outputLines = result.output.split('\n');
        const truncated = outputLines.slice(0, this.config.maxOutputLines);
        if (outputLines.length > this.config.maxOutputLines) {
          truncated.push(`... (${outputLines.length - this.config.maxOutputLines} more lines)`);
        }
        lines.push('```');
        lines.push(...truncated);
        lines.push('```');
      }

      // Include error details for failures
      if (!result.success && result.error) {
        lines.push(`  Error: ${result.error}`);
      }
    }

    return {
      type: 'actions',
      title: 'Action Results',
      content: lines.join('\n'),
      success: executionResult.allSucceeded,
    };
  }

  /**
   * Build feedback from verification results
   */
  buildFromVerification(results: VerificationResult[]): FeedbackSection {
    if (results.length === 0) {
      return {
        type: 'verification',
        title: 'Verification',
        content: 'No verification hooks configured.',
        success: true,
      };
    }

    const lines: string[] = [];
    let allPassed = true;

    for (const result of results) {
      const icon = result.passed ? '✓' : '✗';
      lines.push(`${icon} ${result.message} (${result.durationMs}ms)`);

      if (!result.passed) {
        allPassed = false;
        // Include failure output
        if (result.output) {
          const outputLines = result.output.split('\n');
          const truncated = outputLines.slice(-this.config.maxOutputLines); // Last N lines for errors
          if (outputLines.length > this.config.maxOutputLines) {
            lines.push(`... (${outputLines.length - this.config.maxOutputLines} lines omitted)`);
          }
          lines.push('```');
          lines.push(...truncated);
          lines.push('```');
        }
      }
    }

    return {
      type: 'verification',
      title: 'Verification Results',
      content: lines.join('\n'),
      success: allPassed,
    };
  }

  /**
   * Build feedback from current git diff
   */
  async buildFromGitDiff(): Promise<FeedbackSection | null> {
    if (!this.config.includeGitDiff) {
      return null;
    }

    try {
      const { stdout } = await execAsync('git diff --stat HEAD 2>/dev/null', {
        cwd: this.config.cwd,
        maxBuffer: 100000,
      });

      const diffStat = stdout.trim();
      if (!diffStat) {
        return null; // No changes
      }

      // Get actual diff (limited)
      const { stdout: diffContent } = await execAsync('git diff HEAD 2>/dev/null', {
        cwd: this.config.cwd,
        maxBuffer: this.config.maxDiffSize * 2,
      });

      let content = diffContent.trim();
      if (content.length > this.config.maxDiffSize) {
        content = content.substring(0, this.config.maxDiffSize) + '\n... (diff truncated)';
      }

      return {
        type: 'git-diff',
        title: 'Current Changes',
        content: `\`\`\`diff\n${content}\n\`\`\``,
        success: true,
      };
    } catch {
      debug('Failed to get git diff');
      return null;
    }
  }

  /**
   * Build an error feedback section
   */
  buildError(error: Error | string): FeedbackSection {
    const message = error instanceof Error ? error.message : error;
    return {
      type: 'error',
      title: 'Error',
      content: `An error occurred: ${message}`,
      success: false,
    };
  }

  /**
   * Build a suggestion section
   */
  buildSuggestion(suggestion: string): FeedbackSection {
    return {
      type: 'suggestion',
      title: 'Suggestion',
      content: suggestion,
      success: true,
    };
  }

  /**
   * Combine sections into complete iteration feedback
   */
  async buildComplete(
    actionResult: ExecutionResult | null,
    verificationResults: VerificationResult[],
    options: { includeGitDiff?: boolean; suggestion?: string } = {}
  ): Promise<IterationFeedback> {
    const sections: FeedbackSection[] = [];

    // Add action results
    if (actionResult) {
      sections.push(this.buildFromActions(actionResult));
    }

    // Add verification results
    if (verificationResults.length > 0) {
      sections.push(this.buildFromVerification(verificationResults));
    }

    // Add git diff if requested
    if (options.includeGitDiff !== false) {
      const diffSection = await this.buildFromGitDiff();
      if (diffSection) {
        sections.push(diffSection);
      }
    }

    // Add suggestion if provided
    if (options.suggestion) {
      sections.push(this.buildSuggestion(options.suggestion));
    }

    // Calculate overall status
    const overallSuccess = sections.every((s) => s.success);
    const verificationPassed = verificationResults.every((r) => r.passed);
    const taskComplete =
      actionResult?.taskComplete === true && verificationPassed;

    // Format for prompt
    const formatted = this.formatForPrompt(sections, taskComplete);

    return {
      sections,
      overallSuccess,
      taskComplete,
      formatted,
    };
  }

  /**
   * Format feedback sections for inclusion in prompt
   */
  formatForPrompt(sections: FeedbackSection[], taskComplete: boolean): string {
    const lines: string[] = ['## Feedback from Previous Iteration'];

    if (taskComplete) {
      lines.push('');
      lines.push('✅ **Task verified complete!** All actions succeeded and verification passed.');
      lines.push('');
    }

    for (const section of sections) {
      lines.push('');
      lines.push(`### ${section.title}`);
      lines.push(section.content);
    }

    if (!taskComplete && sections.some((s) => !s.success)) {
      lines.push('');
      lines.push('### Next Steps');
      lines.push('Review the failures above and continue working on the task.');
      lines.push('Use [ACTION:EXECUTE] to investigate issues if needed.');
    }

    return lines.join('\n');
  }
}

/**
 * Create a feedback builder with custom configuration
 */
export function createFeedbackBuilder(
  config?: Partial<FeedbackBuilderConfig>
): FeedbackBuilder {
  return new FeedbackBuilder(config);
}

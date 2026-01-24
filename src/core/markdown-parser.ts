/**
 * Markdown Parser
 *
 * Parse Markdown files with task lists and YAML frontmatter
 */

import type { Task } from '../types/index.js';

/**
 * Parsed task from Markdown
 */
export interface ParsedMarkdownTask {
  /** Task ID (generated from line number) */
  id: string;
  /** Task title (checkbox text) */
  title: string;
  /** Full task content (multi-line if present) */
  content: string;
  /** Whether the task is completed (checkbox checked) */
  completed: boolean;
  /** Line number in the source file */
  lineNumber: number;
  /** Indentation level (for nested tasks) */
  indentLevel: number;
  /** Parent task ID if nested */
  parentId?: string;
  /** Metadata from frontmatter or inline */
  metadata?: Record<string, unknown>;
}

/**
 * Parsed Markdown document
 */
export interface ParsedMarkdownPlan {
  /** Frontmatter metadata */
  frontmatter?: Record<string, unknown>;
  /** All parsed tasks */
  tasks: ParsedMarkdownTask[];
  /** Raw content */
  rawContent: string;
}

/**
 * Regex for matching task list items
 * Matches: "- [ ] Task" or "- [x] Task" with optional indentation
 */
const TASK_REGEX = /^(\s*)-\s*\[([ xX])\]\s*(.+)$/;

/**
 * Regex for matching YAML frontmatter
 */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse YAML frontmatter (simple key: value parsing)
 */
function parseFrontmatter(frontmatterStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value: unknown = line.substring(colonIndex + 1).trim();

      // Simple type coercion
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);

      result[key] = value;
    }
  }

  return result;
}

/**
 * Parse a Markdown file content for tasks
 */
export function parseMarkdownPlan(content: string): ParsedMarkdownPlan {
  const result: ParsedMarkdownPlan = {
    tasks: [],
    rawContent: content,
  };

  // Extract frontmatter if present
  const frontmatterMatch = content.match(FRONTMATTER_REGEX);
  let contentStart = 0;

  if (frontmatterMatch) {
    result.frontmatter = parseFrontmatter(frontmatterMatch[1] ?? '');
    contentStart = frontmatterMatch[0].length;
  }

  // Parse lines for tasks
  const lines = content.substring(contentStart).split('\n');
  const taskStack: string[] = []; // Stack for tracking parent tasks

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const match = line.match(TASK_REGEX);
    if (match) {
      const indentStr = match[1] ?? '';
      const checkbox = match[2];
      const title = match[3]?.trim() ?? '';

      // Calculate indent level (assuming 2 spaces per level)
      const indentLevel = Math.floor(indentStr.length / 2);

      // Adjust task stack for current indent level
      while (taskStack.length > indentLevel) {
        taskStack.pop();
      }

      const taskId = `task-${i + 1}`;
      const parentId = taskStack.length > 0 ? taskStack[taskStack.length - 1] : undefined;

      const task: ParsedMarkdownTask = {
        id: taskId,
        title,
        content: title, // Initial content is just the title
        completed: checkbox?.toLowerCase() === 'x',
        lineNumber: i + 1 + (frontmatterMatch ? frontmatterMatch[0].split('\n').length - 1 : 0),
        indentLevel,
      };

      if (parentId !== undefined) {
        task.parentId = parentId;
      }

      result.tasks.push(task);

      // Update stack for potential child tasks
      if (taskStack.length === indentLevel) {
        taskStack.push(taskId);
      } else {
        taskStack[indentLevel] = taskId;
      }
    }
  }

  return result;
}

/**
 * Convert parsed Markdown task to Task type
 */
export function toTask(parsed: ParsedMarkdownTask, source: 'local' | 'github' = 'local'): Task {
  return {
    id: parsed.id,
    title: parsed.title,
    content: parsed.content,
    status: parsed.completed ? 'completed' : 'pending',
    source,
  };
}

/**
 * Update a checkbox in Markdown content
 */
export function updateTaskCheckbox(
  content: string,
  lineNumber: number,
  completed: boolean
): string {
  const lines = content.split('\n');
  const lineIndex = lineNumber - 1;

  if (lineIndex >= 0 && lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (line) {
      const newCheckbox = completed ? '[x]' : '[ ]';
      lines[lineIndex] = line.replace(/\[([ xX])\]/, newCheckbox);
    }
  }

  return lines.join('\n');
}

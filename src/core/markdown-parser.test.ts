/**
 * Markdown Parser Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseMarkdownPlan,
  toTask,
  updateTaskCheckbox,
} from './markdown-parser.js';

describe('Markdown Parser', () => {
  describe('parseMarkdownPlan', () => {
    it('should parse simple task list', () => {
      const content = `# My Tasks

- [ ] First task
- [ ] Second task
- [x] Completed task`;

      const result = parseMarkdownPlan(content);

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0]?.title).toBe('First task');
      expect(result.tasks[0]?.completed).toBe(false);
      expect(result.tasks[1]?.title).toBe('Second task');
      expect(result.tasks[2]?.title).toBe('Completed task');
      expect(result.tasks[2]?.completed).toBe(true);
    });

    it('should parse YAML frontmatter', () => {
      const content = `---
title: Project Plan
priority: high
count: 5
active: true
---

- [ ] Task with frontmatter`;

      const result = parseMarkdownPlan(content);

      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter?.title).toBe('Project Plan');
      expect(result.frontmatter?.priority).toBe('high');
      expect(result.frontmatter?.count).toBe(5);
      expect(result.frontmatter?.active).toBe(true);
      expect(result.tasks).toHaveLength(1);
    });

    it('should handle nested tasks with indentation', () => {
      const content = `- [ ] Parent task
  - [ ] Child task 1
  - [ ] Child task 2
    - [ ] Grandchild task
- [ ] Another parent`;

      const result = parseMarkdownPlan(content);

      expect(result.tasks).toHaveLength(5);
      expect(result.tasks[0]?.indentLevel).toBe(0);
      expect(result.tasks[0]?.parentId).toBeUndefined();
      expect(result.tasks[1]?.indentLevel).toBe(1);
      expect(result.tasks[1]?.parentId).toBe('task-1');
      expect(result.tasks[3]?.indentLevel).toBe(2);
      expect(result.tasks[4]?.indentLevel).toBe(0);
    });

    it('should handle uppercase X in checkboxes', () => {
      const content = `- [X] Task with uppercase X
- [x] Task with lowercase x`;

      const result = parseMarkdownPlan(content);

      expect(result.tasks[0]?.completed).toBe(true);
      expect(result.tasks[1]?.completed).toBe(true);
    });

    it('should preserve raw content', () => {
      const content = `# Tasks\n- [ ] Task one`;
      const result = parseMarkdownPlan(content);

      expect(result.rawContent).toBe(content);
    });

    it('should handle empty content', () => {
      const result = parseMarkdownPlan('');
      expect(result.tasks).toHaveLength(0);
      expect(result.frontmatter).toBeUndefined();
    });

    it('should handle content with no tasks', () => {
      const content = `# Just a heading

Some paragraph text.

Another paragraph.`;

      const result = parseMarkdownPlan(content);
      expect(result.tasks).toHaveLength(0);
    });
  });

  describe('toTask', () => {
    it('should convert parsed task to Task type', () => {
      const parsed = {
        id: 'task-1',
        title: 'Test task',
        content: 'Test task content',
        completed: false,
        lineNumber: 5,
        indentLevel: 0,
      };

      const task = toTask(parsed);

      expect(task.id).toBe('task-1');
      expect(task.title).toBe('Test task');
      expect(task.content).toBe('Test task content');
      expect(task.status).toBe('pending');
      expect(task.source).toBe('local');
    });

    it('should set status to completed for completed tasks', () => {
      const parsed = {
        id: 'task-2',
        title: 'Completed task',
        content: 'Done',
        completed: true,
        lineNumber: 10,
        indentLevel: 0,
      };

      const task = toTask(parsed);
      expect(task.status).toBe('completed');
    });

    it('should use github source when specified', () => {
      const parsed = {
        id: 'task-3',
        title: 'GitHub task',
        content: 'From GitHub',
        completed: false,
        lineNumber: 1,
        indentLevel: 0,
      };

      const task = toTask(parsed, 'github');
      expect(task.source).toBe('github');
    });
  });

  describe('updateTaskCheckbox', () => {
    it('should mark task as completed', () => {
      const content = `- [ ] Task one
- [ ] Task two
- [ ] Task three`;

      const updated = updateTaskCheckbox(content, 2, true);

      expect(updated).toContain('- [ ] Task one');
      expect(updated).toContain('- [x] Task two');
      expect(updated).toContain('- [ ] Task three');
    });

    it('should mark task as incomplete', () => {
      const content = `- [x] Task one
- [x] Task two`;

      const updated = updateTaskCheckbox(content, 1, false);

      expect(updated).toContain('- [ ] Task one');
      expect(updated).toContain('- [x] Task two');
    });

    it('should handle uppercase X checkboxes', () => {
      const content = `- [X] Uppercase task`;
      const updated = updateTaskCheckbox(content, 1, false);

      expect(updated).toBe('- [ ] Uppercase task');
    });

    it('should handle out of bounds line numbers gracefully', () => {
      const content = `- [ ] Only task`;
      const updated = updateTaskCheckbox(content, 100, true);

      expect(updated).toBe(content);
    });
  });
});

/**
 * Loop Events Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { LoopEventEmitter, type WarningType } from './loop-events.js';
import type { Task } from '../types/index.js';
import type { FullLoopState, IterationRecord } from './loop-state.js';

describe('LoopEventEmitter', () => {
  const createMockTask = (): Task => ({
    id: 'test-1',
    title: 'Test Task',
    content: 'Test content',
    status: 'pending',
    source: 'local',
  });

  const createMockState = (): FullLoopState => ({
    task: createMockTask(),
    iteration: 1,
    status: 'running',
    tokensUsed: 100,
    startedAt: new Date(),
    iterations: [],
  });

  const createMockIterationRecord = (): IterationRecord => ({
    iteration: 1,
    startedAt: new Date(),
    endedAt: new Date(),
    tokensUsed: 50,
    success: true,
    summary: 'Completed step 1',
  });

  describe('emit and on', () => {
    it('should emit and receive start event', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      const task = createMockTask();

      emitter.on('start', listener);
      emitter.emit('start', task);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(task);
    });

    it('should emit and receive iterationStart event', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      const state = createMockState();

      emitter.on('iterationStart', listener);
      emitter.emit('iterationStart', 1, state);

      expect(listener).toHaveBeenCalledWith(1, state);
    });

    it('should emit and receive iterationEnd event', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      const record = createMockIterationRecord();
      const state = createMockState();

      emitter.on('iterationEnd', listener);
      emitter.emit('iterationEnd', record, state);

      expect(listener).toHaveBeenCalledWith(record, state);
    });

    it('should emit and receive complete event', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      const state = createMockState();
      state.status = 'completed';

      emitter.on('complete', listener);
      emitter.emit('complete', state);

      expect(listener).toHaveBeenCalledWith(state);
    });

    it('should emit and receive error event', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      const error = new Error('Test error');
      const state = createMockState();

      emitter.on('error', listener);
      emitter.emit('error', error, state);

      expect(listener).toHaveBeenCalledWith(error, state);
    });

    it('should emit and receive warning event', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      const state = createMockState();
      const warningType: WarningType = 'iteration-threshold';

      emitter.on('warning', listener);
      emitter.emit('warning', warningType, 'Approaching iteration limit', state);

      expect(listener).toHaveBeenCalledWith(warningType, 'Approaching iteration limit', state);
    });

    it('should emit and receive pause/resume events', () => {
      const emitter = new LoopEventEmitter();
      const pauseListener = vi.fn();
      const resumeListener = vi.fn();
      const state = createMockState();

      emitter.on('pause', pauseListener);
      emitter.on('resume', resumeListener);

      emitter.emit('pause', state);
      emitter.emit('resume', state);

      expect(pauseListener).toHaveBeenCalledWith(state);
      expect(resumeListener).toHaveBeenCalledWith(state);
    });
  });

  describe('once', () => {
    it('should only receive event once', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      const task = createMockTask();

      emitter.once('start', listener);
      emitter.emit('start', task);
      emitter.emit('start', task);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('should remove event listener', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      const task = createMockTask();

      emitter.on('start', listener);
      emitter.off('start', listener);
      emitter.emit('start', task);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('multiple listeners', () => {
    it('should support multiple listeners for same event', () => {
      const emitter = new LoopEventEmitter();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const task = createMockTask();

      emitter.on('start', listener1);
      emitter.on('start', listener2);
      emitter.emit('start', task);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('tokenUsage event', () => {
    it('should emit token usage with current and total', () => {
      const emitter = new LoopEventEmitter();
      const listener = vi.fn();
      
      const currentUsage = { prompt: 100, completion: 50, total: 150 };
      const totalUsage = { prompt: 500, completion: 250, total: 750 };

      emitter.on('tokenUsage', listener);
      emitter.emit('tokenUsage', currentUsage, totalUsage);

      expect(listener).toHaveBeenCalledWith(currentUsage, totalUsage);
    });
  });
});

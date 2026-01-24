import { describe, it, expect, beforeEach } from 'vitest';
import { LoopEngine } from './loop-engine.js';
import type { Task } from '../types/index.js';

const createTask = (): Task => ({
  id: 'task-1',
  title: 'Test task',
  content: 'Do a thing',
  status: 'pending',
  source: 'local',
});

interface AgentOverrides {
  initialized?: boolean;
  initialize?: () => Promise<boolean>;
  execute?: () => Promise<{ success: boolean; content?: string; tokenUsage?: { totalTokens: number } }>;
}

const createAgent = (
  overrides?: AgentOverrides
): {
  isInitialized: () => boolean;
  initialize: () => Promise<boolean>;
  execute: () => Promise<{ success: boolean; content?: string; tokenUsage?: { totalTokens: number } }>;
  getTokenUsage: () => { promptTokens: number; completionTokens: number; totalTokens: number };
} => {
  const state = {
    initialized: overrides?.initialized ?? true,
  };

  return {
    isInitialized: (): boolean => state.initialized,
    initialize: overrides?.initialize ?? (async (): Promise<boolean> => {
      state.initialized = true;
      return true;
    }),
    execute:
      overrides?.execute ??
      (async (): Promise<{ success: boolean; content?: string; tokenUsage?: { totalTokens: number } }> => ({
        success: true,
        content: '[ACTION:COMPLETE]\nreason: Done',
        tokenUsage: { totalTokens: 10 },
      })),
    getTokenUsage: (): { promptTokens: number; completionTokens: number; totalTokens: number } => ({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }),
  };
};

const createEngine = (agentOverrides?: AgentOverrides): LoopEngine => {
  const agent = createAgent(agentOverrides) as unknown as Parameters<typeof LoopEngine>[0];
  return new LoopEngine(agent, {
    runVerification: false,
    executeActions: false,
    iterationDelayMs: 0,
  });
};

describe('LoopEngine', () => {
  let task: Task;

  beforeEach((): void => {
    task = createTask();
  });

  it('initializes the agent when needed', async (): Promise<void> => {
    let initialized = false;
    const engine = createEngine({
      initialized: false,
      initialize: async (): Promise<boolean> => {
        initialized = true;
        return true;
      },
    });

    const state = await engine.start(task);

    expect(initialized).toBe(true);
    expect(state.task.status).toBe('completed');
    expect(state.status).toBe('completed');
  });

  it('stops when a COMPLETE action is returned without verification', async (): Promise<void> => {
    const engine = createEngine();

    const state = await engine.start(task);

    expect(state.task.status).toBe('completed');
    expect(state.status).toBe('completed');
    expect(state.iterations.length).toBe(1);
  });

  it('marks failure when agent initialization fails', async (): Promise<void> => {
    const engine = createEngine({
      initialized: false,
      initialize: async (): Promise<boolean> => false,
    });

    await expect(engine.start(task)).rejects.toThrow('Failed to initialize Copilot agent');

    const state = engine.getState();
    expect(state?.status).toBe('failed');
    expect(state?.task.status).toBe('in-progress');
  });
});

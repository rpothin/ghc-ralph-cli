import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CopilotAgent } from './copilot-agent.js';

let mockSendAndWait:
  | ((args: { prompt: string }) => Promise<{ type: string; data: { content?: string } } | undefined>)
  | null = null;

let mockListModels: (() => Promise<Array<{ id: string; name: string; capabilities: object }>>) | null = null;

vi.mock(
  '@github/copilot-sdk',
  (): {
    CopilotClient: new () => {
      start: () => Promise<void>;
      stop: () => Promise<void>;
      listModels: () => Promise<Array<{ id: string; name: string; capabilities: object }>>;
      createSession: () => Promise<{
        sendAndWait: (
          args: { prompt: string },
          timeout?: number
        ) => Promise<{ type: string; data: { content?: string } } | undefined>;
        destroy: () => Promise<void>;
      }>;
    };
  } => {
    return {
      CopilotClient: class {
        async start(): Promise<void> {}
        async stop(): Promise<void> {}
        async listModels(): Promise<Array<{ id: string; name: string; capabilities: object }>> {
          if (mockListModels) {
            return await mockListModels();
          }
          return [];
        }
        async createSession(): Promise<{
          sendAndWait: (
            args: { prompt: string },
            timeout?: number
          ) => Promise<{ type: string; data: { content?: string } } | undefined>;
          destroy: () => Promise<void>;
        }> {
          return {
            sendAndWait: async (args: { prompt: string }): Promise<{ type: string; data: { content?: string } } | undefined> => {
              if (mockSendAndWait) {
                return await mockSendAndWait(args);
              }
              return undefined;
            },
            destroy: async (): Promise<void> => {},
          };
        }
      },
    };
  }
);

vi.mock(
  './auth.js',
  (): { getGitHubAuth: () => { authenticated: boolean; token: string; method: string } } => ({
    getGitHubAuth: (): { authenticated: boolean; token: string; method: string } => ({
      authenticated: true,
      token: 'token',
      method: 'env-token',
    }),
  })
);

describe('CopilotAgent', () => {
  beforeEach((): void => {
    mockSendAndWait = null;
    mockListModels = null;
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('initializes and executes a prompt', async (): Promise<void> => {
    const agent = new CopilotAgent({ model: 'gpt-4.1' });

    const initialized = await agent.initialize();
    expect(initialized).toBe(true);

    mockSendAndWait = async (): Promise<{ type: string; data: { content?: string } } | undefined> => {
      return { type: 'assistant.message', data: { content: 'Hello' } };
    };

    const result = await agent.execute('Say hello');

    expect(result.success).toBe(true);
    expect(result.content).toContain('Hello');
    expect(result.tokenUsage?.totalTokens).toBeGreaterThan(0);
  });

  it('returns failure after retries when execution errors', async (): Promise<void> => {
    const agent = new CopilotAgent({ model: 'gpt-4.1', maxRetries: 2, retryDelayMs: 1 });

    await agent.initialize();

    mockSendAndWait = async (): Promise<{ type: string; data: { content?: string } } | undefined> => {
      throw new Error('Boom');
    };

    const result = await agent.execute('fail');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Boom');
  });

  describe('listAvailableModels', () => {
    it('returns models from SDK when available', async (): Promise<void> => {
      mockListModels = async () => [
        { id: 'gpt-4.1', name: 'GPT-4.1', capabilities: { supports: { vision: false } } },
        { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', capabilities: { supports: { vision: true } } },
      ];

      const models = await CopilotAgent.fetchAvailableModels();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('gpt-4.1');
      expect(models[1].id).toBe('claude-sonnet-4.5');
    });

    it('returns empty array when SDK fetch fails', async (): Promise<void> => {
      mockListModels = async () => {
        throw new Error('Network error');
      };

      const models = await CopilotAgent.fetchAvailableModels();

      expect(models).toEqual([]);
    });

    it('instance method returns models from existing client', async (): Promise<void> => {
      const agent = new CopilotAgent({ model: 'gpt-4.1' });
      await agent.initialize();

      mockListModels = async () => [
        { id: 'gpt-5', name: 'GPT-5', capabilities: { supports: { vision: true } } },
      ];

      const models = await agent.listAvailableModels();

      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('gpt-5');
    });
  });
});

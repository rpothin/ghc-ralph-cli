import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CopilotAgent } from './copilot-agent.js';

let mockSendAndWait:
  | ((args: { prompt: string }) => Promise<{ type: string; data: { content?: string } } | undefined>)
  | null = null;

vi.mock(
  '@github/copilot-sdk',
  (): {
    CopilotClient: new () => {
      start: () => Promise<void>;
      stop: () => Promise<void>;
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
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CopilotAgent } from './copilot-agent.js';

let mockOn:
  | ((handler: (event: { type: string; data: { content?: string; message?: string } }) => void) => void)
  | null = null;
let mockSend: ((args: { prompt: string }) => Promise<void>) | null = null;

vi.mock(
  '@github/copilot-sdk',
  (): {
    CopilotClient: new () => {
      start: () => Promise<void>;
      stop: () => Promise<void>;
      createSession: () => Promise<{
        on: (handler: (event: { type: string; data: { content?: string; message?: string } }) => void) => void;
        send: (args: { prompt: string }) => Promise<void>;
        destroy: () => Promise<void>;
      }>;
    };
  } => {
    return {
      CopilotClient: class {
        async start(): Promise<void> {}
        async stop(): Promise<void> {}
        async createSession(): Promise<{
          on: (handler: (event: { type: string; data: { content?: string; message?: string } }) => void) => void;
          send: (args: { prompt: string }) => Promise<void>;
          destroy: () => Promise<void>;
        }> {
          return {
            on: (
              handler: (event: { type: string; data: { content?: string; message?: string } }) => void
            ): void => {
              mockOn = handler;
            },
            send: async (args: { prompt: string }): Promise<void> => {
              if (mockSend) {
                await mockSend(args);
              }
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
    mockOn = null;
    mockSend = null;
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('initializes and executes a prompt', async (): Promise<void> => {
    const agent = new CopilotAgent({ model: 'gpt-4.1' });

    const initialized = await agent.initialize();
    expect(initialized).toBe(true);

    mockSend = async (): Promise<void> => {
      if (mockOn) {
        mockOn({ type: 'assistant.message', data: { content: 'Hello' } });
        mockOn({ type: 'session.idle', data: {} });
      }
    };

    const result = await agent.execute('Say hello');

    expect(result.success).toBe(true);
    expect(result.content).toContain('Hello');
    expect(result.tokenUsage?.totalTokens).toBeGreaterThan(0);
  });

  it('returns failure after retries when execution errors', async (): Promise<void> => {
    const agent = new CopilotAgent({ model: 'gpt-4.1', maxRetries: 2, retryDelayMs: 1 });

    await agent.initialize();

    mockSend = async (): Promise<void> => {
      if (mockOn) {
        mockOn({ type: 'session.error', data: { message: 'Boom' } });
      }
    };

    const result = await agent.execute('fail');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Boom');
  });
});

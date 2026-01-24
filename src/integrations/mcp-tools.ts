/**
 * MCP Tool Extension Support
 *
 * Allows users to extend Ralph with custom MCP (Model Context Protocol) tools.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { debug, warn, info } from '../utils/index.js';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Name of the MCP server */
  name: string;
  /** Command to run the server */
  command: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Transport type (stdio or http) */
  transport?: 'stdio' | 'http';
  /** HTTP endpoint (for http transport) */
  endpoint?: string;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema) */
  inputSchema?: Record<string, unknown>;
  /** Server this tool belongs to */
  server: string;
}

/**
 * MCP Tool result
 */
export interface MCPToolResult {
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Result content */
  content?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * MCP Server connection
 */
export interface MCPServerConnection {
  /** Server configuration */
  config: MCPServerConfig;
  /** Available tools */
  tools: MCPTool[];
  /** Whether connected */
  connected: boolean;
  /** Server process (for stdio transport) */
  process?: ChildProcess;
}

/**
 * MCP Tool Manager
 *
 * Manages connections to MCP servers and tool execution
 */
export class MCPToolManager {
  private servers: Map<string, MCPServerConnection> = new Map();

  /**
   * Add an MCP server configuration
   */
  addServer(config: MCPServerConfig): void {
    if (this.servers.has(config.name)) {
      warn(`MCP server '${config.name}' already exists, replacing`);
    }

    this.servers.set(config.name, {
      config,
      tools: [],
      connected: false,
    });

    debug(`Added MCP server: ${config.name}`);
  }

  /**
   * Add multiple servers from configuration
   */
  addServers(configs: MCPServerConfig[]): void {
    for (const config of configs) {
      this.addServer(config);
    }
  }

  /**
   * Connect to an MCP server and discover tools
   */
  async connect(serverName: string): Promise<boolean> {
    const connection = this.servers.get(serverName);
    if (!connection) {
      warn(`MCP server '${serverName}' not found`);
      return false;
    }

    const { config } = connection;

    try {
      if (config.transport === 'http') {
        return await this.connectHttp(connection);
      } else {
        return await this.connectStdio(connection);
      }
    } catch (err) {
      warn(`Failed to connect to MCP server '${serverName}': ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Connect via stdio transport
   */
  private async connectStdio(connection: MCPServerConnection): Promise<boolean> {
    const { config } = connection;

    const childProcess = spawn(config.command, config.args ?? [], {
      env: { ...globalThis.process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    connection.process = childProcess;

    // Wait for initialization
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        debug(`MCP server '${config.name}' connection timeout`);
        resolve(false);
      }, 5000);

      childProcess.stdout?.once('data', (data: Buffer) => {
        clearTimeout(timeout);
        try {
          // Parse initialization response
          const response = JSON.parse(data.toString());
          if (response.tools) {
            connection.tools = response.tools.map((t: Record<string, unknown>) => ({
              ...t,
              server: config.name,
            }));
          }
          connection.connected = true;
          info(`Connected to MCP server '${config.name}' with ${connection.tools.length} tools`);
          resolve(true);
        } catch {
          debug(`Failed to parse MCP server response`);
          resolve(false);
        }
      });

      childProcess.on('error', (err: Error) => {
        clearTimeout(timeout);
        debug(`MCP server '${config.name}' error: ${err.message}`);
        resolve(false);
      });

      // Send initialization request
      childProcess.stdin?.write(JSON.stringify({ method: 'initialize' }) + '\n');
    });
  }

  /**
   * Connect via HTTP transport
   */
  private async connectHttp(connection: MCPServerConnection): Promise<boolean> {
    const { config } = connection;

    if (!config.endpoint) {
      warn(`MCP server '${config.name}' has no endpoint configured`);
      return false;
    }

    try {
      const response = await fetch(`${config.endpoint}/tools`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as { tools?: MCPTool[] };
      connection.tools = (data.tools ?? []).map(t => ({ ...t, server: config.name }));
      connection.connected = true;
      info(`Connected to MCP server '${config.name}' with ${connection.tools.length} tools`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connect to all configured servers
   */
  async connectAll(): Promise<number> {
    let connected = 0;
    for (const [name] of this.servers) {
      if (await this.connect(name)) {
        connected++;
      }
    }
    return connected;
  }

  /**
   * Get all available tools from connected servers
   */
  getAvailableTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const connection of this.servers.values()) {
      if (connection.connected) {
        tools.push(...connection.tools);
      }
    }
    return tools;
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName: string, input: Record<string, unknown>): Promise<MCPToolResult> {
    // Find the tool
    for (const connection of this.servers.values()) {
      const tool = connection.tools.find(t => t.name === toolName);
      if (tool && connection.connected) {
        return this.executeOnServer(connection, toolName, input);
      }
    }

    return {
      success: false,
      error: `Tool '${toolName}' not found`,
    };
  }

  /**
   * Execute a tool on a specific server
   */
  private async executeOnServer(
    connection: MCPServerConnection,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const { config } = connection;

    try {
      if (config.transport === 'http') {
        return await this.executeHttp(config, toolName, input);
      } else {
        return await this.executeStdio(connection, toolName, input);
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Execute via stdio
   */
  private executeStdio(
    connection: MCPServerConnection,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<MCPToolResult> {
    return new Promise((resolve) => {
      if (!connection.process?.stdin || !connection.process?.stdout) {
        resolve({ success: false, error: 'Server process not available' });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Execution timeout' });
      }, 30000);

      connection.process.stdout.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve({
            success: !response.error,
            content: response.result,
            error: response.error,
          });
        } catch {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      });

      connection.process.stdin.write(
        JSON.stringify({ method: 'execute', tool: toolName, input }) + '\n'
      );
    });
  }

  /**
   * Execute via HTTP
   */
  private async executeHttp(
    config: MCPServerConfig,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const response = await fetch(`${config.endpoint}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolName, input }),
    });

    const data = await response.json() as { result?: string; error?: string };
    const result: MCPToolResult = {
      success: response.ok && !data.error,
    };
    if (data.result !== undefined) result.content = data.result;
    if (data.error !== undefined) result.error = data.error;
    return result;
  }

  /**
   * Disconnect from all servers
   */
  disconnect(): void {
    for (const connection of this.servers.values()) {
      if (connection.process) {
        connection.process.kill();
        delete connection.process;
      }
      connection.connected = false;
    }
    debug('Disconnected from all MCP servers');
  }

  /**
   * Get server names
   */
  getServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverName: string): boolean {
    return this.servers.get(serverName)?.connected ?? false;
  }
}

/**
 * Create an MCP tool manager
 */
export function createMCPToolManager(): MCPToolManager {
  return new MCPToolManager();
}

# MCP Tool Extension Guide

Ralph CLI supports extending functionality with custom MCP (Model Context Protocol) tools.

## What is MCP?

MCP (Model Context Protocol) is a standard for connecting AI models to external tools and data sources. Ralph CLI can connect to MCP servers to give the AI agent access to custom tools.

## Configuration

Add MCP servers to your `.ralph/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "database",
      "command": "npx",
      "args": ["@myorg/db-mcp-server"],
      "transport": "stdio"
    },
    {
      "name": "api-tools",
      "transport": "http",
      "endpoint": "http://localhost:3000/mcp"
    }
  ]
}
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Unique name for the server |
| `command` | string | Command to run (for stdio transport) |
| `args` | string[] | Command arguments (optional) |
| `transport` | string | `stdio` (default) or `http` |
| `endpoint` | string | HTTP endpoint (for http transport) |

## Transport Types

### stdio Transport (Default)

The MCP server is started as a child process, and communication happens via stdin/stdout.

```json
{
  "name": "my-tools",
  "command": "node",
  "args": ["./mcp-server.js"],
  "transport": "stdio"
}
```

### http Transport

The MCP server is a running HTTP service.

```json
{
  "name": "remote-tools",
  "transport": "http",
  "endpoint": "http://localhost:8080/mcp"
}
```

## Creating an MCP Server

### Basic stdio Server Example

```javascript
// mcp-server.js
const readline = require('readline');

const tools = [
  {
    name: 'get-weather',
    description: 'Get the current weather for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' }
      },
      required: ['location']
    }
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  const request = JSON.parse(line);
  
  if (request.method === 'initialize') {
    console.log(JSON.stringify({ tools }));
  } else if (request.method === 'execute') {
    // Handle tool execution
    const result = executeToolTool(request.tool, request.input);
    console.log(JSON.stringify({ result }));
  }
});

function executeTool(name, input) {
  if (name === 'get-weather') {
    return `Weather in ${input.location}: Sunny, 72°F`;
  }
  return 'Unknown tool';
}
```

### HTTP Server Example

```javascript
// mcp-http-server.js
const express = require('express');
const app = express();
app.use(express.json());

const tools = [
  {
    name: 'search-docs',
    description: 'Search internal documentation',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      }
    }
  }
];

app.get('/mcp/tools', (req, res) => {
  res.json({ tools });
});

app.post('/mcp/execute', (req, res) => {
  const { tool, input } = req.body;
  // Execute tool and return result
  res.json({ result: `Search results for: ${input.query}` });
});

app.listen(3000);
```

## MCP Protocol

### Initialization

When Ralph connects to an MCP server (stdio), it sends:

```json
{ "method": "initialize" }
```

The server should respond with available tools:

```json
{
  "tools": [
    {
      "name": "tool-name",
      "description": "What the tool does",
      "inputSchema": { ... }
    }
  ]
}
```

### Tool Execution

When Ralph needs to execute a tool:

```json
{
  "method": "execute",
  "tool": "tool-name",
  "input": { "param": "value" }
}
```

Server responds:

```json
{
  "result": "Tool output"
}
```

Or on error:

```json
{
  "error": "Error message"
}
```

## Best Practices

1. **Keep tools focused**: Each tool should do one thing well
2. **Clear descriptions**: Help the AI understand when to use each tool
3. **Input validation**: Validate inputs in your MCP server
4. **Timeout handling**: Set reasonable timeouts (Ralph uses 30s default)
5. **Error messages**: Provide helpful error messages

## Example Use Cases

- **Database access**: Query or update databases
- **API integration**: Call external APIs
- **File processing**: Parse or generate files in custom formats
- **Documentation search**: Search internal docs or wikis
- **Build tools**: Run custom build or test commands

## Debugging

Run Ralph with `--verbose` to see MCP connection details:

```bash
ralph run --task "..." --verbose
```

## Security Considerations

- MCP servers have access to execute code
- Only use trusted MCP servers
- Limit permissions of MCP server processes
- Review tool capabilities before enabling

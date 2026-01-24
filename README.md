# Ralph CLI

[![npm version](https://img.shields.io/npm/v/ralph-cli.svg)](https://www.npmjs.com/package/ralph-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A cross-platform CLI for running autonomous agentic coding loops using the Ralph Wiggum pattern with GitHub Copilot.

## What is Ralph CLI?

Ralph CLI implements the **Ralph Wiggum agentic coding pattern** - a simple, safe, and well-documented approach to running autonomous AI coding loops. Instead of writing complex prompts, you describe what you want done and Ralph iteratively works towards completing it.

### The Ralph Wiggum Pattern

Named after the delightfully simple character, the pattern is elegantly straightforward:

```
1. Give the agent a task
2. Let it work in small, checkpointed iterations
3. Review progress and rollback if needed
4. Repeat until done
```

This approach prioritizes **safety** (automatic checkpoints, git isolation) and **control** (iteration limits, easy rollback) over speed.

## Key Features

- 🔄 **Autonomous Loop**: Repeatedly invokes AI agent until task completion
- 📋 **Flexible Plan Sources**: GitHub Issues or local Markdown task lists
- 🛡️ **Safety First**: Git branch isolation, file deletion safeguards
- 💾 **Automatic Checkpoints**: Git commits after each iteration for easy rollback
- 📊 **Progress Tracking**: Real-time status, token usage, and session logs
- ⚡ **Guardrails**: Iteration limits, token budgets, timeout controls
- 🔧 **Highly Configurable**: Customize behavior via CLI, env vars, or config files
- 💻 **Cross-Platform**: Works on Windows, macOS, and Linux

## Quick Start (5 minutes)

### 1. Install Ralph CLI

```bash
npm install -g ralph-cli
```

### 2. Initialize in your project

```bash
cd your-project
ralph init
```

### 3. Run your first task

```bash
ralph run --task "Add a README badge showing the build status"
```

Ralph will:
- Create an isolated git branch
- Work on the task iteratively
- Checkpoint each iteration with git commits
- Show you the results

### 4. Check progress

```bash
ralph status
```

### 5. Rollback if needed

```bash
ralph rollback --iterations 1
```

## Installation

### npm (Recommended)

```bash
npm install -g ralph-cli
```

### From source

```bash
git clone https://github.com/your-org/ralph-cli.git
cd ralph-cli
npm install
npm run build
npm link
```

## Requirements

- **Node.js** 18.0.0 or higher
- **Git** (for branch isolation and checkpoints)
- **GitHub Copilot** access (via GitHub CLI or API token)

## Basic Usage

### Single Task

```bash
# Inline task
ralph run --task "Add input validation to the login form"

# Task from file
ralph run --file tasks/add-validation.md
```

### Plan-Based Execution

```bash
# From local Markdown plan
ralph run --plan TODO.md

# From GitHub Issues
ralph run --github owner/repo --label "ready"
```

### Advanced Options

```bash
# Control iterations and tokens
ralph run --task "Refactor auth" --max-iterations 20 --max-tokens 50000

# Specify context files
ralph run --task "Fix tests" --context "src/**/*.test.ts"

# Use a specific branch
ralph run --task "Add feature" --branch feature/my-feature

# Preview without executing
ralph run --task "Big change" --dry-run

# Long-running task with timeout
ralph run --task "Large refactor" --unlimited --timeout 60
```

## Commands

| Command | Description |
|---------|-------------|
| `ralph init` | Initialize Ralph in a repository |
| `ralph run` | Execute an agentic coding loop |
| `ralph status` | Check current session status |
| `ralph rollback` | Revert to a previous checkpoint |
| `ralph config` | View or modify configuration |
| `ralph help` | Get help for any command |

Use `ralph <command> --help` for detailed options.

## Configuration

Ralph uses a hierarchical configuration system:

1. **CLI flags** (highest priority)
2. **Environment variables** (`RALPH_*`)
3. **Local config** (`.ralph/config.json`)
4. **Global config** (`~/.config/ralph/config.json`)

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `planSource` | `local` | Plan source: `github` or `local` |
| `maxIterations` | `10` | Maximum loop iterations |
| `maxTokens` | `100000` | Token budget |
| `defaultModel` | `gpt-4` | Copilot model to use |
| `autoCommit` | `true` | Auto-commit after iterations |
| `branchPrefix` | `ralph/` | Prefix for Ralph branches |

### Example Configuration

```json
{
  "planSource": "github",
  "maxIterations": 15,
  "maxTokens": 50000,
  "defaultModel": "gpt-4",
  "autoCommit": true,
  "branchPrefix": "ralph/",
  "githubRepo": "owner/repo"
}
```

## Safety Features

Ralph is designed with safety as a priority:

### 🌿 Git Branch Isolation
- Automatically creates `ralph/` prefixed branches
- Never modifies `main` or `master` directly
- Easy to discard unsuccessful attempts

### 💾 Automatic Checkpoints
- Commits after each successful iteration
- Message format: `ralph: iteration N - summary`
- Easy rollback with `ralph rollback`

### 🛡️ File Deletion Safeguards
- Tracks files that existed before session
- Blocks deletion of pre-existing files
- Override with `--allow-delete` if needed

### ⏱️ Resource Limits
- Configurable iteration limits
- Token budget controls
- Optional timeout (`--timeout`)
- Requires `--unlimited` flag for >50 iterations

### 🔌 Circuit Breaker
- Pauses after 3 consecutive failures
- Warns at 80% of resource limits
- Graceful shutdown on Ctrl+C

## Authentication

Ralph uses GitHub for AI access:

1. **GitHub CLI** (recommended): `gh auth login`
2. **Environment variable**: `GITHUB_TOKEN` or `GH_TOKEN`

## Troubleshooting

### "Not in a git repository"
Run `git init` first, or navigate to an existing git repository.

### "Failed to initialize Copilot agent"
Ensure you're authenticated with GitHub:
```bash
gh auth login
# or
export GITHUB_TOKEN=your_token
```

### "Maximum iterations reached"
Increase the limit: `--max-iterations 20`
Or for very long tasks: `--unlimited`

### Progress seems stuck
Check status: `ralph status`
View checkpoints: `ralph rollback --list`
Rollback if needed: `ralph rollback`

## Philosophy

Ralph CLI is built on these principles:

1. **Simplicity first**: Mirror the elegant simplicity of the original Ralph loop
2. **Safety by design**: Git isolation, automatic checkpoints, cost controls
3. **Human-friendly**: Markdown progress, clear documentation, easy rollback
4. **Cross-platform**: Works seamlessly on Windows, macOS, and Linux
5. **Transparent**: You can always see what Ralph is doing and undo it

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT © [Your Name]

# GitHub Copilot Ralph CLI

[![npm version](https://img.shields.io/npm/v/ghcralph-cli.svg)](https://www.npmjs.com/package/ghcralph-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A cross-platform CLI for running autonomous agentic coding loops using the Ralph Wiggum pattern with GitHub Copilot.

## Credits & Attribution

**GitHub Copilot Ralph** is an opinionated interpretation of the **Ralph Wiggum loop** approach, originally proposed by **[Geoffrey Huntley](https://ghuntley.com/)**. The original concept and documentation can be found at [ghuntley.com/ralph](https://ghuntley.com/ralph/).

This CLI implementation was created by **[Raphael Pothin](https://github.com/rpothin)** to make the Ralph Wiggum approach:

- 📐 **More structured** - with clear phases and checkpoints
- 🛡️ **Safer** - with git isolation, file safeguards, and resource limits
- 🎯 **More accessible** - for developers new to agentic coding patterns
- 🏢 **Enterprise-ready** - with configuration, audit trails, and controls
- 🔗 **GitHub ecosystem integrated** - leveraging GitHub Copilot SDK and optionally GitHub Issues

While strongly inspired by Geoffrey Huntley's original Ralph Wiggum loop, this implementation reflects the author's own perspective on making autonomous coding loops practical and safe for everyday use.

## What is GitHub Copilot Ralph?

GitHub Copilot Ralph implements the **Ralph Wiggum agentic coding pattern** - a simple, safe, and well-documented approach to running autonomous AI coding loops powered by GitHub Copilot. Instead of writing complex prompts, you describe what you want done and GitHub Copilot Ralph iteratively works towards completing it.

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

## Prerequisites

Before installing GitHub Copilot Ralph, ensure you have:

1. **Node.js** 18.0.0 or higher
2. **Git** (for branch isolation and checkpoints)
3. **GitHub Copilot CLI** - Required for the underlying Copilot SDK
   ```bash
   # Install GitHub Copilot CLI first
   gh extension install github/gh-copilot
   ```
   See the [GitHub Copilot SDK Getting Started guide](https://github.com/github/copilot-sdk?tab=readme-ov-file#getting-started) for more details.
4. **GitHub Copilot access** - An active GitHub Copilot subscription

## Quick Start (5 minutes)

### 1. Install GitHub Copilot Ralph

```bash
npm install -g ghcralph-cli
```

### 2. Initialize in your project

```bash
cd your-project
ghcralph init
```

### 3. Run your first task

```bash
ghcralph run --task "Add a README badge showing the build status"
```

GitHub Copilot Ralph will:
- Create an isolated git branch
- Work on the task iteratively
- Checkpoint each iteration with git commits
- Show you the results

### 4. Check progress

```bash
ghcralph status
```

### 5. Rollback if needed

```bash
ghcralph rollback --iterations 1
```

## Installation

### npm (Recommended)

```bash
npm install -g ghcralph-cli
```

### From source

```bash
git clone https://github.com/rpothin/ghc-ralph-cli.git
cd ghc-ralph-cli
npm install
npm run build
npm link
```

## Basic Usage

### Single Task

```bash
# Inline task
ghcralph run --task "Add input validation to the login form"

# Task from file
ghcralph run --file tasks/add-validation.md
```

### Plan-Based Execution

```bash
# From local Markdown plan
ghcralph run --plan TODO.md

# From GitHub Issues
ghcralph run --github owner/repo --label "ready"
```

### Advanced Options

```bash
# Control iterations and tokens
ghcralph run --task "Refactor auth" --max-iterations 20 --max-tokens 50000

# Specify context files
ghcralph run --task "Fix tests" --context "src/**/*.test.ts"

# Use a specific branch
ghcralph run --task "Add feature" --branch feature/my-feature

# Preview without executing
ghcralph run --task "Big change" --dry-run

# Long-running task with timeout
ghcralph run --task "Large refactor" --unlimited --timeout 60
```

## Commands

| Command | Description |
|---------|-------------|
| `ghcralph init` | Initialize GitHub Copilot Ralph in a repository |
| `ghcralph run` | Execute an agentic coding loop |
| `ghcralph status` | Check current session status |
| `ghcralph rollback` | Revert to a previous checkpoint |
| `ghcralph config` | View or modify configuration |
| `ghcralph help` | Get help for any command |

Use `ghcralph <command> --help` for detailed options.

## Configuration

GitHub Copilot Ralph uses a hierarchical configuration system:

1. **CLI flags** (highest priority)
2. **Environment variables** (`GHCRALPH_*`)
3. **Local config** (`.ghcralph/config.json`)
4. **Global config** (`~/.config/ghcralph/config.json`)

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `planSource` | `local` | Plan source: `github` or `local` |
| `maxIterations` | `10` | Maximum loop iterations |
| `maxTokens` | `100000` | Token budget |
| `defaultModel` | `gpt-4.1` | Copilot model to use (0x multiplier) |
| `autoCommit` | `true` | Auto-commit after iterations |
| `branchPrefix` | `ghcralph/` | Prefix for GitHub Copilot Ralph branches |

### Example Configuration

```json
{
  "planSource": "github",
  "maxIterations": 15,
  "maxTokens": 50000,
  "defaultModel": "gpt-4.1",
  "autoCommit": true,
  "branchPrefix": "ghcralph/",
  "githubRepo": "owner/repo"
}
```

## Safety Features

GitHub Copilot Ralph is designed with safety as a priority:

### 🌿 Git Branch Isolation
- Automatically creates `ghcralph/` prefixed branches
- Never modifies `main` or `master` directly
- Easy to discard unsuccessful attempts

### 💾 Automatic Checkpoints
- Commits after each successful iteration
- Message format: `ghcralph: iteration N - summary`
- Easy rollback with `ghcralph rollback`

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

GitHub Copilot Ralph uses GitHub for AI access:

1. **GitHub CLI** (recommended): `gh auth login`
2. **GitHub Copilot CLI**: Ensure it's installed: `gh extension install github/gh-copilot`
3. **Environment variable** (alternative): `GITHUB_TOKEN` or `GH_TOKEN`

## Troubleshooting

### "Not in a git repository"
Run `git init` first, or navigate to an existing git repository.

### "Failed to initialize Copilot agent"
Ensure you have GitHub Copilot CLI installed and are authenticated:
```bash
# Install GitHub Copilot CLI if not already installed
gh extension install github/gh-copilot

# Authenticate with GitHub
gh auth login
```

### "Maximum iterations reached"
Increase the limit: `--max-iterations 20`
Or for very long tasks: `--unlimited`

### Progress seems stuck
Check status: `ghcralph status`
View checkpoints: `ghcralph rollback --list`
Rollback if needed: `ghcralph rollback`

## Philosophy

GitHub Copilot Ralph is built on these principles:

1. **Simplicity first**: Mirror the elegant simplicity of Geoffrey Huntley's original Ralph loop
2. **Safety by design**: Git isolation, automatic checkpoints, cost controls
3. **Human-friendly**: Markdown progress, clear documentation, easy rollback
4. **Cross-platform**: Works seamlessly on Windows, macOS, and Linux
5. **Transparent**: You can always see what GitHub Copilot Ralph is doing and undo it

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT © [Raphael Pothin](https://github.com/rpothin)

# GitHub Copilot Ralph CLI (`ghcralph`)

[![CI](https://github.com/rpothin/ghc-ralph-cli/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/rpothin/ghc-ralph-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ghcralph.svg)](https://www.npmjs.com/package/ghcralph)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

Run **autonomous, checkpointed coding loops** with GitHub Copilot—designed to be **safe, reversible, and budget-controlled**.

## What you get

- 🌿 **Branch isolation**: works on a `ghcralph/*` branch (never modifies `main`/`master` directly)
- 💾 **Automatic checkpoints**: commits after each iteration for easy rollback
- 🛡️ **Guardrails**: iteration limits, token budgets, timeouts, circuit breaker on repeated failures
- 📋 **Flexible plan sources**: GitHub Issues or local Markdown task lists
- 💻 **Cross-platform**: Windows, macOS, Linux

## 60-second quick start

### Prerequisites (required)
- **Node.js** >= 18
- **git**
- **GitHub CLI (`gh`)** authenticated
- **GitHub Copilot CLI extension**:
  ```bash
  gh extension install github/gh-copilot
  ```
- An active **GitHub Copilot** subscription / access

### Install
```bash
npm install -g ghcralph
```

### Initialize in your project
```bash
cd your-project
ghcralph init
```

### Run your first task
```bash
ghcralph run --task "Add a README badge showing the build status"
```

### Rollback if needed
```bash
ghcralph rollback --iterations 1
```

## Safety model (read this first)

- **No direct main changes**: the tool creates an isolated branch and works there.
- **Reversible by design**: each iteration is checkpointed in git; rollback is a first-class command.
- **Deletion protection**: existing files are protected from deletion by default (override only if you explicitly allow it).
- **Budgets and limits**: iteration/token/time limits prevent runaway sessions.

---

## What is GitHub Copilot Ralph?

GitHub Copilot Ralph implements the **Ralph Wiggum agentic coding pattern**—a simple, safe, and well-documented approach to running autonomous AI coding loops powered by GitHub Copilot.

### The Ralph Wiggum Pattern

Named after the delightfully simple character, the pattern is straightforward:

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

## Commands

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `ghcralph init`     | Initialize GitHub Copilot Ralph in a repository |
| `ghcralph run`      | Execute an agentic coding loop                  |
| `ghcralph status`   | Check current session status                    |
| `ghcralph rollback` | Revert to a previous checkpoint                 |
| `ghcralph config`   | View or modify configuration                    |
| `ghcralph help`     | Get help for any command                        |

Use `ghcralph <command> --help` for detailed options.

## Common workflows

### One-off task (fastest)
```bash
ghcralph run --task "Refactor auth middleware to reduce duplication"
```

### Run from a local Markdown plan
```bash
ghcralph run --plan TODO.md
```

### Run tasks from GitHub Issues
```bash
ghcralph init --github
ghcralph run --github owner/repo --label "ready"
```

## Usage

### Initialize a Project

```bash
# Default initialization (local plan source)
ghcralph init

# Use GitHub Issues as plan source
ghcralph init --github

# Use local Markdown files as plan source
ghcralph init --local

# Reinitialize existing configuration
ghcralph init --force
```

### Run Tasks

```bash
# Inline task
ghcralph run --task "Add input validation to the login form"

# Task from file
ghcralph run --file tasks/add-validation.md

# Tasks from a Markdown plan file
ghcralph run --plan TODO.md

# Tasks from GitHub Issues
ghcralph run --github owner/repo --label "ready"
```

### Advanced Run Options

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

# Skip confirmation prompts
ghcralph run --task "Quick fix" --force
```

## Configuration

GitHub Copilot Ralph uses a hierarchical configuration system:

1. **CLI flags** (highest priority)
2. **Environment variables** (`GHCRALPH_*`)
3. **Local config** (`.ghcralph/config.json`)
4. **Global config** (`~/.config/ghcralph/config.json`)

### Configuration Options

| Option          | Default     | Description                                           |
| --------------- | ----------- | ----------------------------------------------------- |
| `planSource`    | `local`     | Plan source: `github` or `local`                      |
| `maxIterations` | `10`        | Maximum loop iterations                               |
| `maxTokens`     | `100000`    | Token budget                                          |
| `defaultModel`  | `gpt-4.1`   | Copilot model to use                                  |
| `autoCommit`    | `true`      | Auto-commit after iterations                          |
| `branchPrefix`  | `ghcralph/` | Prefix for GitHub Copilot Ralph branches              |
| `githubRepo`    | -           | GitHub repository (owner/repo) for GitHub plan source |
| `localPlanFile` | -           | Path to local plan file                               |

### Environment Variables

All configuration options can be set via environment variables with the `GHCRALPH_` prefix:

```bash
export GHCRALPH_MAX_ITERATIONS=20
export GHCRALPH_MAX_TOKENS=50000
export GHCRALPH_DEFAULT_MODEL=gpt-4.1
export GHCRALPH_AUTO_COMMIT=true
export GHCRALPH_BRANCH_PREFIX=ghcralph/
export GHCRALPH_PLAN_SOURCE=local
```

### Example Configuration File

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

## Safety Features (details)

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

## Installation

### npm (Recommended)

```bash
npm install -g ghcralph
```

### From source

```bash
git clone https://github.com/rpothin/ghc-ralph-cli.git
cd ghc-ralph-cli
npm install
npm run build
npm link
```

## Troubleshooting

### "Not in a git repository"
Run `git init` first, or navigate to an existing git repository.

### "Failed to initialize Copilot agent"
Ensure you have GitHub Copilot CLI installed and are authenticated:
```bash
gh extension install github/gh-copilot
gh auth login
```

### "Maximum iterations reached"
Increase the limit: `--max-iterations 20`  
Or for very long tasks: `--unlimited`

### Progress seems stuck
Check status: `ghcralph status`  
View checkpoints: `ghcralph rollback --list`  
Rollback if needed: `ghcralph rollback`

## Credits & Attribution

**GitHub Copilot Ralph** is an opinionated interpretation of the **Ralph Wiggum loop** approach, originally proposed by **[Geoffrey Huntley](https://ghuntley.com/)**.

This CLI implementation was created by **[Raphael Pothin](https://github.com/rpothin)** to make the Ralph Wiggum approach:

- 📐 **More structured** - with clear phases and checkpoints
- 🛡️ **Safer** - with git isolation, file safeguards, and resource limits
- 🎯 **More accessible** - for developers new to agentic coding patterns
- 🏢 **Enterprise-ready** - with configuration, audit trails, and controls
- 🔗 **GitHub ecosystem integrated** - leveraging GitHub Copilot SDK and optionally GitHub Issues

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
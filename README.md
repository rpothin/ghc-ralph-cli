# Ralph CLI

A cross-platform CLI for running autonomous agentic coding loops using the Ralph Wiggum pattern with GitHub Copilot.

## Overview

Ralph CLI implements the Ralph Wiggum agentic coding pattern - a simple, safe, and well-documented approach to running autonomous coding loops against a plan defined in GitHub Issues or local Markdown files.

### Core Philosophy

- **Simplicity first**: Mirror the elegant simplicity of the original Ralph loop
- **Safety by design**: Git isolation, automatic checkpoints, cost controls
- **Human-friendly**: Markdown-based progress tracking, clear documentation
- **Cross-platform**: Works seamlessly on Windows, macOS, and Linux

## Features

- 🔄 **Autonomous Loop**: Repeatedly invokes AI agent until task completion
- 📋 **Plan Sources**: GitHub Issues or local Markdown task lists
- 🛡️ **Safety Guards**: Iteration limits, token budgets, git isolation
- 💾 **Checkpoints**: Automatic git commits for easy rollback
- 📊 **Progress Tracking**: Real-time status and token usage

## Installation

```bash
npm install -g ralph-cli
```

## Quick Start

```bash
# Initialize Ralph in your repository
ralph init

# Run a task
ralph run --task "Add input validation to the user form"

# Check status
ralph status

# Rollback if needed
ralph rollback
```

## Requirements

- Node.js 18.0.0 or higher
- Git
- GitHub Copilot access

## Commands

| Command | Description |
|---------|-------------|
| `ralph init` | Initialize Ralph in a repository |
| `ralph run` | Execute an agentic coding loop |
| `ralph status` | Check current loop status |
| `ralph rollback` | Revert to a previous checkpoint |
| `ralph config` | View or modify configuration |

## Configuration

Ralph can be configured via:

1. Command-line flags (highest priority)
2. Environment variables (`RALPH_*`)
3. Local configuration (`.ralph/config.json`)
4. Global configuration (`~/.config/ralph/config.json`)

## License

MIT

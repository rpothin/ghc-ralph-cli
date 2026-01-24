# 🎯 Ralph CLI - Implementation Plan

## Executive Summary

**Ralph CLI** is a standalone, cross-platform command-line tool that implements the Ralph Wiggum agentic coding pattern using the GitHub Copilot SDK. It provides a simple, safe, and well-documented way to run autonomous coding loops against a plan defined in GitHub Issues or local Markdown files.

### Core Philosophy
- **Simplicity first**: Mirror the elegant simplicity of the original Ralph loop
- **Safety by design**: Git isolation, automatic checkpoints, cost controls
- **Human-friendly**: Markdown-based progress tracking, clear documentation
- **Cross-platform**: Works seamlessly on Windows, macOS, and Linux

---

## 📦 Repository Setup

### Suggested Repository Details

| Attribute       | Recommendation                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**        | `ralph-cli`                                                                                                                                    |
| **Description** | "A cross-platform CLI for running autonomous agentic coding loops using the Ralph Wiggum pattern with GitHub Copilot"                          |
| **Topics/Tags** | `cli`, `copilot`, `agentic-coding`, `ralph-wiggum`, `automation`, `developer-tools`, `ai-coding`, `github-copilot`, `nodejs`, `cross-platform` |
| **License**     | MIT                                                                                                                                            |
| **Visibility**  | Public                                                                                                                                         |

### Alternative Names Considered
- `ralph-loop` - More descriptive of the core function
- `wiggum-cli` - Alternative reference to the pattern
- `copilot-ralph` - Emphasizes the Copilot integration

**Recommendation**: `ralph-cli` - Short, memorable, and clearly indicates it's a CLI tool.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Ralph CLI                                │
├─────────────────────────────────────────────────────────────────┤
│  Commands                                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │  init   │ │   run   │ │ status  │ │ rollback│ │  config   │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Core Modules                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Loop Engine  │ │ Plan Manager │ │ Git Manager  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │Safety Guards │ │Progress Track│ │ MCP Support  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  Integration Layer                                               │
│  ┌──────────────────────┐ ┌──────────────────────┐              │
│  │  GitHub Copilot SDK  │ │     GitHub API       │              │
│  └──────────────────────┘ └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Phases

### Phase 1: Foundation (Issues #1-#6)
**Goal**: Establish project structure, core loop engine, and basic CLI

### Phase 2: Plan Management (Issues #7-#10)
**Goal**: Implement GitHub Issues and local Markdown plan sources

### Phase 3: Safety & Control (Issues #11-#15)
**Goal**: Git isolation, checkpoints, limits, and rollback

### Phase 4: Polish & Documentation (Issues #16-#20)
**Goal**: Comprehensive docs, cookbook, and user experience refinements

---

## 📝 Detailed Issue Breakdown

### Phase 1: Foundation

---

#### Issue #1: Project Initialization and Structure

**Title**: `Initialize project with TypeScript, npm packaging, and core structure`

**Description**:
Set up the foundational project structure for Ralph CLI.

**Acceptance Criteria**:
- [x] Initialize npm project with appropriate `package.json`
- [x] Configure TypeScript with strict mode
- [x] Set up ESLint and Prettier for code quality
- [x] Create directory structure:
  ```
  src/
    commands/       # CLI command implementations
    core/           # Core loop engine and utilities
    integrations/   # GitHub API, Copilot SDK integrations
    types/          # TypeScript type definitions
    utils/          # Shared utilities
  docs/             # Documentation
  examples/         # Example configurations and patterns
  ```
- [x] Configure `tsconfig.json` for Node.js target
- [x] Set up build scripts for cross-platform distribution
- [x] Add `.gitignore`, `.editorconfig`, and other standard files
- [x] Create initial `README.md` with project vision

**Technical Notes**:
- Use Node.js 18+ as minimum version (LTS)
- Target ES2022 for modern JavaScript features
- Use `commander` or `yargs` for CLI argument parsing
- Consider `tsx` for development mode

**Labels**: `phase-1`, `setup`, `priority-high`

---

#### Issue #2: CLI Entry Point and Command Framework

**Title**: `Implement CLI entry point with command routing framework`

**Description**:
Create the main CLI entry point that routes to subcommands and handles global options.

**Acceptance Criteria**:
- [x] Create `bin/ralph` entry point
- [x] Implement command routing for: `init`, `run`, `status`, `rollback`, `config`
- [x] Add global flags:
  - `--version` / `-v`: Show version
  - `--help` / `-h`: Show help
  - `--verbose`: Enable verbose logging
  - `--quiet`: Suppress non-essential output
- [x] Implement colored, formatted console output
- [x] Add shell detection (Bash, PowerShell, Zsh, Fish, CMD)
- [x] Ensure cross-platform path handling

**Technical Notes**:
- Use `chalk` or `picocolors` for terminal colors
- Use `ora` for spinners during async operations
- Detect shell via `process.env.SHELL` or `process.env.ComSpec`

**Labels**: `phase-1`, `cli`, `priority-high`

---

#### Issue #3: GitHub Copilot SDK Integration

**Title**: `Integrate GitHub Copilot SDK for AI agent capabilities`

**Description**:
Implement the integration layer with the GitHub Copilot SDK to power the agentic loop.

**Acceptance Criteria**:
- [x] Install and configure `@anthropic-ai/sdk` or appropriate Copilot SDK package
- [x] Implement authentication flow (leverage existing GitHub CLI auth if available)
- [x] Create `CopilotAgent` class with methods:
  - `initialize()`: Set up agent session
  - `execute(prompt: string)`: Send prompt and get response
  - `getTokenUsage()`: Return token consumption metrics
- [x] Handle API errors gracefully with retries
- [x] Implement token counting and usage tracking
- [x] Support model selection via configuration

**Technical Notes**:
- Check for GitHub Copilot CLI authentication first
- Fall back to OAuth device flow if needed
- Store credentials securely (system keychain if possible)

**Labels**: `phase-1`, `integration`, `copilot`, `priority-high`

---

#### Issue #4: Core Loop Engine Implementation

**Title**: `Implement the core Ralph loop engine`

**Description**:
Build the heart of Ralph CLI - the autonomous loop that repeatedly invokes the AI agent until the task is complete.

**Acceptance Criteria**:
- [x] Create `LoopEngine` class with:
  - `start(task: Task)`: Begin loop execution
  - `pause()`: Pause current loop
  - `resume()`: Resume paused loop
  - `stop()`: Gracefully stop loop
- [x] Implement the core loop pattern:
  ```
  while (task not complete AND iterations < max AND tokens < limit):
    1. Build context from current state
    2. Send to Copilot agent
    3. Parse and execute agent response
    4. Update progress
    5. Commit checkpoint
  ```
- [x] Add event emitters for loop lifecycle (start, iteration, complete, error)
- [x] Implement iteration tracking with timestamps
- [x] Create structured logging for each iteration

**Technical Notes**:
- Use async iterators for loop control
- Implement cancellation tokens for clean shutdown
- Store loop state for resume capability

**Labels**: `phase-1`, `core`, `priority-high`

---

#### Issue #5: Basic `run` Command Implementation

**Title**: `Implement basic 'ralph run' command for single-task execution`

**Description**:
Create the primary command that starts an agentic loop for a given task.

**Acceptance Criteria**:
- [x] Implement `ralph run` command with options:
  - `--task, -t <description>`: Task to execute (inline)
  - `--file, -f <path>`: Read task from file
  - `--max-iterations, -n <number>`: Maximum loop iterations (default: 10)
  - `--max-tokens <number>`: Maximum token budget
  - `--model, -m <model>`: Copilot model to use
  - `--dry-run`: Show what would happen without executing
- [x] Display real-time progress during execution
- [x] Show iteration count, token usage, and elapsed time
- [x] Handle Ctrl+C gracefully (save state, clean exit)
- [x] Output final summary on completion

**Example Usage**:
```bash
ralph run --task "Add input validation to the user registration form"
ralph run --file tasks/add-validation.md --max-iterations 5
ralph run -t "Fix the failing tests in src/utils" --dry-run
```

**Labels**: `phase-1`, `command`, `priority-high`

---

#### Issue #6: Configuration System with `init` Command

**Title**: `Implement configuration system and 'ralph init' command`

**Description**:
Create a configuration system that supports per-session setup and persisted preferences.

**Acceptance Criteria**:
- [x] Implement `ralph init` command that:
  - Detects existing git repository
  - Prompts for plan source (GitHub Issues or local Markdown)
  - Configures GitHub authentication if using Issues
  - Sets default iteration limits
  - Creates `.ralph/` directory for local state
- [x] Support configuration sources (in priority order):
  1. Command-line flags (highest priority)
  2. Environment variables (`RALPH_*`)
  3. Session configuration (`.ralph/config.json`)
  4. Global configuration (`~/.config/ralph/config.json`)
- [x] Configuration options:
  - `planSource`: `"github"` | `"local"`
  - `maxIterations`: number
  - `maxTokens`: number
  - `defaultModel`: string
  - `autoCommit`: boolean
  - `branchPrefix`: string (default: `"ralph/"`)
- [x] Implement `ralph config` command for viewing/editing config

**Technical Notes**:
- Use interactive prompts with `inquirer` or `prompts`
- Validate configuration on load
- Support `ralph config get <key>` and `ralph config set <key> <value>`

**Labels**: `phase-1`, `configuration`, `priority-medium`

---

### Phase 2: Plan Management

---

#### Issue #7: Local Markdown Plan Source

**Title**: `Implement local Markdown file plan source`

**Description**:
Support reading and tracking tasks from local Markdown files with checkbox syntax.

**Acceptance Criteria**:
- [x] Parse Markdown files with task lists:
  ```markdown
  # Project Tasks

  ## In Progress
  - [ ] Add user authentication
  - [ ] Implement password reset flow

  ## Completed
  - [x] Set up project structure
  ```
- [x] Support task metadata in YAML frontmatter:
  ```markdown
  ---
  title: Add user authentication
  priority: high
  estimate: 3 iterations
  ---
  ```
- [x] Implement `PlanManager` interface with `LocalMarkdownPlan` implementation
- [x] Track progress by updating checkboxes in source file
- [x] Support nested task hierarchies (sub-tasks as indented items)
- [x] Add `ralph run --plan <file.md>` option

**Labels**: `phase-2`, `plan-management`, `priority-high`

---

#### Issue #8: GitHub Issues Plan Source

**Title**: `Implement GitHub Issues as plan source`

**Description**:
Support using GitHub Issues as the source of tasks for the agentic loop.

**Acceptance Criteria**:
- [x] Implement `GitHubPlan` class implementing `PlanManager` interface
- [x] Support issue filtering options:
  - `--label, -l <label>`: Only process issues with this label (guardrail)
  - `--milestone <name>`: Only process issues in this milestone
  - `--assignee <user>`: Filter by assignee
- [x] Support both flat issues and parent/child (sub-issues) structures
- [x] Detect issue structure during `ralph init`:
  - Prompt: "Are you using sub-issues (parent/child) or flat issues?"
- [x] When starting work on an issue:
  - Assign logged-in user to the issue
  - Add "in-progress" label (configurable label name)
- [x] Add progress comments to issues during loop execution
- [x] Mark issue as complete when task finishes successfully

**Example Usage**:
```bash
ralph init --plan github
ralph run --label "ralph-ready" --max-iterations 10
```

**Labels**: `phase-2`, `plan-management`, `github`, `priority-high`

---

#### Issue #9: Progress Tracking with Markdown Artifacts

**Title**: `Implement Markdown-based progress tracking`

**Description**:
Create human-readable progress artifacts in Markdown format.

**Acceptance Criteria**:
- [x] Create `.ralph/progress.md` file tracking:
  ```markdown
  # Ralph Progress Log

  ## Current Session
  - **Started**: 2026-01-23T10:30:00Z
  - **Task**: Add input validation to registration form
  - **Status**: In Progress
  - **Iterations**: 3/10
  - **Tokens Used**: 12,450

  ### Iteration Log
  
  #### Iteration 1 (10:30:15)
  - Action: Analyzed existing form structure
  - Files modified: src/components/RegistrationForm.tsx
  - Tokens: 3,200

  #### Iteration 2 (10:31:42)
  - Action: Added Zod validation schema
  - Files modified: src/schemas/registration.ts (new)
  - Tokens: 4,100
  ```
- [x] Update progress file after each iteration
- [x] Include git commit hashes for each checkpoint
- [x] Provide `ralph status` command to display current progress
- [x] Support `--json` flag for machine-readable output

**Labels**: `phase-2`, `progress-tracking`, `priority-medium`

---

#### Issue #10: Task Context Building

**Title**: `Implement intelligent context building for agent prompts`

**Description**:
Build rich context for the AI agent including relevant code, history, and constraints.

**Acceptance Criteria**:
- [x] Gather context automatically:
  - Current task description
  - Relevant files (based on task keywords)
  - Recent git history
  - Previous iteration results
  - Project structure overview
- [x] Implement context size management (stay within token limits)
- [x] Support explicit context files via `--context <glob>` flag
- [x] Include the "Ralph prompt" pattern:
  ```
  You are an expert software engineer. Your task is: {task}
  
  Context:
  {relevant_files}
  
  Instructions:
  - Make small, focused changes
  - Test your changes when possible
  - Explain your reasoning
  - Stop when the task is complete
  ```
- [x] Allow custom prompt templates via configuration

**Labels**: `phase-2`, `core`, `priority-medium`

---

### Phase 3: Safety & Control

---

#### Issue #11: Git Branch Isolation

**Title**: `Implement automatic git branch isolation for safe exploration`

**Description**:
Ensure all Ralph operations happen in isolated git branches to protect the main codebase.

**Acceptance Criteria**:
- [x] On `ralph run`:
  - If on `main`/`master`: Auto-create branch `ralph/{task-slug}-{timestamp}`
  - If on other branch: Prompt user for confirmation before proceeding
- [x] Branch naming options via `--branch <name>` flag
- [x] Verify working directory is clean before starting (or offer to stash)
- [x] Configure branch prefix via settings (default: `ralph/`)
- [x] Add `--force` flag to skip branch confirmation prompts

**Example Flow**:
```
$ ralph run --task "Add logging"
⚠️  You're on 'main'. Creating branch 'ralph/add-logging-20260123'...
✓ Switched to new branch 'ralph/add-logging-20260123'
Starting loop...
```

**Labels**: `phase-3`, `safety`, `git`, `priority-high`

---

#### Issue #12: Automatic Checkpoint Commits

**Title**: `Implement automatic git commits after each loop iteration`

**Description**:
Create automatic checkpoints via git commits to enable easy rollback.

**Acceptance Criteria**:
- [ ] After each successful iteration:
  - Stage all modified files
  - Create commit with message: `ralph: iteration {n} - {summary}`
  - Record commit hash in progress log
- [ ] Commit message includes:
  - Iteration number
  - Brief summary of changes
  - Token usage for iteration
- [ ] Skip commit if no files were modified
- [ ] Add `--no-commit` flag to disable auto-commits
- [ ] Ensure commits are atomic (all-or-nothing)

**Example Commits**:
```
ralph: iteration 1 - Added validation schema
ralph: iteration 2 - Integrated schema with form component  
ralph: iteration 3 - Added error display UI
```

**Labels**: `phase-3`, `safety`, `git`, `priority-high`

---

#### Issue #13: Rollback Command Implementation

**Title**: `Implement 'ralph rollback' command for easy recovery`

**Description**:
Provide simple commands to undo changes made during Ralph sessions.

**Acceptance Criteria**:
- [ ] Implement `ralph rollback` with options:
  - `ralph rollback`: Undo last iteration
  - `ralph rollback --iterations <n>`: Undo last N iterations
  - `ralph rollback --to <commit>`: Rollback to specific checkpoint
  - `ralph rollback --all`: Undo entire session (reset to session start)
- [ ] Show diff preview before rollback (unless `--force`)
- [ ] Update progress log after rollback
- [ ] Preserve rollback history for audit trail

**Example Usage**:
```bash
$ ralph rollback
This will undo iteration 3:
  - Modified: src/components/Form.tsx
  - Added: src/schemas/validation.ts
Proceed? [y/N] y
✓ Rolled back to iteration 2 (commit abc1234)

$ ralph rollback --all
This will reset to the state before the Ralph session started.
⚠️  All 3 iterations will be undone.
Proceed? [y/N] y
✓ Reset to pre-session state (commit def5678)
```

**Labels**: `phase-3`, `safety`, `command`, `priority-medium`

---

#### Issue #14: Loop Limits and Guardrails

**Title**: `Implement configurable limits and guardrails for loop control`

**Description**:
Prevent runaway loops and excessive resource consumption.

**Acceptance Criteria**:
- [ ] Implement configurable limits:
  - `maxIterations`: Hard stop after N iterations (default: 10)
  - `maxTokens`: Stop if token budget exceeded
  - `maxDuration`: Stop after N minutes (optional)
- [ ] Display warnings at thresholds:
  - 80% of iteration limit
  - 80% of token budget
- [ ] Require explicit `--unlimited` flag to exceed 50 iterations
- [ ] Add "circuit breaker" for repeated failures:
  - If 3 consecutive iterations produce no changes, pause and prompt
- [ ] Log all limit-related events

**Example Output**:
```
⚠️  Warning: 8/10 iterations used
⚠️  Warning: Token usage at 82% of budget (16,400/20,000)
...
🛑 Maximum iterations (10) reached. Use --max-iterations to increase.
```

**Labels**: `phase-3`, `safety`, `priority-high`

---

#### Issue #15: File Deletion Safeguards

**Title**: `Implement safeguards for destructive file operations`

**Description**:
Protect existing files from accidental deletion while allowing cleanup of agent-created files.

**Acceptance Criteria**:
- [ ] Track files that existed before session start (snapshot `.ralph/baseline-files.json`)
- [ ] For files that existed before session:
  - Block deletion attempts
  - Log warning and continue without deleting
  - Allow override with `--allow-delete` flag
- [ ] For files created during session:
  - Allow deletion freely (agent experiments)
- [ ] Provide `ralph status --files` to show:
  - Files modified
  - Files created
  - Deletion attempts blocked
- [ ] Add configuration option `allowDeleteExisting: false` (default)

**Labels**: `phase-3`, `safety`, `priority-high`

---

### Phase 4: Polish & Documentation

---

#### Issue #16: Comprehensive CLI Help System

**Title**: `Implement comprehensive --help documentation for all commands`

**Description**:
Create helpful, concise in-CLI documentation.

**Acceptance Criteria**:
- [ ] Every command has detailed `--help` output
- [ ] Help includes:
  - Command description
  - All available options with descriptions
  - Common usage examples
  - Related commands
- [ ] Main `ralph --help` shows command overview
- [ ] Add `ralph help <command>` as alias
- [ ] Include tips for new users
- [ ] Keep help text concise but informative

**Example**:
```
$ ralph run --help

Run an agentic coding loop for a task

USAGE
  ralph run [options]

OPTIONS
  -t, --task <description>    Task to execute (required unless --file)
  -f, --file <path>           Read task from file
  -n, --max-iterations <n>    Maximum iterations (default: 10)
  --max-tokens <n>            Maximum token budget
  -m, --model <model>         Copilot model to use
  --dry-run                   Preview without executing
  --plan <source>             Use plan file or GitHub Issues
  -l, --label <label>         Filter GitHub Issues by label

EXAMPLES
  ralph run --task "Add input validation"
  ralph run --file todo.md --max-iterations 5
  ralph run --plan github --label "ralph-ready"

SEE ALSO
  ralph init      Set up Ralph in your project
  ralph status    View current progress
  ralph rollback  Undo recent changes
```

**Labels**: `phase-4`, `documentation`, `priority-medium`

---

#### Issue #17: README and Getting Started Guide

**Title**: `Create comprehensive README with getting started guide`

**Description**:
Write the main README.md with clear onboarding for developers new to agentic AI coding.

**Acceptance Criteria**:
- [ ] README sections:
  - What is Ralph CLI? (and what is the Ralph Wiggum pattern)
  - Key Features
  - Quick Start (5-minute guide)
  - Installation
  - Basic Usage
  - Configuration
  - Safety Features
  - FAQ
  - Contributing
- [ ] Include animated GIF/terminal recording showing basic usage
- [ ] Add badges (npm version, license, build status)
- [ ] Link to detailed documentation
- [ ] Explain the philosophy (simple, safe, cross-platform)

**Labels**: `phase-4`, `documentation`, `priority-high`

---

#### Issue #18: Cookbook and Patterns Documentation

**Title**: `Create cookbook with common patterns and workflows`

**Description**:
Document common use cases and best practices in a cookbook format.

**Acceptance Criteria**:
- [ ] Create `docs/cookbook.md` with patterns:
  - **Pattern: Bug Fix Loop** - Find and fix a reported bug
  - **Pattern: Feature Implementation** - Build a new feature step by step
  - **Pattern: Refactoring Session** - Improve code quality safely
  - **Pattern: Test Coverage** - Add tests to existing code
  - **Pattern: Documentation Sprint** - Generate/update docs
  - **Pattern: Code Review Follow-up** - Address PR feedback
- [ ] Each pattern includes:
  - When to use it
  - Example commands
  - Tips for success
  - Common pitfalls
- [ ] Add troubleshooting section
- [ ] Include "When NOT to use Ralph" guidance

**Labels**: `phase-4`, `documentation`, `priority-medium`

---

#### Issue #19: MCP Tool Extension Support

**Title**: `Implement MCP server support for custom tools`

**Description**:
Allow users to extend Ralph with custom MCP (Model Context Protocol) tools.

**Acceptance Criteria**:
- [ ] Add configuration for custom MCP servers:
  ```json
  {
    "mcpServers": [
      {
        "name": "custom-db",
        "command": "npx",
        "args": ["@myorg/db-mcp-server"]
      }
    ]
  }
  ```
- [ ] Implement MCP client for connecting to servers
- [ ] Pass available tools to Copilot agent context
- [ ] Document how to add custom MCP servers
- [ ] Add `ralph config mcp add <name> <command>` helper

**Technical Notes**:
- Follow MCP specification for tool discovery
- Support both stdio and HTTP transports
- Allow disabling built-in tools if needed

**Labels**: `phase-4`, `extensibility`, `priority-low`

---

#### Issue #20: Status Command and Session Management

**Title**: `Implement 'ralph status' command with rich session information`

**Description**:
Provide comprehensive visibility into current and past Ralph sessions.

**Acceptance Criteria**:
- [ ] Implement `ralph status` showing:
  - Current session status (active/paused/complete)
  - Task being worked on
  - Iteration progress (n/max)
  - Token usage and remaining budget
  - Files modified in session
  - Time elapsed
- [ ] Add `ralph status --history` for past sessions
- [ ] Add `ralph status --json` for scripting
- [ ] Show helpful next steps based on status
- [ ] Color-coded output for quick scanning

**Example Output**:
```
$ ralph status

📋 Ralph Session Status
━━━━━━━━━━━━━━━━━━━━━━━━

Status:      🟢 Active
Task:        Add input validation to registration form
Branch:      ralph/add-validation-20260123
Started:     10 minutes ago

Progress:    ████████░░ 8/10 iterations
Tokens:      16,420 / 20,000 (82%)

Modified Files:
  M src/components/RegistrationForm.tsx
  A src/schemas/registration.ts
  M src/styles/forms.css

Last Commit: abc1234 - ralph: iteration 8 - Added error styling

💡 Tip: Run 'ralph rollback' to undo the last iteration
```

**Labels**: `phase-4`, `command`, `priority-medium`

---

## 🚀 Going Further: Implementation Plan for Advanced Features

### Future Considerations (Post-MVP)

The following features were discussed but deferred to keep the initial scope simple. Once the core CLI gains traction, these could be valuable additions:

#### Advanced Session Management
**Vision**: Separate "initializer agent" and "coding agent" roles, similar to the full Ralph Wiggum harness.

**Potential Features**:
- `ralph plan` command that uses an AI agent to break down a high-level goal into tasks
- Session handoff between planning and execution modes
- Multi-session orchestration for large features

**Clarification Questions for Future**:
- Should the planning agent create GitHub Issues automatically?
- How should task dependencies be handled?
- Should there be human approval gates between planning and execution?

#### GitHub Copilot Credits Integration
**Vision**: Show real-time credit consumption and budget warnings.

**Pending Investigation**:
- API availability for querying Copilot credit balance
- Granularity of usage data (per-request vs. aggregated)
- Rate limiting considerations

#### Worktree Support
**Vision**: Run multiple Ralph sessions in parallel using git worktrees.

**Potential Implementation**:
```bash
ralph run --worktree --task "Feature A"  # Creates new worktree
ralph run --worktree --task "Feature B"  # Another parallel session
ralph sessions                            # List active worktree sessions
```

#### Dry-Run Cost Estimation
**Vision**: Preview estimated iterations and token usage before starting.

**Approach**:
- Analyze task complexity
- Use historical data from similar tasks
- Provide confidence intervals

---

## 📊 Issue Dependency Graph

```
Phase 1 (Foundation)
#1 Project Setup ──────┬──→ #2 CLI Framework ──→ #5 Run Command
                       │           │
                       │           └──→ #6 Config/Init
                       │
                       └──→ #3 Copilot SDK ──→ #4 Loop Engine ──→ #5

Phase 2 (Plan Management)  
#6 ──→ #7 Local Markdown Plan ──┬──→ #9 Progress Tracking
                                │
#6 ──→ #8 GitHub Issues Plan ───┘
                                     
#4 ──→ #10 Context Building

Phase 3 (Safety)
#4 ──→ #11 Git Branch Isolation ──→ #12 Auto Commits ──→ #13 Rollback
#4 ──→ #14 Loop Limits
#11 ──→ #15 File Safeguards

Phase 4 (Polish)
#5 ──→ #16 Help System
All ──→ #17 README
All ──→ #18 Cookbook
#6 ──→ #19 MCP Support
#9 ──→ #20 Status Command
```

---

## 🛠️ Technical Decisions Summary

| Decision            | Choice       | Rationale                                                         |
| ------------------- | ------------ | ----------------------------------------------------------------- |
| **Language**        | TypeScript   | Best Copilot SDK support, AI agents excel at it, npm distribution |
| **CLI Framework**   | Commander.js | Mature, well-documented, TypeScript support                       |
| **Package Manager** | npm          | Cross-platform, matches GitHub Copilot CLI                        |
| **Node Version**    | 18+ LTS      | Modern features, long-term support                                |
| **Config Format**   | JSON         | Simple, widely supported, good tooling                            |
| **Progress Format** | Markdown     | Human-friendly, AI-friendly, version-controllable                 |
| **Git Integration** | Simple-git   | Reliable Node.js git wrapper                                      |

---

## ✅ Pre-Implementation Checklist

Before delegating to GitHub Copilot Coding Agent:

1. [ ] Create repository `rpothin/ralph-cli` with suggested description and topics
2. [ ] Create all 20 issues from this plan with proper labels
3. [ ] Set up issue dependencies/references
4. [ ] Create labels: `phase-1`, `phase-2`, `phase-3`, `phase-4`, `priority-high`, `priority-medium`, `priority-low`, `setup`, `core`, `cli`, `command`, `integration`, `copilot`, `configuration`, `plan-management`, `github`, `progress-tracking`, `safety`, `git`, `documentation`, `extensibility`
5. [ ] Add `ralph-ready` label for issues ready for the coding agent

---

## 🎯 Success Criteria

The MVP is complete when a user can:

1. **Install**: `npm install -g @rpothin/ralph-cli`
2. **Initialize**: `ralph init` in any git repository
3. **Run a loop**: `ralph run --task "Fix the bug in login form"`
4. **See progress**: `ralph status` shows iteration progress
5. **Rollback safely**: `ralph rollback` undoes the last iteration
6. **Work from GitHub Issues**: `ralph run --plan github --label "ralph-ready"`

All while being:
- ✅ Safe (auto-branching, checkpoints, limits)
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Well-documented (--help, README, cookbook)
- ✅ Simple (minimal configuration required)

---

**Ready to proceed?** 

Once you've reviewed this plan and created the repository, I can help you:
1. Create all 20 issues in the repository
2. Set up the initial project structure
3. Begin delegating issues to GitHub Copilot Coding Agent

Let me know if you'd like any adjustments to the plan before we proceed!
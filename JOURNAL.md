# GitHub Copilot Ralph CLI Development Journal

## Credits
- **Original Concept**: Ralph Wiggum loop by [Geoffrey Huntley](https://ghuntley.com/ralph/)
- **This Implementation**: [Raphael Pothin](https://github.com/rpothin)

## 2026-01-24 - Issue #1: Project Initialization

### Completed
- Initialized npm project with TypeScript configuration
- Set up ESLint (flat config) and Prettier for code quality
- Created directory structure: src/commands, src/core, src/integrations, src/types, src/utils, docs, examples, bin
- Configured tsconfig.json targeting ES2022 with NodeNext module resolution and strict mode
- Added build scripts for TypeScript compilation
- Created .gitignore, .editorconfig, .prettierrc configuration files
- Updated README.md with project vision and documentation

### Technical Decisions
- Using `commander` for CLI argument parsing (installed)
- Using `chalk`, `ora`, `picocolors` for terminal output
- Using `tsx` for development mode
- Using ESLint flat config (eslint.config.mjs) with typescript-eslint
- Node.js 18+ required (engines field in package.json)

### Build Commands
- `npm run build` - Compile TypeScript to dist/
- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier
- `npm run typecheck` - Type checking without emit

## 2026-01-24 - Issue #2: CLI Entry Point and Command Framework

### Completed
- Created bin/ralph.js entry point that loads dist/cli.js
- Implemented src/cli.ts as main CLI entry with commander
- Added all 5 command stubs: init, run, status, rollback, config
- Added global flags: --version, --help, --verbose, --quiet
- Implemented colored output utilities (src/utils/output.ts) using chalk and ora
- Added shell detection (src/utils/shell.ts) for bash, zsh, fish, powershell, cmd
- Added cross-platform path handling (src/utils/paths.ts)

### Technical Decisions
- Using commander's hook system for verbosity handling
- Verbosity levels: quiet (minimal), normal (default), verbose (debug info)
- Shell detection via SHELL env var on Unix, PSModulePath/ComSpec on Windows
- Config directory follows XDG spec on Unix, APPDATA on Windows

## 2026-01-24 - Issue #3: GitHub Copilot SDK Integration

### Completed
- Installed @octokit/rest for GitHub API access
- Implemented GitHub authentication (src/integrations/auth.ts)
  - Priority: 1. GitHub CLI (`gh auth token`), 2. Environment variable (GITHUB_TOKEN/GH_TOKEN)
- Created CopilotAgent class (src/integrations/copilot-agent.ts) with:
  - `initialize()`: Set up agent session with authentication
  - `execute(prompt)`: Send prompt and get response with retry logic
  - `getTokenUsage()`: Return token consumption metrics
  - Model selection support
- Implemented TokenTracker class for token usage tracking
- Added exponential backoff retry logic for API errors

### Technical Decisions
- Token estimation uses ~4 characters per token heuristic
- CopilotError class distinguishes retryable vs non-retryable errors
- Default config: gpt-4 model, 4096 max tokens, 3 retries
- Agent has placeholder API call - actual implementation depends on Copilot API availability

## 2026-01-24 - Issue #4: Core Loop Engine Implementation

### Completed
- Created LoopEngine class (src/core/loop-engine.ts) with:
  - `start(task)`: Begin loop execution
  - `pause()`: Request pause at next iteration boundary
  - `resume()`: Resume paused loop
  - `stop()`: Gracefully stop loop
- Implemented core loop pattern with context building, agent execution, progress tracking
- Created LoopEventEmitter (src/core/loop-events.ts) with typed events:
  - start, iterationStart, iterationEnd, pause, resume, complete, error, stop, tokenUsage
- Added IterationRecord and FullLoopState types for tracking

### Technical Decisions
- Loop checks for pause/stop between iterations (cooperative cancellation)
- Iteration delay (500ms default) between iterations to prevent overwhelming
- Event-driven architecture allows subscribers to monitor loop progress
- Each iteration builds a prompt with task context and previous progress

## 2026-01-24 - Issue #5: Basic `run` Command Implementation

### Completed
- Implemented `ralph run` command with all options:
  - `--task/-t`: Inline task description
  - `--file/-f`: Read task from file
  - `--max-iterations/-n`: Limit iterations (default: 10)
  - `--max-tokens`: Token budget (default: 100,000)
  - `--model/-m`: Model selection (default: gpt-4)
  - `--dry-run`: Preview without execution
- Added real-time progress display via event listeners
- Shows iteration count, token usage, and elapsed time
- SIGINT/SIGTERM handlers for graceful Ctrl+C shutdown
- Comprehensive final summary with status, iterations, tokens, time

### Technical Decisions
- Signal handlers allow double-Ctrl+C for force quit
- Dry run mode displays task content for verification
- Uses spinner during loop execution
- Formats large numbers with locale-specific separators

## 2026-01-24 - Issue #6: Configuration System with `init` Command

### Completed
- Implemented `ralph init` command:
  - Detects git repository
  - Creates `.ralph/` directory
  - Supports --local, --github, --plan-source options
  - Saves configuration to `.ralph/config.json`
- Created ConfigManager class (src/core/config-manager.ts):
  - Loads config from: CLI flags > env vars > local > global > defaults
  - Saves config to local or global files
  - Validates config values
- Implemented `ralph config` command:
  - `get [key]`: Get config value(s)
  - `set <key> <value>`: Set config value
  - `list`: List all config
  - `reset --force`: Reset to defaults
  - `path`: Show config file paths
- Added environment variable support (RALPH_* prefix)

### Technical Decisions
- Config priority: CLI > env > local > global > defaults
- XDG Base Directory spec for Unix, APPDATA for Windows
- Environment variables use SCREAMING_SNAKE_CASE with RALPH_ prefix
- Type-safe config key validation

## 2026-01-24 - Issue #7: Local Markdown Plan Source

### Completed
- Created PlanManager interface (src/core/plan-manager.ts) for plan sources
- Implemented markdown-parser.ts for parsing task lists and YAML frontmatter
- Created LocalMarkdownPlan class implementing PlanManager interface
- Added --plan/-p option to run command
- Supports nested task hierarchies (indented items)
- Updates checkboxes in source file when tasks complete

### Technical Decisions
- Task IDs generated from line numbers (task-N)
- Frontmatter parsed with simple key:value parsing
- Indentation level calculated assuming 2 spaces per level
- Parent task tracking via stack for nested tasks
- Task status persisted by updating checkbox in source Markdown

## 2026-01-24 - Issue #8: GitHub Issues Plan Source

### Completed
- Created GitHubPlan class implementing PlanManager interface
- Added --github/-g option to run command (format: owner/repo)
- Support issue filtering: --label, --milestone, --assignee
- When starting task: assigns current user, adds "in-progress" label
- Adds progress comments to issues during execution
- Closes issue when task completes successfully
- Falls back gracefully when operations fail

### Technical Decisions
- Uses @octokit/rest for GitHub API access
- Task IDs formatted as github-{issue_number}
- Default in-progress label is "in-progress" (configurable)
- Comments enabled by default (configurable via addComments)

## 2026-01-24 - Issue #9: Progress Tracking with Markdown Artifacts

### Completed
- Created ProgressTracker class (src/core/progress-tracker.ts)
- Generates .ralph/progress.md with session info and iteration log
- Updates progress file after each iteration via event listener
- Enhanced status command to display progress file contents
- Added --json flag for machine-readable output
- Supports lastCheckpoint field for git commit hashes

### Technical Decisions
- Progress saved to .ralph/progress.md in project root
- SessionData type for JSON serialization
- Status command reads and displays first 30 lines of progress
- Iteration records include timestamps, tokens, success status

## 2026-01-24 - Issue #10: Task Context Building

### Completed
- Created ContextBuilder class (src/core/context-builder.ts)
- Gathers task-relevant files using git grep for keyword matches
- Includes git diff (staged/unstaged changes) in context
- Includes recent git history (configurable limit, default 5 commits)
- Includes project structure overview
- Manages context size with token estimation (~4 chars per token)
- Added --context <glob...> flag to run command for explicit files
- Supports custom prompt templates via configuration (promptTemplate)
- Implements default Ralph prompt pattern with placeholders

### Technical Decisions
- Installed `glob` package for file pattern matching
- Context truncation keeps 70% start, 25% end when exceeding limits
- Files larger than 50KB skipped in explicit context
- Keyword extraction filters common stop words
- Limits to 5 relevant files and 3 top keywords for efficiency

## 2026-01-24 - Issue #11: Git Branch Isolation

### Completed
- Created GitBranchManager class (src/core/git-branch-manager.ts)
- Auto-creates ralph/{task-slug}-{timestamp} branches from main/master
- Added --branch flag for custom branch names
- Added --force flag to skip confirmation prompts
- Detects clean/dirty working directory status
- Auto-stashes changes when dirty (with option to pop later)
- Integrated branch management into run command

### Technical Decisions
- Branch prefix configurable (default: "ralph/")
- Branch name format: {prefix}{slug/id}-{YYYYMMDD}
- Uses git rev-parse to check if in git repository
- Warns but proceeds on non-main, non-Ralph branches

## 2026-01-24 - Issue #12: Automatic Checkpoint Commits

### Completed
- Created CheckpointManager class (src/core/checkpoint-manager.ts)
- Auto-commits after each successful iteration
- Commit message format: `ralph: iteration {n} - {summary}`
- Full message includes token usage and file count
- Added --no-commit flag to disable auto-commits
- Tracks checkpoints with commit hashes for rollback
- Skips commit if no files were modified
- Integrated into run command event handler

### Technical Decisions
- Checkpoint tracking stored in memory (not persisted across sessions)
- Supports soft rollback (keeps changes) and hard rollback (discards)
- Can rollback by N iterations or to specific commit hash
- Message prefix configurable (default: "ralph:")

## 2026-01-24 - Issue #13: Rollback Command Implementation

### Completed
- Enhanced 'ralph rollback' command with full functionality
- Added --iterations <n> to undo N iterations
- Added --to <hash> to rollback to specific commit
- Added --all to undo entire Ralph session
- Added --list to show available Ralph checkpoints
- Shows preview of files affected before rollback
- Requires --force flag for all destructive operations
- Uses git log to find Ralph commits (by "ralph:" prefix)

### Technical Decisions
- Uses hard reset (git reset --hard) for rollback
- Finds pre-session commit by looking for parent of first Ralph commit
- Lists up to 20 recent checkpoints with --list
- Shows up to 5 affected files in preview, with count of remaining

## 2026-01-24 - Issue #14: Loop Limits and Guardrails

### Completed
- Enhanced LoopEngine with comprehensive guardrails
- Added maxDurationMinutes option with --timeout flag
- Added --unlimited flag for > 50 iterations
- Warnings emitted at 80% threshold (configurable)
- Circuit breaker pauses after 3 consecutive failures
- Added warning event type to LoopEvents
- Tracks consecutive failures for circuit breaker logic

### Technical Decisions
- Warning threshold configurable (default 0.8 = 80%)
- Max consecutive failures before pause: 3 (configurable)
- Duration check uses Date.now() - startedAt
- Warnings only emitted once per type per session
- Circuit breaker triggers 'warning' event with 'circuit-breaker' type

## 2026-01-24 - Issue #15: File Deletion Safeguards

### Completed
- Created FileSafeguardManager class (src/core/file-safeguard.ts)
- Tracks baseline files via git ls-files at session start
- Saves baseline to .ralph/baseline-files.json
- Blocks deletion of pre-existing files (with warning)
- Added --allow-delete flag to override protection
- Enhanced status command with --files flag
- Shows created and modified files since baseline

### Technical Decisions
- Baseline snapshot stored in .ralph/baseline-files.json
- Uses git ls-files for tracked files only
- canDelete() method for checking before deletion
- Cleanup removes baseline file at session end
- Status --files compares git status against baseline

## 2026-01-24 - Issue #16: Comprehensive CLI Help System

### Completed
- Enhanced main --help with examples, quick start, tips
- Added examples and "See also" sections to run, init, rollback commands
- Implemented 'ralph help <command>' as alias
- Added tips for new users in main help
- All commands now have detailed help with usage patterns

### Technical Decisions
- Used commander's addHelpText('after') for examples
- Help command looks up commands by name
- Kept examples concise (5-6 per command)
- "See also" section cross-references related commands

## 2026-01-24 - Issue #17: README and Getting Started Guide

### Completed
- Rewrote README.md with comprehensive documentation
- Added npm, license, and node.js badges
- Explained the Ralph Wiggum pattern philosophy
- Added 5-minute Quick Start guide
- Documented all configuration options in table format
- Added Safety Features section with details
- Added Troubleshooting section with common issues
- Added Philosophy section explaining design principles

### Technical Decisions
- Used emoji icons for visual feature scanning
- Configuration table for quick reference
- Code blocks for all examples
- Linked to CONTRIBUTING.md for contributors

## 2026-01-24 - Issue #18: Cookbook and Patterns Documentation

### Completed
- Created docs/cookbook.md with 6 usage patterns
- Bug Fix Loop pattern with tips and pitfalls
- Feature Implementation pattern with plan file example
- Refactoring Session pattern emphasizing tests
- Test Coverage pattern with coverage goals
- Documentation Sprint pattern for doc generation
- Code Review Follow-up pattern with PR feedback plan
- Added comprehensive Troubleshooting section
- Added "When NOT to Use Ralph" guidance
- Added Best Practices Summary

### Technical Decisions
- Table of contents for quick navigation
- Each pattern has consistent structure
- Example commands use realistic scenarios
- Pitfalls highlight real-world mistakes
- ✅ ⚠️ ❌ emoji for quick scanning in "When NOT to use"

## 2026-01-24 - Issue #19: MCP Tool Extension Support

### Completed
- Created MCPToolManager class (src/integrations/mcp-tools.ts)
- Supports stdio and http transports for MCP servers
- Added MCPServerConfiguration to config schema
- Created docs/mcp-tools.md with comprehensive documentation
- Added example MCP server implementations (Node.js and Python)
- Exported MCPToolManager from integrations/index.ts

### Technical Decisions
- stdio transport spawns child process, communicates via JSON lines
- http transport uses REST API (GET /tools, POST /execute)
- 30 second timeout for tool execution
- Explicit typing with Buffer for stdout data handlers
- Uses `delete` operator for optional property cleanup (exactOptionalPropertyTypes)

## 2026-01-24 - Issue #20: Status Command and Session Management

### Completed
- Enhanced `ghcralph status` command with rich session information
- Shows current session status, task, branch, iteration progress, tokens
- Added progress bar visualization with color coding
- Shows modified files with status indicators (+/~/-)
- Added --history flag to show past GitHub Copilot Ralph sessions from git log
- Added contextual tips based on session status
- Color-coded output for quick scanning
- Status icons for active/complete/failed/paused states

### Technical Decisions
- Parse progress.md to extract session metadata
- Use git log --grep for finding ghcralph commits
- Group sessions in history by detecting iteration number gaps
- Regex to strip emoji safely without eslint character class issues

## 2026-01-24 - Feedback Adjustments: Rebranding and Attribution

### Changes Made
- Added proper attribution to Geoffrey Huntley for the Ralph Wiggum loop concept
- Credited Raphael Pothin as the creator of this opinionated interpretation
- Renamed CLI command from `ralph` to `ghcralph` (GitHub Copilot Ralph)
- Changed package name from `ralph-cli` to `ghcralph-cli`
- Updated branding from "Ralph CLI" to "GitHub Copilot Ralph"
- Changed default model from `gpt-4` to `gpt-4.1` (0x multiplier for cost efficiency)
- Updated branch prefix from `ralph/` to `ghcralph/`
- Updated state directory from `.ralph/` to `.ghcralph/`
- Added Prerequisites section with GitHub Copilot CLI requirement
- Updated all documentation, help text, and examples

### Technical Decisions
- `ghcralph` chosen to emphasize GitHub Copilot integration
- `gpt-4.1` as default model due to 0x multiplier (cost-free tier)
- GitHub Copilot CLI is a pre-requisite for the underlying SDK

## 2026-01-24 - Test Suite Implementation (Part 1)

### Completed
- Set up Vitest test framework with coverage support
- Added test scripts: `npm run test`, `npm run test:watch`, `npm run test:coverage`
- Created comprehensive tests for core components:
  1. **config-schema.test.ts** (11 tests) - DEFAULT_CONFIG, isValidConfigKey, validateConfigValue, parseConfigValue
  2. **markdown-parser.test.ts** (14 tests) - parseMarkdownPlan, toTask, updateTaskCheckbox
  3. **context-builder.test.ts** (10 tests) - buildContext, token estimation, file inclusion, custom templates
  4. **loop-events.test.ts** (11 tests) - Event emitter for start, iterationStart/End, complete, error, warning, pause/resume
  5. **progress-tracker.test.ts** (15 tests) - generateMarkdown, save, hasSession, clear, toJSON
  6. **paths.test.ts** (16 tests) - normalizePath, joinPath, getHomeDir, getConfigDir, getLocalStateDir
  7. **shell.test.ts** (13 tests) - detectShell, getShellConfigPath

### Technical Decisions
- Using Vitest for modern, fast ESM-compatible testing
- Tests use temp directories for file system operations
- Mock environment variables for platform-specific tests
- 90 tests passing with good coverage

## 2026-01-24 - Test Suite Implementation (Part 2)

### Completed
- Continued comprehensive test suite for Git-related and management components:
  8. **git-branch-manager.test.ts** (14 tests) - isGitRepository, getCurrentBranch, getWorkingDirStatus, generateBranchName, createAndSwitchBranch, stashChanges, popStash
  9. **checkpoint-manager.test.ts** (27 tests) - createCheckpointManager, isAutoCommitEnabled, getCheckpoints, getLastCheckpoint, hasChangesToCommit, getModifiedFiles, stageAllChanges, createCheckpoint, rollbackTo, hardRollbackTo, rollbackIterations, getInitialCommit, rollbackAll
  10. **file-safeguard.test.ts** (19 tests) - initialize, isBaselineFile, trackFileCreation, trackFileModification, canDelete, getSummary, getDetails, cleanup
  11. **config-manager.test.ts** (17 tests) - constructor, getConfig, get, set, reset, load, saveLocal, hasLocalConfig, initLocal, getGlobalConfigPath, getLocalConfigPath

### Test Summary
- **Total Tests**: 167 tests across 11 test files
- **All tests passing**: ✅
- **Test Categories**:
  - Core utilities: 90 tests (Part 1)
  - Git and management components: 77 tests (Part 2)

### Technical Notes
- Git tests use real temporary git repositories
- Checkpoint tests verify actual git commit/rollback operations
- File safeguard tests validate deletion protection for baseline files
- Config manager tests verify file persistence and environment variable handling

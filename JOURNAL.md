# Ralph CLI Development Journal

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

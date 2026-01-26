# Refinement Plan for Version 0.1.0

I have provisioned a separated repository to test ghcralph in isolation from source code getting it directly from npm registry and discovered a few things I would like your help to refine to be able to push a new enhanced version of the package to npm registry.

## Initial Context

You will find below the context of the repository created to test ghcralph in isolation. Small complementary detail: the tests have been run from a GitHub Codespace using a devcontainer.

### Devcontainer

```json
// For format details, see https://aka.ms/devcontainer.json. For config options, see the
// README at: https://github.com/devcontainers/templates/tree/main/src/typescript-node
{
	"name": "Node.js & TypeScript",
	// Or use a Dockerfile or Docker Compose file. More info: https://containers.dev/guide/dockerfile
	"image": "mcr.microsoft.com/devcontainers/typescript-node:4-24-bookworm",
	"features": {
		"ghcr.io/devcontainers/features/copilot-cli:1": {},
		"ghcr.io/devcontainers/features/github-cli:1": {}
	},
	"customizations": {
		"vscode": {
			"extensions": [
				"yzhang.markdown-all-in-one",
				"GitHub.copilot"
			]
		}
	},

	// Features to add to the dev container. More info: https://containers.dev/features.
	// "features": {},

	// Use 'forwardPorts' to make a list of ports inside the container available locally.
	// "forwardPorts": [],

	// Use 'postCreateCommand' to run commands after the container is created.
	"postCreateCommand": "npm install -g ghcralph"

	// Configure tool-specific properties.
	// "customizations": {},

	// Uncomment to connect as root instead. More info: https://aka.ms/dev-containers-non-root.
	// "remoteUser": "root"
}
```

### Plan

Same as [the one for the calculator test scenario](../test/integration/calculator/PLAN.md).

## Findings

### Finding 1: Init does not provide interactive experience by default ✅ (Addressed)

```
@rpothin ➜ /workspaces/ghc-ralph-cli-demo (main) $ ghcralph init

🤖 GitHub Copilot Ralph - Initialize

Configuration:
  Plan source: local
  Max iterations: 10
  Max tokens: 100,000
  Model: gpt-4.1
  Auto commit: true
  Branch prefix: ghcralph/

Created:
  /workspaces/ghc-ralph-cli-demo/.ghcralph

✔ GitHub Copilot Ralph initialized successfully!

ℹ Run ghcralph run --task "Your task" to start.
```

The `ghcralph init` command works generting the configuration json file under the expected location with the defined default values.
But even has the creator of the CLI, I was a bit surprised it does not provide an interactive experience by default, which could be improved to enhance user-friendliness.

To enhance the user experience, I would suggest to add an interactive mode by default when running `ghcralph init`,
- first presenting the default values to the user, and asking if they want to keep them or change them,
- then, if they want to change them, prompting for each configuration value one by one,
- finally, summarizing the configuration values to be written in the configuration file and asking for confirmation

For Plan Source, Model (list of models available using GitHub Copilot CLI) and Auto commit, please provide a list of options to choose from.

### Finding 2: Run file and plan parameters confusing ✅ (Addressed)

```
@rpothin ➜ /workspaces/ghc-ralph-cli-demo (main) $ ghcralph run --help
Usage: ghcralph run [options]

Execute an agentic coding loop

Options:
  -t, --task <description>       Task to execute (inline)
  -f, --file <path>              Read task from file
  -p, --plan <path>              Read tasks from a Markdown plan file
  -g, --github <owner/repo>      Use GitHub Issues as plan source
  -l, --label <label>            Filter GitHub issues by label
  --milestone <name>             Filter GitHub issues by milestone
  --assignee <user>              Filter GitHub issues by assignee
  -c, --context <glob...>        Include files matching glob patterns in context
  -b, --branch <name>            Use or create a specific branch name
  --force                        Skip branch confirmation prompts
  --no-commit                    Disable automatic checkpoint commits
  --unlimited                    Allow more than 50 iterations
  --timeout <minutes>            Maximum duration in minutes
  --allow-delete                 Allow deletion of pre-existing files
  -n, --max-iterations <number>  Maximum loop iterations (default: "10")
  --max-tokens <number>          Maximum token budget (default: "100000")
  -m, --model <model>            Copilot model to use (default: "gpt-4")
  --dry-run                      Show what would happen without executing
  -h, --help                     display help for command

Examples:
  $ ghcralph run --task "Add input validation to the login form"
  $ ghcralph run --file tasks/refactor.md --max-iterations 5
  $ ghcralph run --plan TODO.md
  $ ghcralph run --github owner/repo --label "ralph-ready"
  $ ghcralph run --task "Fix bug" --context "src/**/*.ts" --branch fix/login-bug
  $ ghcralph run --task "Large refactor" --unlimited --timeout 60

See also:
  ghcralph status     View current session progress
  ghcralph rollback   Undo recent changes
  ghcralph init       Initialize Ralph in your project
```

I think the `--file` parameter should handle both a one-off task file and a Markdown plan file (auto-detected), instead of having a separate `--plan` parameter.

**Update (2026-01-25):** `--plan` was removed entirely; use `--file` for Markdown plan files.

### Finding 3: Run could benefit from complementay configuration entries for GitHub Issues plan source ✅ (Addressed)

```
@rpothin ➜ /workspaces/ghc-ralph-cli-demo (main) $ ghcralph run --help
Usage: ghcralph run [options]

Execute an agentic coding loop

Options:
  -t, --task <description>       Task to execute (inline)
  -f, --file <path>              Read task from file
  -p, --plan <path>              Read tasks from a Markdown plan file
  -g, --github <owner/repo>      Use GitHub Issues as plan source
  -l, --label <label>            Filter GitHub issues by label
  --milestone <name>             Filter GitHub issues by milestone
  --assignee <user>              Filter GitHub issues by assignee
  -c, --context <glob...>        Include files matching glob patterns in context
  -b, --branch <name>            Use or create a specific branch name
  --force                        Skip branch confirmation prompts
  --no-commit                    Disable automatic checkpoint commits
  --unlimited                    Allow more than 50 iterations
  --timeout <minutes>            Maximum duration in minutes
  --allow-delete                 Allow deletion of pre-existing files
  -n, --max-iterations <number>  Maximum loop iterations (default: "10")
  --max-tokens <number>          Maximum token budget (default: "100000")
  -m, --model <model>            Copilot model to use (default: "gpt-4")
  --dry-run                      Show what would happen without executing
  -h, --help                     display help for command

Examples:
  $ ghcralph run --task "Add input validation to the login form"
  $ ghcralph run --file tasks/refactor.md --max-iterations 5
  $ ghcralph run --plan TODO.md
  $ ghcralph run --github owner/repo --label "ralph-ready"
  $ ghcralph run --task "Fix bug" --context "src/**/*.ts" --branch fix/login-bug
  $ ghcralph run --task "Large refactor" --unlimited --timeout 60

See also:
  ghcralph status     View current session progress
  ghcralph rollback   Undo recent changes
  ghcralph init       Initialize Ralph in your project
```

When using GitHub Issues as plan source, it could be useful to have complementary configuration entries in the `.ghcralph` configuration file to define default values for the owner/repo, label, milestone and assignee filters.

**Update (2026-01-26):** `ghcralph init` now prompts for `githubRepo` (and optionally label/milestone/assignee) only when `planSource=github`.

### Finding 4: Run parameters should not offer overwriting configuration file values ✅ (Addressed)

```
@rpothin ➜ /workspaces/ghc-ralph-cli-demo (main) $ ghcralph run --help
Usage: ghcralph run [options]

Execute an agentic coding loop

Options:
  -t, --task <description>       Task to execute (inline)
  -f, --file <path>              Read task from file
  -p, --plan <path>              Read tasks from a Markdown plan file
  -g, --github <owner/repo>      Use GitHub Issues as plan source
  -l, --label <label>            Filter GitHub issues by label
  --milestone <name>             Filter GitHub issues by milestone
  --assignee <user>              Filter GitHub issues by assignee
  -c, --context <glob...>        Include files matching glob patterns in context
  -b, --branch <name>            Use or create a specific branch name
  --force                        Skip branch confirmation prompts
  --no-commit                    Disable automatic checkpoint commits
  --unlimited                    Allow more than 50 iterations
  --timeout <minutes>            Maximum duration in minutes
  --allow-delete                 Allow deletion of pre-existing files
  -n, --max-iterations <number>  Maximum loop iterations (default: "10")
  --max-tokens <number>          Maximum token budget (default: "100000")
  -m, --model <model>            Copilot model to use (default: "gpt-4")
  --dry-run                      Show what would happen without executing
  -h, --help                     display help for command

Examples:
  $ ghcralph run --task "Add input validation to the login form"
  $ ghcralph run --file tasks/refactor.md --max-iterations 5
  $ ghcralph run --plan TODO.md
  $ ghcralph run --github owner/repo --label "ralph-ready"
  $ ghcralph run --task "Fix bug" --context "src/**/*.ts" --branch fix/login-bug
  $ ghcralph run --task "Large refactor" --unlimited --timeout 60

See also:
  ghcralph status     View current session progress
  ghcralph rollback   Undo recent changes
  ghcralph init       Initialize Ralph in your project
```

Some of the parameters available when running `ghcralph run` are already defined in the configuration file created when running `ghcralph init`. To avoid confusion and potential misconfiguration, I would suggest to remove from the `ghcralph run` parameters list any parameter that is already defined in the configuration file, so that the configuration file remains the single source of truth for those values.

This ajustement could be completed by enhancing the documentation to clearly indicate which parameters can be set only via the configuration file and which ones can be set only via command line parameters and also the output of the help command to reflect this distinction.

### Finding 5: Run dry run does present a model different than the one defined in the configuration file ✅ (Addressed)

```
@rpothin ➜ /workspaces/ghc-ralph-cli-demo (main) $ ghcralph run --file PLAN.md --dry-run
ℹ Loaded 11 tasks from PLAN.md
ℹ Selected task from plan: Create calculator.sh with basic structure

🤖 GitHub Copilot Ralph - Run

  Plan: PLAN.md
  Task: Create calculator.sh with basic structure
  Model: gpt-4
  Max iterations: 10
  Max tokens: 100,000

⚠ Dry run mode - no changes will be made

Task content:
Create calculator.sh with basic structure

✔ Dry run complete - no actions taken
```

```
@rpothin ➜ /workspaces/ghc-ralph-cli-demo (main) $ ghcralph config list

📋 Ralph Configuration

  planSource: local
  maxIterations: 10
  maxTokens: 100000
  defaultModel: gpt-5.2-codex
  autoCommit: true
  branchPrefix: ghcralph/
```

When running `ghcralph run --dry-run`, the model presented in the summary is `gpt-4`, while the configuration file indicates `gpt-5.2-codex` as the default model. It indicates either the dry run is not reading the configuration file correctly, or the model value is hardcoded in the dry run output or worse is not being used at all by the run command.

**Update (2026-01-26):** `ghcralph run` now always loads config and uses `defaultModel` for both dry-run output and actual runs.

### Finding 6: First simple run generates an error

```
@rpothin ➜ /workspaces/ghc-ralph-cli-demo (main) $ ghcralph run --plan PLAN.md
ℹ Loaded 11 tasks from PLAN.md
ℹ Selected task from plan: Create calculator.sh with basic structure

🤖 GitHub Copilot Ralph - Run

  Plan: PLAN.md
  Task: Create calculator.sh with basic structure
  Model: gpt-4
  Max iterations: 10
  Max tokens: 100,000

⚠ Working directory has 0 modified files and 1 untracked files
ℹ Use --force to proceed anyway, or commit/stash your changes first
ℹ Changes stashed automatically
file:///usr/local/share/npm-global/lib/node_modules/ghcralph/dist/core/git-branch-manager.js:140
            throw new Error(`Failed to create branch: ${message}`);
                  ^

Error: Failed to create branch: Command failed: git checkout -b "ralph/task-15-20260125"
Switched to a new branch 'ralph/task-15-20260125'

This repository is configured for Git LFS but 'git-lfs' was not found on your path. If you no longer wish to use Git LFS, remove this hook by deleting the 'post-checkout' file in the hooks directory (set by 'core.hookspath'; usually '.git/hooks').


    at GitBranchManager.createAndSwitchBranch (file:///usr/local/share/npm-global/lib/node_modules/ghcralph/dist/core/git-branch-manager.js:140:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async GitBranchManager.prepareForOperation (file:///usr/local/share/npm-global/lib/node_modules/ghcralph/dist/core/git-branch-manager.js:265:13)
    at async Command.<anonymous> (file:///usr/local/share/npm-global/lib/node_modules/ghcralph/dist/commands/run.js:272:30)

Node.js v24.12.0
```

When running `ghcralph run --plan PLAN.md` for the first time in a repository initialized with `ghcralph init`, I get an error related to Git LFS when the CLI tries to create and switch to a new branch for the task execution.

I could potentially fix this adjusting my devcontainer to include Git LFS installation, but I think the CLI should handle this more gracefully, either by checking for Git LFS presence before attempting to create a branch or by providing a clearer error message with guidance on how to resolve the issue or even better not requiring Git LFS at all for basic operations.

If the need for Git LFS for basic operations is not negotiable, it should be documented clearly in the CLI documentation (new markdown file under docs/) to inform users about this prerequisite.

But launching the same command a second time seems to work as expected but end blocked without giving back control to the user forcing to interrupt the process:

```
@rpothin ➜ /workspaces/ghc-ralph-cli-demo (ralph/task-15-20260125) $ ghcralph run --plan PLAN.md
ℹ Loaded 11 tasks from PLAN.md
ℹ Selected task from plan: Create calculator.sh with basic structure

🤖 GitHub Copilot Ralph - Run

  Plan: PLAN.md
  Task: Create calculator.sh with basic structure
  Model: gpt-4
  Max iterations: 10
  Max tokens: 100,000

⚠ Working directory has 0 modified files and 1 untracked files
ℹ Use --force to proceed anyway, or commit/stash your changes first
ℹ Changes stashed automatically
  Branch: ralph/task-15-20260125
⠴ Running agentic loop...ℹ Copilot agent initialized (model: gpt-4)
⠼ Running agentic loop...ℹ Executing 2 action(s)...
ℹ Created: calculator.sh
ℹ Executing: chmod +x calculator.sh && ./calculator.sh 5 + 3
ℹ Iteration 1: ✓ (1,099 tokens)
  [ACTION:CREATE]
⠇ Running agentic loop...ℹ Executing 1 action(s)...
ℹ Task complete: calculator.sh created with basic structure including shebang, argument validation, case statement for operations, and addition operation working correctly (tested with 5 + 3 = 8)
ℹ AI marked task complete: calculator.sh created with basic structure including shebang, argument validation, case statement for operations, and addition operation working correctly (tested with 5 + 3 = 8)
ℹ Running verification hooks...
ℹ ✓ All verification hooks passed - task complete!
ℹ Iteration 2: ✓ (1,301 tokens)
  Task complete: calculator.sh created with basic structure including shebang, argument validation, case statement for operations, and addition operation working correctly (tested with 5 + 3 = 8)

📊 Summary

  Status: completed
  Iterations: 2/10
  Tokens used: 2,400
  Elapsed time: 18s
  Successful iterations: 2

ℹ Task marked as complete in plan file
✔ Loop completed successfully
^C⚠ Shutdown requested - completing current iteration...
⚠ No active loop to stop
node:internal/streams/writable:489
    err = new ERR_STREAM_DESTROYED('write');
          ^

Error [ERR_STREAM_DESTROYED]: Cannot call write after a stream was destroyed
    at _write (node:internal/streams/writable:489:11)
    at Writable.write (node:internal/streams/writable:508:10)
    at /usr/local/share/npm-global/lib/node_modules/ghcralph/node_modules/vscode-jsonrpc/lib/node/ril.js:88:29
    at new Promise (<anonymous>)
    at WritableStreamWrapper.write (/usr/local/share/npm-global/lib/node_modules/ghcralph/node_modules/vscode-jsonrpc/lib/node/ril.js:78:16)
    at StreamMessageWriter.doWrite (/usr/local/share/npm-global/lib/node_modules/ghcralph/node_modules/vscode-jsonrpc/lib/common/messageWriter.js:99:33)
    at /usr/local/share/npm-global/lib/node_modules/ghcralph/node_modules/vscode-jsonrpc/lib/common/messageWriter.js:90:29 {
  code: 'ERR_STREAM_DESTROYED'
}

Node.js v24.12.0
```

This indicates that the run process does not terminate correctly after completing the task, leading to a situation where the user has to manually interrupt the process. The CLI should ensure that it exits gracefully after task completion, returning control to the user without requiring manual intervention.
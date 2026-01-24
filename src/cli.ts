#!/usr/bin/env node
/**
 * GitHub Copilot Ralph CLI - Main Entry Point
 *
 * A cross-platform CLI for running autonomous agentic coding loops
 * using the Ralph Wiggum pattern with GitHub Copilot.
 *
 * This is an opinionated interpretation of Geoffrey Huntley's Ralph Wiggum loop
 * (https://ghuntley.com/ralph/) created by Raphael Pothin.
 */

import { Command } from 'commander';
import { VERSION, NAME } from './index.js';
import {
  registerInitCommand,
  registerRunCommand,
  registerStatusCommand,
  registerRollbackCommand,
  registerConfigCommand,
} from './commands/index.js';
import { setVerbosity, banner, debug, detectShell, dim, code } from './utils/index.js';

const program = new Command();

// Configure program metadata
program
  .name(NAME)
  .description('GitHub Copilot Ralph - Autonomous agentic coding loops with GitHub Copilot')
  .version(VERSION, '-v, --version', 'Show version number')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress non-essential output')
  .addHelpText('after', `
${dim('Examples:')}
  $ ghcralph init                          # Initialize GitHub Copilot Ralph in your project
  $ ghcralph run --task "Add tests"        # Run a coding loop for a task
  $ ghcralph run --plan TODO.md            # Execute tasks from a plan file
  $ ghcralph run --github owner/repo       # Work through GitHub Issues
  $ ghcralph status                        # Check current session status
  $ ghcralph rollback --iterations 2       # Undo last 2 iterations
  $ ghcralph config list                   # View current configuration

${dim('Quick Start:')}
  1. Ensure GitHub Copilot CLI is installed: ${code('gh extension install github/gh-copilot')}
  2. Run ${code('ghcralph init')} in your project
  3. Run ${code('ghcralph run --task "your task"')} to start coding
  4. GitHub Copilot Ralph will create a branch, make changes, and checkpoint automatically

${dim('Tips:')}
  - Use --dry-run to preview what GitHub Copilot Ralph would do
  - Use --verbose for detailed logging
  - Use --force to skip confirmation prompts
  - Checkpoints are auto-committed; use 'ghcralph rollback' to undo

${dim('Documentation:')} https://github.com/rpothin/ghc-ralph-cli
${dim('Original concept:')} https://ghuntley.com/ralph/
`)
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts() as { verbose?: boolean; quiet?: boolean };

    // Set verbosity level
    if (opts.quiet) {
      setVerbosity('quiet');
    } else if (opts.verbose) {
      setVerbosity('verbose');
    }

    // Show banner in verbose mode
    if (opts.verbose) {
      banner();
      const shell = detectShell();
      debug(`Shell detected: ${shell.type} (${shell.path ?? 'unknown path'})`);
      debug(`Platform: ${shell.isWindows ? 'Windows' : 'Unix-like'}`);
    }
  });

// Register all commands
registerInitCommand(program);
registerRunCommand(program);
registerStatusCommand(program);
registerRollbackCommand(program);
registerConfigCommand(program);

// Add help command as alias
program
  .command('help [command]')
  .description('Display help for a command')
  .action((commandName?: string) => {
    if (commandName) {
      const cmd = program.commands.find(c => c.name() === commandName);
      if (cmd) {
        cmd.outputHelp();
      } else {
        console.log(`Unknown command: ${commandName}`);
        console.log(`Run ${code('ghcralph --help')} to see available commands.`);
      }
    } else {
      program.outputHelp();
    }
  });

// Parse command line arguments
program.parse();

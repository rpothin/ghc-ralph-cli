#!/usr/bin/env node
/**
 * Ralph CLI - Main Entry Point
 *
 * A cross-platform CLI for running autonomous agentic coding loops
 * using the Ralph Wiggum pattern with GitHub Copilot.
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
  .description('A cross-platform CLI for running autonomous agentic coding loops with GitHub Copilot')
  .version(VERSION, '-v, --version', 'Show version number')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress non-essential output')
  .addHelpText('after', `
${dim('Examples:')}
  $ ralph init                          # Initialize Ralph in your project
  $ ralph run --task "Add tests"        # Run a coding loop for a task
  $ ralph run --plan TODO.md            # Execute tasks from a plan file
  $ ralph run --github owner/repo       # Work through GitHub Issues
  $ ralph status                        # Check current session status
  $ ralph rollback --iterations 2       # Undo last 2 iterations
  $ ralph config list                   # View current configuration

${dim('Quick Start:')}
  1. Run ${code('ralph init')} in your project
  2. Run ${code('ralph run --task "your task"')} to start coding
  3. Ralph will create a branch, make changes, and checkpoint automatically

${dim('Tips:')}
  - Use --dry-run to preview what Ralph would do
  - Use --verbose for detailed logging
  - Use --force to skip confirmation prompts
  - Checkpoints are auto-committed; use 'ralph rollback' to undo

${dim('Documentation:')} https://github.com/your-org/ralph-cli
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
        console.log(`Run ${code('ralph --help')} to see available commands.`);
      }
    } else {
      program.outputHelp();
    }
  });

// Parse command line arguments
program.parse();

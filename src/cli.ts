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
import { setVerbosity, banner, debug, detectShell } from './utils/index.js';

const program = new Command();

// Configure program metadata
program
  .name(NAME)
  .description('A cross-platform CLI for running autonomous agentic coding loops')
  .version(VERSION, '-v, --version', 'Show version number')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress non-essential output')
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

// Parse command line arguments
program.parse();

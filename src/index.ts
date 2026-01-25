/**
 * GitHub Copilot Ralph CLI - Entry Point
 *
 * A cross-platform CLI for running autonomous agentic coding loops
 * using the Ralph Wiggum pattern with GitHub Copilot.
 *
 * Original concept by Geoffrey Huntley (https://ghuntley.com/ralph/)
 * This implementation by Raphael Pothin (https://github.com/rpothin)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string };

export const VERSION = pkg.version;
export const NAME = 'ghcralph';

// Core exports will be added as modules are implemented
export {};

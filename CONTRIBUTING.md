# Contributing to GitHub Copilot Ralph CLI

Thanks for your interest in contributing! This guide covers how to set up the project, run checks, and submit changes.

## Development Setup

1. Install Node.js (>= 18) and npm.
2. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/rpothin/ghc-ralph-cli.git
   cd ghc-ralph-cli
   npm install
   ```
3. Build the CLI:
   ```bash
   npm run build
   ```
4. (Optional) Link the CLI locally:
   ```bash
   npm link
   ```

## Running Tests

```bash
npm test
```

Additional options:

```bash
npm run test:coverage
npm run test:integration
```

## Code Quality

```bash
npm run lint
npm run typecheck
npm run format:check
```

## Pull Request Process

1. Fork the repo and create a feature branch from `main`.
2. Keep changes focused and include relevant tests.
3. Ensure lint, typecheck, and tests pass before opening a PR.
4. Update documentation when behavior or configuration changes.
5. Submit a PR with a clear description of the changes and rationale.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct (v3.0)](https://www.contributor-covenant.org/version/3/0/code_of_conduct/).

Please report unacceptable behavior to the maintainer at [raphael.pothin@gmail.com](mailto:raphael.pothin@gmail.com).

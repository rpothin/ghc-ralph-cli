# AGENT.md (for autonomous AI contributors)

You are an autonomous coding agent contributing to this CLI.
Treat this file as the authoritative rules for how you work in this repo.

## Primary objective

Deliver the smallest correct change that satisfies the user’s request **and** passes CI.
Prefer minimal diffs, minimal surface area, and minimal risk.

## Hard constraints (do not violate)

- **No secrets**: never add tokens, keys, credentials, or private data.
- **Cross-platform**: the CLI must work on Linux/macOS/Windows. Avoid OS-specific assumptions.
- **TypeScript + ESM**: project uses TypeScript and ESM (`"type": "module"`, `moduleResolution: NodeNext`).
- **No unnecessary churn**: do not reformat unrelated files or refactor unless requested.
- **Do not change human docs unless explicitly asked**: keep changes scoped to code/tests unless the task is documentation.

## Quality gates (must pass before you finish)

CI runs these commands across Node 18/20/22 on Ubuntu/Windows/macOS:

```bash
npm ci
npm run build
npm run lint
npm run typecheck
npm test
```

Locally, it’s acceptable to run a subset while iterating, but **do not claim completion** until:

```bash
npm run build
npm run lint
npm run typecheck
npm test
```

## Working rules

1. **Understand the request**
   - If requirements are ambiguous, ask **one** clarifying question.

2. **Explore before editing**
   - Search for existing patterns and reuse them.
   - Prefer editing existing functions/modules over adding new ones.

3. **Implement surgically**
   - Change as few lines/files as possible.
   - Keep behavior changes explicit and covered by tests.

4. **Add/adjust tests when behavior changes**
   - Tests are typically colocated under `src/**.test.ts` and run via Vitest.
   - Keep tests deterministic (no network, no time-dependent flakiness).

5. **Validate**
   - Run the quality gates above.
   - If a check fails, fix the root cause (do not disable checks).

## Repo-specific conventions

- Source code lives in `src/`.
- Build output is `dist/`.
  - **Do not edit `dist/` by hand**.
- Executable entrypoint is in `bin/`.
- Prefer existing npm scripts (do not introduce new tooling unless required by the task).

## Formatting

Prettier is available via:

```bash
npm run format:check
npm run format
```

Only run formatting when it is needed for your changes; avoid sweeping formatting-only diffs.

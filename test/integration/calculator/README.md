# Calculator Integration Test

This directory contains an integration test for the GitHub Copilot Ralph CLI.

> **Note:** This test is excluded from the default `npm test` run. It requires the CLI to generate `calculator.sh` first. See [Running the Integration Test](#running-the-integration-test) below.

## Purpose

Test that the CLI can:
1. Initialize in this directory
2. Read the implementation plan (PLAN.md)
3. Implement a bash calculator script
4. Pass all validation tests

## Contents

- `PLAN.md` - Implementation plan for the calculator script
- `calculator.test.ts` - Vitest tests to validate the output
- `calculator.sh` - Will be created by the CLI (does not exist initially)

## Running the Integration Test

### Prerequisites

1. Build the CLI: `npm run build` (from repository root)
2. Ensure you have GitHub Copilot access configured

### Step 1: Navigate to the test directory

```bash
cd test/integration/calculator
```

### Step 2: Initialize ghcralph

```bash
# From the test directory
node ../../../bin/ghcralph.js init --local
```

### Step 3: Run the CLI to generate calculator.sh

```bash
# Execute the plan to create calculator.sh
node ../../../bin/ghcralph.js run --plan PLAN.md --force
```

### Step 4: Validate the output

```bash
# From the repository root
npm run test:integration
```

Or run just the calculator tests:

```bash
npx vitest run --config vitest.integration.config.ts test/integration/calculator/calculator.test.ts
```

## Expected Outcome

After the CLI runs successfully:
- `calculator.sh` should exist in this directory
- All 15 tests should pass (addition, subtraction, multiplication, division, error handling)

## Troubleshooting

### Tests fail with "No such file or directory"

The CLI hasn't created `calculator.sh` yet. Run steps 2-3 above first.

### CLI completes but tests still fail

Check the generated `calculator.sh` for issues. The CLI may need multiple iterations or manual adjustments for edge cases like division by zero handling.

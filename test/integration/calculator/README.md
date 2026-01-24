# Calculator Integration Test

This directory contains an integration test for the GitHub Copilot Ralph CLI.

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

### Step 1: Initialize ghcralph in this directory
```bash
cd test/integration/calculator
npx ghcralph init --plan-source local --local-plan-file PLAN.md
```

### Step 2: Run the CLI
```bash
npx ghcralph run
```

### Step 3: Validate the output
```bash
npm run test -- test/integration/calculator/calculator.test.ts
```

## Expected Outcome

After the CLI runs, `calculator.sh` should exist and all 16 tests should pass.

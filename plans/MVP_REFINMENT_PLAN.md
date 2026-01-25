## 🚧 Missing Steps for MVP Distribution

Here's what you need to complete before publishing to npm:

### 1. **CONTRIBUTING.md** (Missing)
The README references it but the file doesn't exist.

It should cover at least:
- Development Setup
- Running Tests
- Code Quality
- Pull Request Process
- Code of Conduct - I would like to follow https://www.contributor-covenant.org/version/3/0/code_of_conduct/

### 2. **GitHub Actions CI/CD Workflow** (Missing)
No `.github/workflows` directory detected. You need at least a basic CI workflow:

```yaml name=.github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm test

  publish-dry-run:
    runs-on: ubuntu-latest
    needs: build-and-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm publish --dry-run
```

### 3. **npm Publish Workflow** (Recommended)

```yaml name=.github/workflows/publish.yml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - run: npm ci
      - run: npm run build
      - run: npm test
      
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 4. **package.json Enhancements**

Your `package.json` looks good but needs a few additions for npm distribution:

```json
{
  "files": [
    "dist",
    "bin",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

### 5. **Missing `.npmignore` or Verify `files` Field**
Ensure only necessary files are published. Add a `files` field to `package.json` (shown above) or create:

```text name=.npmignore
src/
test/
*.config.ts
*.config.mjs
tsconfig.json
.ghcralph/
.github/
docs/
PLAN.md
JOURNAL.md
REALIGNMENT_PLAN.md
.devcontainer/
```

### 6. **Test Coverage Expansion** (Recommended)

Your unit tests cover utilities but the core modules need tests:
- `loop-engine.test.ts`
- `response-parser.test.ts`
- `action-executor.test.ts`
- `copilot-agent.test.ts` (mocked)

### 7. **Pre-publish Verification Script**

Add to `package.json`:
```json
{
  "scripts": {
    "prepublishOnly": "npm run lint && npm run typecheck && npm test && npm run build"
  }
}
```
# GitHub Copilot Ralph Cookbook

Common patterns and workflows for getting the most out of GitHub Copilot Ralph.

## Table of Contents

- [Pattern: Bug Fix Loop](#pattern-bug-fix-loop)
- [Pattern: Feature Implementation](#pattern-feature-implementation)
- [Pattern: Refactoring Session](#pattern-refactoring-session)
- [Pattern: Test Coverage](#pattern-test-coverage)
- [Pattern: Documentation Sprint](#pattern-documentation-sprint)
- [Pattern: Code Review Follow-up](#pattern-code-review-follow-up)
- [Troubleshooting](#troubleshooting)
- [When NOT to Use Ralph](#when-not-to-use-ralph)

---

## Pattern: Bug Fix Loop

**Use when:** You have a bug report and want Ralph to investigate and fix it.

### Example Commands

```bash
# Simple bug fix
ghcralph run --task "Fix the login button not responding on mobile devices"

# With relevant context
ghcralph run --task "Fix issue #42: Form validation fails for email addresses" \
  --context "src/components/Form*.tsx" "src/utils/validation.ts"

# From a GitHub issue
ghcralph run --github owner/repo --label "bug"
```

### Tips for Success

1. **Be specific about the bug**: Include error messages, reproduction steps
2. **Provide context files**: Point Ralph to relevant code with `--context`
3. **Start with low iterations**: `--max-iterations 5` for simple bugs
4. **Check after each iteration**: Use `ghcralph status` to monitor progress

### Common Pitfalls

- Too vague descriptions: "Fix the bug" → "Fix TypeError on line 42 of auth.ts"
- Missing context: Ralph works better when you narrow down relevant files
- Not testing: Remember to run your test suite after Ralph's fix

---

## Pattern: Feature Implementation

**Use when:** Building a new feature step by step.

### Example Commands

```bash
# Simple feature
ghcralph run --task "Add a dark mode toggle to the settings page"

# Multi-step feature from a plan
ghcralph run --plan features/user-preferences.md

# With more iterations for complex features
ghcralph run --task "Implement user authentication with JWT" \
  --max-iterations 15 \
  --context "src/auth/**/*.ts"
```

### Tips for Success

1. **Break down large features**: Create a plan file with sub-tasks
2. **Use higher iteration limits**: Features need more steps than bug fixes
3. **Review intermediate checkpoints**: Check progress with `ghcralph rollback --list`
4. **Commit related work first**: Start with a clean git state

### Common Pitfalls

- Feature too large: Break into smaller, testable pieces
- No acceptance criteria: Define what "done" looks like
- Ignoring tests: Ask Ralph to include tests in the task

### Example Plan File

```markdown
# User Authentication Feature

- [ ] Create JWT token generation utility
- [ ] Add login API endpoint
- [ ] Add logout API endpoint
- [ ] Create protected route middleware
- [ ] Add integration tests
```

---

## Pattern: Refactoring Session

**Use when:** Improving code quality without changing behavior.

### Example Commands

```bash
# Specific refactoring
ghcralph run --task "Refactor the UserService class to use dependency injection"

# Code cleanup
ghcralph run --task "Remove unused imports and dead code from src/utils/"

# Performance improvement
ghcralph run --task "Optimize the search function to use memoization" \
  --context "src/services/search.ts"
```

### Tips for Success

1. **Have tests first**: Ensure you can verify behavior is preserved
2. **Be specific**: "Refactor X to use Y pattern" is better than "clean up code"
3. **Use branch isolation**: Ralph auto-creates branches, review before merging
4. **Small refactors**: One concept at a time

### Common Pitfalls

- Refactoring without tests: How will you know nothing broke?
- Too broad scope: "Refactor everything" is not actionable
- Mixing refactoring with features: Keep them separate

---

## Pattern: Test Coverage

**Use when:** Adding tests to existing code.

### Example Commands

```bash
# Add unit tests
ghcralph run --task "Add unit tests for the PaymentService class" \
  --context "src/services/PaymentService.ts"

# Improve coverage
ghcralph run --task "Add tests to achieve 80% coverage for src/utils/"

# Add integration tests
ghcralph run --task "Add integration tests for the /api/users endpoints"
```

### Tips for Success

1. **Point to the code**: Use `--context` to show what needs testing
2. **Specify test framework**: "using Jest" or "using pytest"
3. **Define coverage goals**: "achieve 80% coverage" is measurable
4. **Include edge cases**: "including error handling tests"

### Common Pitfalls

- No existing test setup: Ensure your test framework is configured
- Testing implementation details: Focus on behavior, not internals
- Too many tests at once: Start with critical paths

---

## Pattern: Documentation Sprint

**Use when:** Generating or updating documentation.

### Example Commands

```bash
# Generate API docs
ghcralph run --task "Add JSDoc comments to all exported functions in src/api/"

# Update README
ghcralph run --task "Update README.md to document the new CLI options"

# Create documentation
ghcralph run --task "Create a CONTRIBUTING.md guide for new contributors"
```

### Tips for Success

1. **Point to existing docs**: Show Ralph the documentation style you use
2. **Be specific about format**: "using JSDoc" or "using Markdown"
3. **Include examples**: "with usage examples for each function"
4. **Review output carefully**: Documentation requires human judgment

### Common Pitfalls

- Outdated information: Verify docs match actual behavior
- Generic content: Good docs are specific to your project
- Missing context: Show Ralph example docs you like

---

## Pattern: Code Review Follow-up

**Use when:** Addressing PR feedback systematically.

### Example Commands

```bash
# Address specific feedback
ghcralph run --task "Address code review feedback: add error handling to API calls"

# Multiple review items
ghcralph run --plan pr-feedback.md

# Quick style fixes
ghcralph run --task "Fix linting issues and apply consistent formatting" \
  --max-iterations 3
```

### Example PR Feedback Plan

```markdown
# PR #123 Feedback

- [ ] Add error handling to the fetchUser function
- [ ] Extract magic numbers into constants
- [ ] Add JSDoc comments to public methods
- [ ] Fix typo in error message on line 45
```

### Tips for Success

1. **Create a plan from feedback**: Convert review comments to a checklist
2. **Address one type at a time**: Group similar changes together
3. **Keep iterations low**: Most feedback items are small
4. **Re-run linter**: Ensure changes pass your linting rules

---

## Troubleshooting

### Ralph seems stuck

```bash
# Check what's happening
ghcralph status

# See the last few checkpoints
ghcralph rollback --list

# If needed, stop and rollback
ghcralph rollback --iterations 1
```

### Token budget exhausted

```bash
# Increase budget for next run
ghcralph run --task "Continue previous work" --max-tokens 200000

# Or break task into smaller pieces
```

### Too many iterations

```bash
# For long tasks, use timeout instead of iteration limit
ghcralph run --task "Large refactor" --unlimited --timeout 60

# Or increase iteration limit
ghcralph run --task "..." --max-iterations 30
```

### Changes not what I expected

```bash
# Review what was done
ghcralph rollback --list

# Undo specific iterations
ghcralph rollback --iterations 2

# Start fresh on a different branch
ghcralph run --task "..." --branch new-attempt
```

### Authentication issues

```bash
# Re-authenticate with GitHub CLI
gh auth login

# Or set token directly
export GITHUB_TOKEN=your_token
```

---

## When NOT to Use Ralph

Ralph is powerful but not always the right tool:

### ❌ Don't use Ralph for:

1. **Security-critical code**: Manual review is essential
2. **Database migrations**: Too risky for autonomous changes
3. **Production deployments**: Keep humans in the loop
4. **Code you don't understand**: You should be able to review output
5. **Tasks requiring external context**: Ralph can't call APIs or access the web
6. **Time-sensitive hotfixes**: Manual fixes may be faster

### ⚠️ Use with caution for:

1. **Large refactors**: Break into smaller pieces
2. **Cross-repository changes**: Ralph works on one repo at a time
3. **Performance optimization**: Measure before and after
4. **API design**: Human judgment needed for interfaces

### ✅ Ralph excels at:

1. **Well-defined, scoped tasks**
2. **Repetitive changes across files**
3. **Adding tests to existing code**
4. **Documentation updates**
5. **Bug fixes with clear reproduction steps**
6. **Implementing features from detailed specs**

---

## Best Practices Summary

1. **Start small**: Use low iteration limits until you're confident
2. **Provide context**: Use `--context` to narrow relevant files
3. **Review checkpoints**: Use `ghcralph rollback --list` regularly
4. **Use plans for complex work**: Break big tasks into checklists
5. **Keep branches**: Don't merge until you've reviewed
6. **Run tests**: Always verify behavior after Ralph's changes
7. **Iterate**: If the first attempt isn't right, rollback and refine your task description

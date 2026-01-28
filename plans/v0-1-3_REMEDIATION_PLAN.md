# Post-Test Run Improvements Plan

**Created**: 2026-01-28  
**Context**: Analysis of `ghcralph run --file ./PLAN.md --verbose` test run on ghc-ralph-cli-demo  
**Result**: All 11 tasks completed, but 6 issues identified requiring fixes

---

## Table of Contents

1. [Issue Summary](#issue-summary)
2. [Issue 1: Progress File Not Persisting Task History](#issue-1-progress-file-not-persisting-task-history)
3. [Issue 2: Git Push Never Executed](#issue-2-git-push-never-executed)
4. [Issue 3: Git Lock File Race Conditions](#issue-3-git-lock-file-race-conditions)
5. [Issue 4: Agent Claiming Success Despite Failures](#issue-4-agent-claiming-success-despite-failures)
6. [Issue 5: Iteration Log Format Insufficient Detail](#issue-5-iteration-log-format-insufficient-detail)
7. [Issue 6: Confusing Git Commit Message Format](#issue-6-confusing-git-commit-message-format)
8. [Implementation Priority](#implementation-priority)
9. [Success Criteria](#success-criteria)

---

## Issue Summary

| #   | Issue                                     | Severity | Category    | Effort |
| --- | ----------------------------------------- | -------- | ----------- | ------ |
| 1   | Progress file not persisting task history | 🔴 HIGH   | Data Loss   | 2h     |
| 2   | Git push never executed                   | 🟡 MEDIUM | Feature Gap | 1.5h   |
| 3   | Git lock file race conditions             | 🟡 MEDIUM | Stability   | 2h     |
| 4   | Agent claiming success despite failures   | 🟡 MEDIUM | Reliability | 3h     |
| 5   | Iteration log format insufficient detail  | 🟢 LOW    | UX          | 1.5h   |
| 6   | Confusing git commit message format       | 🟢 LOW    | UX          | 1h     |

**Total Estimated Effort**: ~11 hours

---

## Issue 1: Progress File Not Persisting Task History

### Problem Statement

The progress file (`progress.md`) only contains information about the **last task** processed. All previous tasks' iteration logs, actions, and results are lost when a new task begins.

### Evidence

After processing 11 tasks, the progress file was only 36 lines and contained:
- Current Session: Only "Return integer result (bash arithmetic)" (task-31)
- Task Results: Only task-31 listed

### Impact

- **Lost debugging context**: Cannot trace what happened in earlier tasks
- **Fresh agents can't learn**: New agent instances don't benefit from previous task learnings
- **No audit trail**: Unable to review what the CLI did across the full run

### Root Cause Analysis

The `ProgressTracker.save()` method appears to **overwrite** the entire file each time instead of preserving historical data.

### Options

#### Option A: Append-Only Progress File

Restructure progress.md to be append-only, with each task appending its section.

```markdown
# Ralph Progress Log

## Run: 2026-01-28T04:50:53Z
Branch: ghcralph/task-15-20260128

---

### Task 1: Create calculator.sh with basic structure
- **ID**: task-15
- **Status**: ✅ Completed
- **Iterations**: 2
- **Started**: 04:50:55
- **Completed**: 04:51:30

#### Iteration 1
- Tokens: 1,325
- Actions: [CREATE] calculator.sh, [EXECUTE] chmod +x...
- Summary: Created basic calculator structure

#### Iteration 2
- Tokens: 1,539
- Actions: [EXECUTE] ls -la, [COMPLETE]
- Summary: Verified and marked complete

---

### Task 2: Implement addition operation (+)
...
```

| Pros                   | Cons                                       |
| ---------------------- | ------------------------------------------ |
| Simple append logic    | File grows unbounded                       |
| Full history preserved | Harder to parse for "current" state        |
| Easy to implement      | May need truncation strategy for long runs |

#### Option B: Dual-File Strategy

Maintain two files:
- `progress.md` - Current task status (overwritten)
- `history.md` - Cumulative log of all tasks (appended)

| Pros                         | Cons                         |
| ---------------------------- | ---------------------------- |
| Clean separation of concerns | Two files to manage          |
| Current state easy to read   | More I/O operations          |
| History preserved separately | User might miss history file |

#### Option C: In-Memory Accumulation with Periodic Flush

Keep all task results in memory, write complete file at end of each task.

```typescript
class ProgressTracker {
  private allTaskResults: TaskResult[] = [];
  
  appendTaskResult(result: TaskResult) {
    this.allTaskResults.push(result);
    this.writeFullProgress(); // Overwrite with complete history
  }
}
```

| Pros                   | Cons                                   |
| ---------------------- | -------------------------------------- |
| Single source of truth | Memory grows with task count           |
| Atomic writes          | Loss on crash before write             |
| Clean file structure   | Slightly more complex state management |

### Recommendation: Option C (In-Memory Accumulation)

**Rationale**:
- Most reliable data integrity
- Single file is easier for users
- Memory usage is negligible (task count typically < 50)
- Already have task results in memory during execution

### Implementation Sketch

```typescript
// src/core/progress-tracker.ts

interface RunSession {
  startTime: Date;
  branch: string;
  tasks: TaskProgress[];
}

class ProgressTracker {
  private session: RunSession;
  
  startSession(branch: string) {
    this.session = {
      startTime: new Date(),
      branch,
      tasks: []
    };
  }
  
  recordTaskProgress(task: TaskProgress) {
    this.session.tasks.push(task);
    await this.save(); // Full history written each time
  }
  
  generateMarkdown(): string {
    let md = `# Ralph Progress Log\n\n`;
    md += `## Run: ${this.session.startTime.toISOString()}\n`;
    md += `**Branch**: ${this.session.branch}\n\n`;
    
    for (const task of this.session.tasks) {
      md += this.formatTaskSection(task);
    }
    return md;
  }
}
```

---

## Issue 2: Git Push Never Executed

### Problem Statement

After completing all 11 tasks with 13 commits, the `ghcralph/task-15-20260128` branch only exists locally. It was never pushed to the remote repository.

### Evidence

```bash
$ git ls-remote --heads origin
201e835...  refs/heads/main   # Only main exists on remote
```

Config shows `autoCommit: true` but no `autoPush` setting.

### Impact

- **No remote backup**: Work could be lost if local machine fails
- **No collaboration**: Others can't see or review the work
- **No PR creation**: Can't automatically open a PR for review

### Root Cause Analysis

The `autoPush` config option either:
1. Doesn't exist in the config schema
2. Exists but isn't implemented in CheckpointManager

### Options

#### Option A: Push After Each Task Completion

Add `autoPush` config option, push after each task checkpoint.

```typescript
if (config.autoPush) {
  await git.push('origin', currentBranch);
}
```

| Pros                          | Cons                                |
| ----------------------------- | ----------------------------------- |
| Immediate remote backup       | More network operations             |
| Progress visible in real-time | Could fail on network issues        |
| Simple to implement           | May hit rate limits with many tasks |

#### Option B: Push After All Tasks Complete

Single push at the end of the run.

| Pros                     | Cons                                  |
| ------------------------ | ------------------------------------- |
| Single network operation | All progress lost if crash before end |
| No rate limit concerns   | Delayed visibility                    |
| Simpler error handling   | Larger push could timeout             |

#### Option C: Configurable Push Strategy

Add config option for push frequency: `"pushStrategy": "per-task" | "per-run" | "manual"`

```json
{
  "autoCommit": true,
  "autoPush": true,
  "pushStrategy": "per-task"
}
```

| Pros                 | Cons                    |
| -------------------- | ----------------------- |
| User choice          | More complex config     |
| Covers all use cases | More code paths to test |
| Backward compatible  | Documentation overhead  |

### Recommendation: Option C (Configurable Push Strategy)

**Rationale**:
- Different workflows have different needs
- Per-task is best for long runs (crash safety)
- Per-run is better for fast runs (less overhead)
- Manual for offline work or specific CI environments

### Implementation Sketch

```typescript
// src/core/config-schema.ts
export const configSchema = z.object({
  // ... existing fields
  autoPush: z.boolean().default(false),
  pushStrategy: z.enum(['per-task', 'per-run', 'manual']).default('per-task'),
});

// src/core/checkpoint-manager.ts
async createTaskCheckpoint(taskId: string, summary: string): Promise<string> {
  const sha = await this.commit(message);
  
  if (this.config.autoPush && this.config.pushStrategy === 'per-task') {
    await this.push();
  }
  
  return sha;
}

async finalizeRun(): Promise<void> {
  if (this.config.autoPush && this.config.pushStrategy === 'per-run') {
    await this.push();
  }
}

private async push(): Promise<void> {
  const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
  await this.git.push('origin', branch, ['--set-upstream']);
}
```

---

## Issue 3: Git Lock File Race Conditions

### Problem Statement

Multiple git operations failed due to concurrent access conflicts:

```
fatal: Unable to create '.git/index.lock': File exists.
fatal: cannot lock ref 'HEAD': is at X but expected Y
```

### Evidence

Observed 4+ times during the test run:
- Task 3: Failed to stage changes
- Task 4: Failed to create checkpoint commit
- Task 5: Failed to create task checkpoint
- Task 7: Failed to stage changes

### Impact

- **Missing commits**: Some checkpoints not created
- **Inconsistent state**: Git history may not reflect actual work
- **Potential data loss**: Changes might not be committed

### Root Cause Analysis

The loop engine continues to the next iteration/task while checkpoint creation runs asynchronously. This causes:
1. Two `git add` operations running simultaneously
2. Commit attempting while staging is in progress
3. New iteration modifying files while commit is pending

### Options

#### Option A: Serialize All Git Operations

Use a mutex/lock to ensure only one git operation runs at a time.

```typescript
class CheckpointManager {
  private gitMutex = new Mutex();
  
  async createCheckpoint(message: string): Promise<string> {
    return this.gitMutex.runExclusive(async () => {
      await this.git.add('-A');
      return this.git.commit(message);
    });
  }
}
```

| Pros                       | Cons                          |
| -------------------------- | ----------------------------- |
| Guarantees no conflicts    | Adds dependency (async-mutex) |
| Simple mental model        | Slightly slower (serialized)  |
| Industry standard approach | Need to wrap all git calls    |

#### Option B: Await Checkpoint Before Continuing

Make the main loop `await` checkpoint completion before proceeding.

```typescript
// In loop-engine.ts
for (const iteration of iterations) {
  await executeIteration(iteration);
  await checkpointManager.createCheckpoint(...); // Blocking
  // Only continue after checkpoint complete
}
```

| Pros                     | Cons                     |
| ------------------------ | ------------------------ |
| No external dependencies | Slower overall execution |
| Simpler code             | Lost parallelism         |
| Guaranteed ordering      | May feel sluggish        |

#### Option C: Retry with Backoff

When git operation fails due to lock, retry with exponential backoff.

```typescript
async function gitWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (isLockError(error) && attempt < 3) {
        await sleep(100 * Math.pow(2, attempt));
        continue;
      }
      throw error;
    }
  }
}
```

| Pros                     | Cons                         |
| ------------------------ | ---------------------------- |
| Handles transient issues | Doesn't fix root cause       |
| No structural changes    | May still fail after retries |
| Preserves parallelism    | Harder to debug              |

#### Option D: Queue-Based Checkpoint System

Queue checkpoint requests and process them sequentially in a background worker.

| Pros                   | Cons                          |
| ---------------------- | ----------------------------- |
| Non-blocking main loop | Complex implementation        |
| Ordered execution      | Harder to test                |
| Decoupled concerns     | Crash could lose queued items |

### Recommendation: Option A (Mutex) + Option B (Await Critical Points)

**Rationale**:
- Mutex prevents all race conditions systematically
- Awaiting task checkpoints ensures clean state between tasks
- Per-iteration checkpoints can be fire-and-forget with mutex protection
- Small performance impact is acceptable for reliability

### Implementation Sketch

```typescript
// src/core/checkpoint-manager.ts
import { Mutex } from 'async-mutex';

export class CheckpointManager {
  private gitMutex = new Mutex();

  async stageAndCommit(message: string): Promise<string | null> {
    return this.gitMutex.runExclusive(async () => {
      const status = await this.git.status();
      if (!status.modified.length && !status.created.length) {
        return null; // Nothing to commit
      }
      await this.git.add('-A');
      const result = await this.git.commit(message);
      return result.commit;
    });
  }
}

// src/commands/run.ts - Task completion point
const checkpoint = await checkpointManager.createTaskCheckpoint(...);
// Await ensures clean state before next task
```

---

## Issue 4: Agent Claiming Success Despite Failures

### Problem Statement

The AI agent marks tasks as complete even when test commands fail:

```
⬤   ✗ Command failed: ./calculator.sh 6 x 7
⬤   ✗ Command failed: ./calculator.sh 6 '*' 7
⬤   ✗ Command failed: ./calculator.sh 3 x 4
⬤   ✓ Task marked complete: Multiplication operation implemented...
```

### Impact

- **False positives**: Tasks marked done with broken code
- **Technical debt**: Later tasks must fix previous work
- **Unreliable automation**: Can't trust completion status

### Root Cause Analysis

1. Agent receives failed command output but interprets it differently
2. No prompt guidance encouraging honest failure reporting
3. No verification hooks configured to catch failures
4. COMPLETE action is accepted regardless of previous failures

### Options

#### Option A: Prompt Engineering for Honesty

Add explicit guidance in the system prompt encouraging accurate reporting.

```typescript
const HONESTY_GUIDANCE = `
## Completion Integrity

CRITICAL: Only use [ACTION:COMPLETE] when ALL of the following are true:
1. The task objective has been fully achieved
2. All test commands executed successfully (exit code 0)
3. No syntax errors or runtime errors remain

If you cannot complete the task:
- Use [ACTION:STUCK] to signal you need help
- Be honest about what failed and why

NEVER claim completion if:
- Commands returned non-zero exit codes
- Tests produced error output
- You're uncertain if the task is truly done
`;
```

| Pros                | Cons                                   |
| ------------------- | -------------------------------------- |
| Non-breaking change | Relies on model following instructions |
| Easy to implement   | May vary by model                      |
| Improves all tasks  | Not enforceable                        |

#### Option B: Failure-Aware COMPLETE Validation

Track command failures and reject COMPLETE if recent failures exist.

```typescript
class IterationState {
  failedCommands: string[] = [];
  
  recordCommandResult(cmd: string, success: boolean) {
    if (!success) this.failedCommands.push(cmd);
  }
  
  canComplete(): boolean {
    return this.failedCommands.length === 0;
  }
}

// In action executor
if (action.type === 'COMPLETE' && !state.canComplete()) {
  return {
    success: false,
    error: `Cannot complete: ${state.failedCommands.length} commands failed`
  };
}
```

| Pros                | Cons                                          |
| ------------------- | --------------------------------------------- |
| Enforced at runtime | May block valid completions                   |
| Deterministic       | Some failures are expected (validation tests) |
| Clear feedback      | Needs nuance for test scenarios               |

#### Option C: Verification Hooks Enforcement

Require at least one verification hook to pass before accepting COMPLETE.

| Pros                   | Cons                        |
| ---------------------- | --------------------------- |
| Objective validation   | Requires hook configuration |
| Catches real issues    | Not all projects have tests |
| Industry best practice | Extra setup burden          |

#### Option D: Hybrid - Prompt + Soft Validation + Warning

Combine prompt guidance with soft validation that warns but doesn't block.

```typescript
if (action.type === 'COMPLETE') {
  if (state.hasRecentFailures()) {
    logger.warn(`⚠️ Completing task despite ${state.failureCount} failed commands`);
    logger.warn(`Failed: ${state.failedCommands.join(', ')}`);
  }
}
```

| Pros              | Cons                            |
| ----------------- | ------------------------------- |
| Balanced approach | Doesn't prevent false positives |
| Visible warnings  | Requires human attention        |
| Non-blocking      | May be ignored                  |

### Recommendation: Option A (Prompt) + Option D (Warning) + Future Option B

**Rationale**:
- Prompt engineering is low-risk, high-value
- Warnings provide visibility without blocking
- Strict validation (Option B) should be opt-in via config flag
- Add `strictCompletion: boolean` config for users who want enforcement

### Implementation Sketch

```typescript
// src/core/prompt-examples.ts
export const HONESTY_GUIDANCE = `
## Completion Integrity Guidelines

### When to use [ACTION:COMPLETE]
✅ All acceptance criteria from the task are met
✅ All test commands returned exit code 0
✅ No unresolved errors in modified files
✅ You have verified the implementation works

### When NOT to use [ACTION:COMPLETE]
❌ Commands failed with non-zero exit codes
❌ Syntax errors or runtime errors exist
❌ You're unsure if the task is fully done
❌ There are TODO items remaining

### If You Cannot Complete
Use [ACTION:STUCK] with a clear explanation:
\`\`\`
[ACTION:STUCK]
Reason: Cannot resolve syntax error in line 47
Attempted: Tried 3 different approaches to fix the case statement
Suggestion: The bash case syntax may need manual review
\`\`\`

IMPORTANT: Honest reporting enables retry with fresh context.
False completion claims waste iterations and hide problems.
`;

// src/core/action-executor.ts
if (action.type === 'COMPLETE' && iterationState.hasFailures()) {
  output.warn(
    `⚠️ Task marked complete despite ${iterationState.failureCount} command failures:`
  );
  for (const failure of iterationState.failedCommands) {
    output.warn(`   • ${failure}`);
  }
}
```

---

## Issue 5: Iteration Log Format Insufficient Detail

### Problem Statement

The progress file iteration log only contains minimal summary information, not the detailed agent actions and responses needed for debugging or learning.

### Current Format

```markdown
#### Iteration 1 (4:53:32 AM) ✓
- **Tokens**: 1,252
- **Summary**: Task complete: Division already uses bash arithmetic...
- **Duration**: 16s
```

### Expected Format

```markdown
#### Iteration 1 (4:53:32 AM) ✓
- **Tokens**: 1,252
- **Duration**: 16s

**Actions Executed**:
1. ✓ [EXECUTE] `./calculator.sh 7 / 3` → Exit 0
   ```
   2
   ```
2. ✓ [COMPLETE] Division already uses bash arithmetic...

**Agent Reasoning**:
> I verified the division operation is working correctly. The script uses 
> bash arithmetic $((num1 / num2)) which returns integer results by default.
> Test case 7 / 3 = 2 confirms truncation behavior.
```

### Options

#### Option A: Capture Full Agent Response

Store the complete agent response text in iteration log.

| Pros               | Cons              |
| ------------------ | ----------------- |
| Maximum context    | Large file size   |
| Debugging-friendly | May contain noise |
| Learning-ready     | Storage overhead  |

#### Option B: Capture Actions + Summary Only

Store executed actions with results, plus agent's summary statement.

| Pros            | Cons                |
| --------------- | ------------------- |
| Balanced detail | Missing reasoning   |
| Reasonable size | May lose context    |
| Structured data | Less human-readable |

#### Option C: Configurable Verbosity

Add config option: `progressVerbosity: "minimal" | "standard" | "full"`

| Pros                | Cons                 |
| ------------------- | -------------------- |
| User choice         | More code paths      |
| Covers all needs    | Documentation needed |
| Backward compatible | Testing overhead     |

### Recommendation: Option C (Configurable) with "standard" default

**Rationale**:
- Different use cases need different detail levels
- Standard should include actions + key reasoning
- Full for debugging, minimal for CI environments

### Implementation Sketch

```typescript
// src/core/config-schema.ts
progressVerbosity: z.enum(['minimal', 'standard', 'full']).default('standard'),

// src/core/progress-tracker.ts
formatIteration(iteration: IterationResult, verbosity: Verbosity): string {
  let md = `#### Iteration ${iteration.number} (${formatTime(iteration.startTime)})`;
  md += iteration.success ? ' ✓' : ' ✗';
  md += '\n\n';
  
  md += `- **Tokens**: ${iteration.tokensUsed}\n`;
  md += `- **Duration**: ${iteration.duration}s\n\n`;
  
  if (verbosity !== 'minimal') {
    md += `**Actions Executed**:\n`;
    for (const action of iteration.actions) {
      md += this.formatAction(action);
    }
    md += '\n';
  }
  
  if (verbosity === 'full') {
    md += `**Agent Response**:\n`;
    md += `> ${iteration.rawResponse.replace(/\n/g, '\n> ')}\n\n`;
  }
  
  return md;
}
```

---

## Issue 6: Confusing Git Commit Message Format

### Problem Statement

Git commit messages show "iteration 1" for every task, making the history confusing:

```
1f3b04b ghcralph: task complete - Return integer result (bash arithmetic)
ccbdd2e ghcralph: iteration 1 - Task complete: Division by zero error...
bc858c1 ghcralph: iteration 1 - Task complete: Division operation...
1c7c94a ghcralph: iteration 1 - Task complete: The script already handles...
3a138dc ghcralph: iteration 1 - Task complete: Multiplication operation...
```

**Problem**: Every task starts at iteration 1, so "iteration 1" appears 10+ times with no global context.

### Impact

- **Hard to navigate**: Can't tell which task a commit belongs to
- **No global ordering**: Missing "task X of Y" context
- **Git history unclear**: `git log` doesn't show workflow progression

### Options

#### Option A: Add Task Number to Commit Message

Format: `ghcralph: task 7/11 iteration 1 - [summary]`

```
ghcralph: task 11/11 complete - Return integer result (bash arithmetic)
ghcralph: task 10/11 iter 1 - Division by zero error handling
ghcralph: task 9/11 iter 1 - Division operation implemented
ghcralph: task 8/11 iter 1 - Shell escaping for * character
ghcralph: task 7/11 iter 1 - Multiplication operation
```

| Pros                  | Cons                                   |
| --------------------- | -------------------------------------- |
| Clear global position | Longer messages                        |
| Easy to navigate      | Task numbers may change if plan edited |
| Shows progress        | Slightly verbose                       |

#### Option B: Use Task ID Instead of Number

Format: `ghcralph: [task-25] iteration 1 - [summary]`

```
ghcralph: [task-31] complete - Return integer result (bash arithmetic)
ghcralph: [task-30] iter 1 - Division by zero error handling
ghcralph: [task-29] iter 1 - Division operation implemented
ghcralph: [task-26] iter 1 - Shell escaping for * character
ghcralph: [task-25] iter 1 - Multiplication operation
```

| Pros             | Cons                  |
| ---------------- | --------------------- |
| Stable reference | IDs not sequential    |
| Links to plan    | Doesn't show position |
| Unique per task  | Less intuitive        |

#### Option C: Global Iteration Counter

Track iterations globally across the entire run, not per-task.

```
ghcralph: iter 15 (task 11/11) complete - Return integer result
ghcralph: iter 14 (task 10/11) - Division by zero error handling
ghcralph: iter 13 (task 9/11) - Division operation implemented
ghcralph: iter 11 (task 8/11) - Shell escaping for * character
ghcralph: iter 10 (task 7/11) - Multiplication operation
```

| Pros              | Cons                                     |
| ----------------- | ---------------------------------------- |
| Unique across run | Gaps in sequence (multi-iteration tasks) |
| Shows true order  | Harder to correlate with progress file   |
| Clear progression | More complex tracking                    |

#### Option D: Hybrid - Task Position + Task-Local Iteration

Format: `ghcralph: [T7/11 I1] - [summary]`

```
ghcralph: [T11/11 ✓] Return integer result (bash arithmetic)
ghcralph: [T10/11 I1] Division by zero error handling verified
ghcralph: [T9/11 I1] Division operation implemented
ghcralph: [T8/11 I1] Shell escaping for * character handled
ghcralph: [T7/11 I1] Multiplication operation implemented
```

| Pros                    | Cons                      |
| ----------------------- | ------------------------- |
| Compact format          | Learning curve            |
| Both contexts           | Non-standard              |
| Clear completion marker | Abbreviations may confuse |

### Recommendation: Option A (Task Number Format)

**Rationale**:
- Most intuitive for humans reading `git log`
- Shows progress at a glance ("task 7/11" = 64% done)
- Clear distinction between iteration commits and task-complete commits
- Easy to implement with existing task index

### Implementation Sketch

```typescript
// src/core/checkpoint-manager.ts

interface CommitContext {
  taskNumber: number;      // 1-indexed position
  totalTasks: number;      // Total in plan
  iterationNumber: number; // Within this task
  isTaskComplete: boolean;
}

formatCommitMessage(ctx: CommitContext, summary: string): string {
  const taskProgress = `task ${ctx.taskNumber}/${ctx.totalTasks}`;
  
  if (ctx.isTaskComplete) {
    return `ghcralph: ${taskProgress} complete - ${this.truncate(summary, 50)}`;
  }
  
  return `ghcralph: ${taskProgress} iter ${ctx.iterationNumber} - ${this.truncate(summary, 40)}`;
}

// Example outputs:
// ghcralph: task 1/11 iter 1 - Created calculator.sh with basic structure
// ghcralph: task 1/11 iter 2 - Verified and tested addition
// ghcralph: task 1/11 complete - Calculator basic structure ready
// ghcralph: task 2/11 iter 1 - Addition operation already works
// ghcralph: task 2/11 complete - Addition verified
```

---

## Implementation Priority

### Phase 1: Critical Fixes (4 hours)

| Task | Issue                          | Effort | Rationale                 |
| ---- | ------------------------------ | ------ | ------------------------- |
| 1.1  | Progress file persistence (#1) | 2h     | Data loss is unacceptable |
| 1.2  | Git lock race conditions (#3)  | 2h     | Causes cascading failures |

### Phase 2: Reliability Improvements (4 hours)

| Task | Issue                                   | Effort | Rationale              |
| ---- | --------------------------------------- | ------ | ---------------------- |
| 2.1  | Prompt engineering for honesty (#4)     | 1.5h   | Low-risk, high-value   |
| 2.2  | Git push implementation (#2)            | 1.5h   | Expected feature       |
| 2.3  | Failure warning in action executor (#4) | 1h     | Visibility improvement |

### Phase 3: UX Polish (3 hours)

| Task | Issue                               | Effort | Rationale                  |
| ---- | ----------------------------------- | ------ | -------------------------- |
| 3.1  | Git commit message format (#6)      | 1h     | Clarity improvement        |
| 3.2  | Progress file verbosity config (#5) | 1.5h   | User flexibility           |
| 3.3  | Documentation updates               | 0.5h   | Explain new config options |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Running 11-task plan produces progress.md with all 11 tasks documented
- [ ] No `git index.lock` errors during run
- [ ] All checkpoint commits created successfully

### Phase 2 Complete When:
- [ ] Agent prompt includes HONESTY_GUIDANCE section
- [ ] Warning displayed when COMPLETE used after failures
- [ ] `autoPush: true` pushes branch to remote after task completion
- [ ] `pushStrategy` config option works for per-task/per-run modes

### Phase 3 Complete When:
- [ ] Git log shows `task X/Y` format for all commits
- [ ] `progressVerbosity: "full"` includes agent response text
- [ ] README documents new config options

---

## Appendix: Test Commands

```bash
# Clean test setup
cd /workspaces/ghc-ralph-cli-demo
git checkout main
git branch -D ghcralph/task-15-20260128  # Delete old test branch
rm -rf .ghcralph/progress.md

# Run test
ghcralph run --file ./PLAN.md --verbose

# Verify fixes
wc -l .ghcralph/progress.md            # Should be > 200 lines
git log --oneline | head -20           # Check commit format
git branch -r | grep ghcralph          # Check push worked
```

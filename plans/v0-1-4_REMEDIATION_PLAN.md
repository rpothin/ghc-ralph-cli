# v0.1.4 Remediation Plan: Progress & Commit Issues

**Created**: 2026-01-28  
**Version Target**: v0.1.4  
**Context**: Deep source code analysis of "ugly" and "bad" issues from v0.1.3 test run

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Issue 1: Commit Message Quality (Preamble Leak + Truncation)](#issue-1-commit-message-quality-preamble-leak--truncation) 🔴 UGLY
3. [Issue 2: Progress Verbosity Config Not Applied](#issue-2-progress-verbosity-config-not-applied) 🔴 UGLY
4. [Issue 3: Progress File Not Persisting Task History](#issue-3-progress-file-not-persisting-task-history) 🟡 BAD
5. [Issue 4: Auto-Push Not Executed Despite Config](#issue-4-auto-push-not-executed-despite-config) 🟡 BAD
6. [Implementation Priority](#implementation-priority)
7. [Success Criteria](#success-criteria)

---

## Executive Summary

Analysis of the v0.1.3 test run identified **4 issues** requiring source code remediation:

### The Ugly (Critical - Visible Quality Issues)

| #   | Issue                                           | Severity | Root Cause Location                    | Effort |
| --- | ----------------------------------------------- | -------- | -------------------------------------- | ------ |
| 1   | Commit messages: preamble leak + mid-word cuts  | 🔴 UGLY   | Heuristic extraction + char truncation | 1.5h   |
| 2   | progressVerbosity config ignored                | 🔴 UGLY   | `rawResponse` never populated          | 1.5h   |

### The Bad (Important - Functional Issues)

| #   | Issue                              | Severity | Root Cause Location               | Effort |
| --- | ---------------------------------- | -------- | --------------------------------- | ------ |
| 3   | Progress file only shows last task | 🟡 BAD    | `run.ts` uses wrong methods       | 2h     |
| 4   | Auto-push not executed             | 🟡 BAD    | Config default + missing CLI flag | 1h     |

**Total Estimated Effort**: ~6 hours

### Key Design Decision: `[COMMIT_MESSAGE]` Block

Issues 1 (preamble leak) and the former Issue 5 (truncation) are **consolidated** into a single solution using an explicit `[COMMIT_MESSAGE]` block in the agent prompt. This follows the existing `[ACTION:*]` pattern and provides:

- **100% reliable extraction** - No heuristic pattern matching
- **Agent-crafted quality** - Agent knows commit message guidelines upfront
- **No truncation issues** - Agent respects 50-char limit from the start
- **Consistent architecture** - Same pattern as other ACTION blocks

---

## Issue 1: Commit Message Quality (Preamble Leak + Truncation)

### Problem Statement

Two related commit message quality issues were observed:

**Problem A - Agent Preamble Leak:**
```
ghcralph: task 10/11 iter 1 - I'll check the current state of the c...
```

**Problem B - Mid-Word Truncation:**
```
ghcralph: task 11/11 iter 1 - Task complete: Division already retur...
```

**Expected:**
```
ghcralph: task 10/11 iter 1 - Verify division by zero handling
```

### Root Cause Analysis

**Current Approach** (Heuristic-based):

1. `extractSummary()` in `loop-engine.ts` takes the first line of AI response
2. AI often starts with conversational text ("I'll check...", "Let me...")
3. `checkpoint-manager.ts` truncates at 40 chars with `substring(0, 37) + '...'`
4. Truncation cuts mid-word without word-boundary awareness

**Why Heuristics Fail**:
- Impossible to reliably filter all conversational patterns
- Must maintain regex patterns for each new preamble style
- Truncation happens after extraction, agent unaware of limits
- No feedback loop for agent to craft quality messages

### Solution: Explicit `[COMMIT_MESSAGE]` Block

Instead of heuristically extracting commit messages from agent responses, we introduce an explicit `[COMMIT_MESSAGE]` block that the agent must provide.

**Comparison**:

| Aspect                | Heuristic Extraction           | `[COMMIT_MESSAGE]` Block      |
| --------------------- | ------------------------------ | ----------------------------- |
| **Reliability**       | Regex patterns may miss cases  | 100% deterministic extraction |
| **Quality**           | Extracts whatever agent said   | Agent crafts intentional msg  |
| **Truncation**        | We truncate after extraction   | Agent respects limits upfront |
| **Consistency**       | Varies by response format      | Same pattern as `[ACTION:*]`  |
| **Maintenance**       | Must tune preamble patterns    | Single regex, no tuning       |
| **Solves Both Issues**| Needs separate truncation fix  | ✅ One solution for both      |

### Implementation Details

#### Step 1: Add `[COMMIT_MESSAGE]` to Prompt Examples

**File**: [src/core/prompt-examples.ts](src/core/prompt-examples.ts)

Add new example constant:

```typescript
/**
 * Example of COMMIT_MESSAGE block for git commit summaries
 */
export const COMMIT_MESSAGE_EXAMPLE = `[COMMIT_MESSAGE]
Add division operation with error handling
[/COMMIT_MESSAGE]`;
```

Update `FORMAT_INSTRUCTIONS`:

```typescript
**[COMMIT_MESSAGE]** - Provide commit message for this iteration
\`\`\`
[COMMIT_MESSAGE]
<max 50 chars, imperative mood, specific>
[/COMMIT_MESSAGE]
\`\`\`
```

Add to `ALL_EXAMPLES`:

```typescript
### Example: Commit message for the iteration
${COMMIT_MESSAGE_EXAMPLE}
```

#### Step 2: Add Commit Message Guidelines to Context

**File**: [src/core/context-builder.ts](src/core/context-builder.ts)

Add guidelines section:

```typescript
const COMMIT_MESSAGE_GUIDELINES = `
## Commit Message Guidelines

Each response SHOULD include a commit message block:

[COMMIT_MESSAGE]
<your commit message here>
[/COMMIT_MESSAGE]

**Rules:**
- Maximum 50 characters
- Use imperative mood ("Add", "Fix", "Update" not "Added", "Fixed")
- Be specific about what changed
- No periods at the end
- If task is complete, describe the accomplishment
- If in progress, describe the action taken

**Good examples:**
- "Add division operation with zero check"
- "Fix off-by-one error in loop counter"
- "Update calculator to handle decimals"

**Bad examples:**
- "I'll check the calculator" (conversational)
- "Made some changes" (vague)
- "Fixed the thing that was broken." (period, vague)
`;
```

#### Step 3: Update extractSummary() with Block Extraction

**File**: [src/core/loop-engine.ts](src/core/loop-engine.ts)  
**Location**: Replace `extractSummary` method (lines 554-558)

```typescript
/**
 * Extract commit message summary from the response content.
 * Priority: [COMMIT_MESSAGE] block > [ACTION:COMPLETE] reason > First action type > Fallback
 */
private extractSummary(content: string): string {
  // Priority 1: Explicit [COMMIT_MESSAGE] block (preferred)
  const commitMatch = content.match(
    /\[COMMIT_MESSAGE\]\s*([\s\S]*?)\[\/COMMIT_MESSAGE\]/i
  );
  if (commitMatch?.[1]) {
    const message = commitMatch[1].trim().split('\n')[0]?.trim();
    if (message && message.length > 0) {
      // Already within limits, agent followed guidelines
      return message.length > 50 ? message.substring(0, 47) + '...' : message;
    }
  }

  // Priority 2: Extract from COMPLETE action reason (fallback for completion iterations)
  const completeMatch = content.match(
    /\[ACTION:COMPLETE\]\s*(?:reason:\s*)?([\s\S]*?)(?:\[\/ACTION|\[ACTION:|$)/i
  );
  if (completeMatch?.[1]) {
    const reason = completeMatch[1].trim().split('\n')[0]?.trim();
    if (reason && reason.length > 0) {
      return this.truncateAtWord(`Complete: ${reason}`, 50);
    }
  }

  // Priority 3: Use first action type as summary
  const actionMatch = content.match(/\[ACTION:(\w+)\]/i);
  if (actionMatch?.[1]) {
    const actionType = actionMatch[1].toUpperCase();
    // Try to get more context from the action
    if (actionType === 'CREATE') {
      const pathMatch = content.match(/\[ACTION:CREATE\]\s*(?:path:\s*)?([^\n]+)/i);
      if (pathMatch?.[1]) {
        return this.truncateAtWord(`Create ${pathMatch[1].trim()}`, 50);
      }
    } else if (actionType === 'EXECUTE') {
      const cmdMatch = content.match(/\[ACTION:EXECUTE\]\s*(?:command:\s*)?([^\n]+)/i);
      if (cmdMatch?.[1]) {
        return this.truncateAtWord(`Run: ${cmdMatch[1].trim()}`, 50);
      }
    }
    return `[${actionType}]`;
  }

  // Priority 4: Fallback - truncate first non-preamble line
  const preamblePatterns = /^(I'll|I will|Let me|I need to|I'm going|First,?|Now,?|OK|Okay|Sure|Here)/i;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !preamblePatterns.test(trimmed)) {
      return this.truncateAtWord(trimmed, 50);
    }
  }

  return 'Iteration update';
}

/**
 * Truncate at word boundary to avoid mid-word cuts
 */
private truncateAtWord(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  
  const ellipsis = '...';
  const targetLen = maxLen - ellipsis.length;
  const truncated = str.substring(0, targetLen);
  const lastSpace = truncated.lastIndexOf(' ');
  
  // Use word boundary if in the latter half
  if (lastSpace > targetLen * 0.5) {
    return truncated.substring(0, lastSpace) + ellipsis;
  }
  return truncated + ellipsis;
}
```

#### Step 4: Remove Truncation in Checkpoint Manager

**File**: [src/core/checkpoint-manager.ts](src/core/checkpoint-manager.ts)

Since `extractSummary()` now returns properly-sized messages, we can simplify:

```typescript
// Line 205-208: Before
const truncatedSummary = summary.length > 40 
  ? summary.substring(0, 37) + '...'
  : summary;

// Line 205-208: After
// Summary already truncated by extractSummary(), just use directly
const commitSummary = summary;
```

Or keep a safety limit but use word-boundary truncation:

```typescript
const commitSummary = summary.length > 50 
  ? this.truncateAtWord(summary, 50) 
  : summary;
```

### Fallback Behavior

The solution maintains **backwards compatibility** with a graceful fallback chain:

1. ✅ `[COMMIT_MESSAGE]` block present → use it (best)
2. ⚠️ No block, but `[ACTION:COMPLETE]` → extract reason
3. ⚠️ No COMPLETE, but other actions → use action type + context
4. ❌ No actions found → filter preamble + truncate at word

### Testing Strategy

```bash
# Test 1: Agent includes [COMMIT_MESSAGE]
# Expected: Exact message extracted, no truncation needed

# Test 2: Agent omits block but has [ACTION:COMPLETE]
# Expected: "Complete: <reason>" with word-boundary truncation

# Test 3: Agent omits block, has [ACTION:EXECUTE] only
# Expected: "Run: <command>" summary

# Test 4: Agent has no blocks (legacy response)
# Expected: Fallback to filtered first line, word-boundary truncated
```

### Migration Notes

- **No breaking changes** - fallback chain ensures old responses still work
- **System prompt update needed** - add `[COMMIT_MESSAGE]` to prompt templates
- **Model compatibility** - `prompt-examples.ts` already supports model strength tiers

---

## Issue 2: Progress Verbosity Config Not Applied

### Problem Statement

Config has `"progressVerbosity": "standard"` but the progress file only shows minimal info:

```markdown
#### Iteration 1 (4:43:24 PM) ✓
- **Tokens**: 1,534
- **Summary**: Task complete: Division already returns integer results...
- **Duration**: 23s
```

Missing for "standard" verbosity:
- Actions executed list
- Command outputs

Missing for "full" verbosity:
- Agent reasoning/response

### Source Code Analysis

**File**: [src/core/progress-tracker.ts](src/core/progress-tracker.ts)

The `formatIteration` method checks for `rawResponse` and `actions`:

```typescript
// Full verbosity: include raw response if available
if (this.verbosity === 'full' && iter.rawResponse) {      // Line 398
  md += `\n**Agent Response**:\n`;
  // ...
}

// Full verbosity: include actions executed if available
if (this.verbosity === 'full' && iter.actions && iter.actions.length > 0) {  // Line 404
  md += `\n**Actions Executed**:\n`;
  // ...
}
```

**File**: [src/core/loop-engine.ts](src/core/loop-engine.ts)

The problem: `completeIteration()` is called but **never populates** `rawResponse` or `actions`:

```typescript
// Line 518
const completedRecord = completeIteration(
  record,
  true,
  result.tokenUsage.totalTokens,
  summary          // Only summary is passed
);
```

**Root Cause**: The `rawResponse` and `actions` fields are defined in the `IterationRecord` interface but never populated anywhere in the codebase.

### Options

#### Option A: Populate Fields in Loop Engine (Recommended)

Modify `LoopEngine.runIteration()` to capture and store the response and actions.

| Pros                         | Cons                          |
| ---------------------------- | ----------------------------- |
| Enables full verbosity       | Stores more data in memory    |
| Clean implementation         | May be verbose for some users |
| Uses existing infrastructure | -                             |

#### Option B: Add Verbosity Awareness to Loop Engine

Pass verbosity config to loop engine, only capture when needed.

| Pros                    | Cons                                  |
| ----------------------- | ------------------------------------- |
| Only stores when needed | Adds config dependency                |
| Memory efficient        | More complex wiring                   |
| -                       | Verbosity becomes loop-engine concern |

#### Option C: Fix "Standard" Verbosity Definition

Currently both "minimal" and "standard" show the same output. Define "standard" to include actions.

| Pros                      | Cons                          |
| ------------------------- | ----------------------------- |
| Clearer verbosity levels  | Still needs data population   |
| Matches user expectations | Must implement Option A first |

### Recommendation: Option A + Option C Combined

1. **Populate the data** in loop engine (Option A)
2. **Differentiate verbosity levels** in formatter (Option C)

### Implementation Details

#### Step 1: Capture Raw Response and Actions in Loop Engine

**File**: [src/core/loop-engine.ts](src/core/loop-engine.ts)  
**Location**: After action execution in `runIteration()` (around line 520)

```typescript
// In runIteration(), after executing actions
// Capture action results for verbosity logging
const actionSummaries: Array<{type: string; success: boolean; summary?: string}> = [];

for (const execResult of executionResults) {
  actionSummaries.push({
    type: execResult.action.type,
    success: execResult.success,
    summary: execResult.message,
  });
}

// Complete the iteration record
const completedRecord = completeIteration(
  record,
  true,
  result.tokenUsage.totalTokens,
  summary
);

// Attach verbosity data
completedRecord.rawResponse = responseContent;
completedRecord.actions = actionSummaries;
```

#### Step 2: Update formatIteration for Standard Verbosity

**File**: [src/core/progress-tracker.ts](src/core/progress-tracker.ts)  
**Location**: `formatIteration` method (lines 371-414)

```typescript
private formatIteration(iter: IterationRecord): string {
  const time = iter.startedAt.toLocaleTimeString();
  const status = iter.success ? '✓' : '✗';

  // Minimal verbosity: just iteration header
  if (this.verbosity === 'minimal') {
    return `#### Iteration ${iter.iteration} (${time}) ${status}\n\n`;
  }

  let md = `#### Iteration ${iter.iteration} (${time}) ${status}\n\n`;
  md += `- **Tokens**: ${iter.tokensUsed.toLocaleString()}\n`;

  if (iter.summary) {
    md += `- **Summary**: ${iter.summary}\n`;
  }

  if (iter.error) {
    md += `- **Error**: ${iter.error}\n`;
  }

  if (iter.endedAt) {
    const duration = iter.endedAt.getTime() - iter.startedAt.getTime();
    md += `- **Duration**: ${Math.floor(duration / 1000)}s\n`;
  }

  // NEW: Standard+ verbosity: include actions executed
  if ((this.verbosity === 'standard' || this.verbosity === 'full') 
      && iter.actions && iter.actions.length > 0) {
    md += `\n**Actions**:\n`;
    for (const action of iter.actions) {
      const actionStatus = action.success ? '✓' : '✗';
      md += `- ${actionStatus} \`[${action.type}]\``;
      if (action.summary) {
        // Truncate long summaries
        const truncated = action.summary.length > 60 
          ? action.summary.substring(0, 57) + '...' 
          : action.summary;
        md += ` ${truncated}`;
      }
      md += '\n';
    }
  }

  // Full verbosity only: include raw response
  if (this.verbosity === 'full' && iter.rawResponse) {
    md += `\n**Agent Response**:\n`;
    md += `\`\`\`\n${iter.rawResponse}\n\`\`\`\n`;
  }

  md += `\n`;
  return md;
}
```

---

## Issue 3: Progress File Not Persisting Task History

### Problem Statement

After completing 11 tasks, the progress file only contains 36 lines showing the **last task only**. All previous 10 tasks' iteration logs are lost.

### Source Code Analysis

#### Current Architecture

The `ProgressTracker` class has **two separate mechanisms** for progress:

**Mechanism A: Session-Based (Full History)** - NOT USED
```
src/core/progress-tracker.ts
├── startSession(branch, totalTasks)          # Lines 123-131
├── setCurrentTask(taskNumber, state)         # Lines 152-166
├── recordTaskCompletion(state, status, ...)  # Lines 171-205
├── saveFullSession()                         # Lines 210-218
└── generateFullSessionMarkdown()             # Lines 223-304
```

**Mechanism B: Single-Task (Overwrites)** - USED BY RUN.TS
```
src/core/progress-tracker.ts
├── save(state)                               # Lines 418-428
├── generateMarkdown(state)                   # Lines 316-347
└── appendTaskResult(task, status, ...)       # Lines 552-602
```

#### The Problem

In [run.ts](src/commands/run.ts):

```typescript
// Line 521: Called after each iteration - OVERWRITES the file each time
progressTracker.save(state).catch(() => {});

// Lines 563, 602, 617, 638: Called after each task - APPENDS to file
await progressTracker.appendTaskResult(activeTask, 'completed', taskAttempt, ...);
```

**What happens**:
1. Task 1, Iteration 1: `save()` → writes "Task 1, iter 1" to file ✓
2. Task 1, Iteration 2: `save()` → **overwrites** with "Task 1, iter 2" ✓
3. Task 1 complete: `appendTaskResult()` → appends "Task 1 complete" ✓
4. Task 2, Iteration 1: `save()` → **overwrites entire file** with "Task 2, iter 1" ❌
5. ...
6. Task 11, Iteration 1: `save()` → file only has Task 11 ❌

**The `save()` method uses `generateMarkdown()` which creates a fresh file every time**, wiping out all previous content including the appended task results.

#### Why Session-Based Methods Aren't Used

The `run.ts` command never calls:
- `startSession()` - to initialize session tracking
- `setCurrentTask()` - to register current task
- `recordTaskCompletion()` - to add task to session history

These methods exist in `ProgressTracker` but are **never invoked**.

### Options

#### Option A: Use Session-Based Architecture (Recommended)

Wire up the existing session-based methods in `run.ts`.

| Pros                               | Cons                        |
| ---------------------------------- | --------------------------- |
| Architecture already exists        | Need to update run.ts logic |
| Full iteration history preserved   | Minor refactoring required  |
| Cleaner code (single mechanism)    | Testing effort              |
| In-memory accumulation is reliable | -                           |

#### Option B: Fix save() to Append Instead of Overwrite

Modify `save()` to read existing content and append.

| Pros            | Cons                                 |
| --------------- | ------------------------------------ |
| Minimal changes | File grows with repeated iterations  |
| Quick fix       | Duplicate sections per task          |
| -               | Need to parse to update current task |
| -               | Messy file structure                 |

#### Option C: Write Progress Once at Task End Only

Remove `save()` call from iterationEnd handler, only write at task completion.

| Pros                       | Cons                                 |
| -------------------------- | ------------------------------------ |
| Simpler logic              | No progress visible during iteration |
| File written once per task | Loss of iteration detail if crash    |
| Cleaner file structure     | -                                    |

### Recommendation: Option A (Use Session Architecture)

**Rationale**:
1. Architecture already fully implemented in `ProgressTracker`
2. Session-based approach was clearly the intended design
3. `generateFullSessionMarkdown()` produces clean, structured output
4. In-memory accumulation is more reliable than file-based append
5. Minimal net code change (mostly wiring, not new logic)

### Implementation Details

#### Step 1: Update run.ts to Initialize Session

**File**: [src/commands/run.ts](src/commands/run.ts)  
**Location**: After `progressTracker` creation (around line 406)

```typescript
// Create progress tracker with verbosity setting
const progressVerbosity = config.progressVerbosity ?? 'standard';
const progressTracker = new ProgressTracker(undefined, maxIterations, progressVerbosity);

// NEW: Initialize session for multi-task tracking
progressTracker.startSession(branchInfo?.branchName, totalTasksInPlan);
```

#### Step 2: Replace iterationEnd save() with setCurrentTask()

**File**: [src/commands/run.ts](src/commands/run.ts)  
**Location**: iterationEnd event handler (around line 521)

```typescript
// BEFORE:
progressTracker.save(state).catch(() => {
  // Ignore save errors
});

// AFTER:
progressTracker.setCurrentTask(totalTasksProcessed, state);
// Note: This updates in-memory state, file written at task completion
```

#### Step 3: Replace appendTaskResult() with recordTaskCompletion()

**File**: [src/commands/run.ts](src/commands/run.ts)  
**Location**: Task completion handling (lines 563, 602, 617, 638)

```typescript
// BEFORE:
await progressTracker.appendTaskResult(
  activeTask,
  'completed',
  taskAttempt,
  `Completed in ${finalState.iteration} iterations`
);

// AFTER:
await progressTracker.recordTaskCompletion(
  finalState,
  'completed',
  taskAttempt,
  `Completed in ${finalState.iteration} iterations`
);
```

#### Step 4: Deprecate or Remove Old Methods

Mark `save()` and `appendTaskResult()` as deprecated:

```typescript
/**
 * @deprecated Use recordTaskCompletion() instead for multi-task runs
 */
async save(state: FullLoopState): Promise<void> { ... }
```

---

## Issue 4: Auto-Push Not Executed Despite Config

### Problem Statement

After completing all 11 tasks with 15 commits, the `ghcralph/task-15-20260128` branch only exists locally. It was never pushed to the remote repository.

### Evidence

```bash
$ git ls-remote --heads origin
faac297...  refs/heads/main   # Only main exists on remote
```

Config shows:
```json
{
  "autoPush": false,
  "pushStrategy": "per-task"
}
```

### Source Code Analysis

**File**: [src/commands/run.ts](src/commands/run.ts)

The auto-push functionality **is implemented** and works correctly:

```typescript
// Line 425: Config read
const autoPush = config.autoPush ?? false;
const pushStrategy = config.pushStrategy ?? 'per-task';

// Line 584-593: Per-task push
if (autoPush && pushStrategy === 'per-task' && isGitRepo) {
  info('Pushing changes to remote...');
  const pushed = await gitManager.pushToRemote();
  // ...
}

// Line 701-709: Per-run push
if (autoPush && pushStrategy === 'per-run' && isGitRepo && totalTasksCompleted > 0) {
  info('Pushing all changes to remote...');
  const pushed = await gitManager.pushToRemote();
  // ...
}
```

**File**: [src/core/git-branch-manager.ts](src/core/git-branch-manager.ts)

The push method exists and works:

```typescript
// Lines 386-397
async pushToRemote(remote: string = 'origin', force: boolean = false): Promise<boolean> {
  // ...
  await execAsync(`git push ${forceFlag} ${remote} ${currentBranch.name}`.trim(), { cwd: this.config.cwd });
  // ...
}
```

**Root Cause**: The default value `autoPush: false` means push is disabled unless user explicitly enables it. This is **correct behavior** but creates a UX gap:

1. User might not know about `autoPush` config option
2. No CLI flag to enable push for a single run
3. Default behavior doesn't match user expectations

### Options

#### Option A: Add --push CLI Flag (Recommended)

Add a `--push` flag to `ghcralph run` to enable pushing for a single run.

```bash
ghcralph run --file ./PLAN.md --push
```

| Pros                             | Cons                  |
| -------------------------------- | --------------------- |
| Explicit user intent             | Another flag to learn |
| Doesn't change default           | -                     |
| One-time override without config | -                     |

#### Option B: Change Default to autoPush: true

Make auto-push enabled by default.

| Pros                      | Cons                             |
| ------------------------- | -------------------------------- |
| Matches expectations      | Breaking change for some users   |
| No explicit action needed | May push to unwanted remotes     |
| -                         | Auth issues could cause failures |

#### Option C: Prompt User at End of Run

Ask user if they want to push when autoPush is false.

| Pros                  | Cons                       |
| --------------------- | -------------------------- |
| Interactive UX        | Not automation-friendly    |
| User stays in control | Adds delay to completion   |
| -                     | May be annoying in scripts |

#### Option D: Better Documentation + Init Default

Keep default as false, but:
- `ghcralph init` prompts for autoPush preference
- README prominently documents the option
- Run output shows "Push disabled, use --push or set autoPush: true"

| Pros                | Cons                        |
| ------------------- | --------------------------- |
| No breaking changes | Relies on user reading docs |
| Clear messaging     | Extra init complexity       |
| -                   | -                           |

### Recommendation: Option A + Option D Combined

1. **Add `--push` CLI flag** for immediate usability
2. **Add informational message** at run end when push is disabled
3. **Document prominently** in README

### Implementation Details

#### Step 1: Add --push Flag to Run Command

**File**: [src/commands/run.ts](src/commands/run.ts)  
**Location**: Command options definition

```typescript
.option('--push', 'Push changes to remote after completion')
```

#### Step 2: Override autoPush When Flag Present

**File**: [src/commands/run.ts](src/commands/run.ts)  
**Location**: After config loading

```typescript
const autoPush = options.push || (config.autoPush ?? false);
```

#### Step 3: Add Informational Message

**File**: [src/commands/run.ts](src/commands/run.ts)  
**Location**: After final summary, when push didn't happen

```typescript
if (!autoPush && isGitRepo && totalTasksCompleted > 0) {
  console.log('');
  info(`💡 Changes not pushed. Use --push flag or set "autoPush": true in config.`);
}
```

---

## Implementation Priority

### Phase 1: The Ugly - Critical Quality Fixes (3 hours)

| Task | Issue                               | File                                                | Effort |
| ---- | ----------------------------------- | --------------------------------------------------- | ------ |
| 1.1  | Add COMMIT_MESSAGE to prompt-examples | [prompt-examples.ts](src/core/prompt-examples.ts) | 0.5h   |
| 1.2  | Add commit guidelines to context      | [context-builder.ts](src/core/context-builder.ts) | 0.25h  |
| 1.3  | Implement new extractSummary() with block extraction | [loop-engine.ts](src/core/loop-engine.ts) | 0.5h |
| 1.4  | Add truncateAtWord() helper           | [loop-engine.ts](src/core/loop-engine.ts)         | 0.25h  |
| 1.5  | Capture rawResponse and actions       | [loop-engine.ts](src/core/loop-engine.ts)         | 0.5h   |
| 1.6  | Update formatIteration for standard   | [progress-tracker.ts](src/core/progress-tracker.ts) | 0.5h |
| 1.7  | Test commit messages and verbosity    | -                                                   | 0.5h  |

### Phase 2: The Bad - Functional Fixes (3 hours)

| Task | Issue                                   | File                                      | Effort |
| ---- | --------------------------------------- | ----------------------------------------- | ------ |
| 2.1  | Wire up session-based progress          | [run.ts](src/commands/run.ts)             | 1h     |
| 2.2  | Replace save()/appendTaskResult() calls | [run.ts](src/commands/run.ts)             | 0.5h   |
| 2.3  | Add --push CLI flag                     | [run.ts](src/commands/run.ts)             | 0.5h   |
| 2.4  | Add push info message                   | [run.ts](src/commands/run.ts)             | 0.25h  |
| 2.5  | Test all Phase 2 changes                | -                                         | 0.75h  |

---

## Success Criteria

### Issue 1: Commit Message Quality

- [ ] Agent responses include `[COMMIT_MESSAGE]` blocks
- [ ] Commit messages are max 50 chars, imperative mood
- [ ] No commit messages start with "I'll", "Let me", "I need to", etc.
- [ ] No mid-word truncation in any commit messages
- [ ] Fallback chain works when block is absent

### Issue 2: Verbosity

- [ ] `minimal` shows only iteration header and status
- [ ] `standard` shows header + tokens + summary + duration + **actions list**
- [ ] `full` shows everything in standard + **raw agent response**
- [ ] Changing config value produces different output

### Issue 3: Progress Persistence

- [ ] Running 11-task plan produces progress.md with **all 11 tasks** documented
- [ ] Each task section includes iteration count, tokens, duration, summary
- [ ] File header shows run session info (branch, start time, total tasks)
- [ ] File is updated incrementally after each task completion

### Issue 4: Auto-Push

- [ ] `--push` flag pushes branch to remote
- [ ] Info message shown when push not enabled
- [ ] Per-task and per-run strategies both work with --push

---

## Test Plan

### Manual Testing

```bash
# Setup
cd /workspaces/ghc-ralph-cli-demo
git checkout main
git branch -D ghcralph/task-15-20260128  # Delete old test branch
rm -rf .ghcralph/progress.md

# Test all issues
ghcralph run --file ./PLAN.md --verbose --push

# Verify Issue 1: Commit messages are clean
git log --oneline | head -20
# Should see:
#   - No "I'll", "Let me", etc.
#   - Clean messages like "Add division operation" or "Complete: tests pass"
#   - No mid-word cuts

# Verify Issue 2: Verbosity (change config to "full" and re-run subset)

# Verify Issue 3: Progress has all tasks
wc -l .ghcralph/progress.md   # Should be > 200 lines
grep -c "## Task" .ghcralph/progress.md  # Should be 11

# Verify Issue 4: Push worked
git ls-remote --heads origin | grep ghcralph
```

### Unit Tests

Add/update tests:
- `src/core/loop-engine.test.ts` - extractSummary with [COMMIT_MESSAGE] blocks
- `src/core/prompt-examples.test.ts` - COMMIT_MESSAGE_EXAMPLE constant
- `src/core/progress-tracker.test.ts` - session-based methods

---

## Appendix: Files Modified

| File                                                             | Changes                                         |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| [src/core/prompt-examples.ts](src/core/prompt-examples.ts)       | Add COMMIT_MESSAGE_EXAMPLE, update instructions |
| [src/core/context-builder.ts](src/core/context-builder.ts)       | Add commit message guidelines                   |
| [src/core/loop-engine.ts](src/core/loop-engine.ts)               | extractSummary rewrite, truncateAtWord, capture |
| [src/core/progress-tracker.ts](src/core/progress-tracker.ts)     | formatIteration standard verbosity              |
| [src/commands/run.ts](src/commands/run.ts)                       | Session methods, --push flag, info message      |

---

## Appendix: Expected Commit Messages

After fixes, commit messages should look like:

```
# With [COMMIT_MESSAGE] block (best):
abc1234 ghcralph: task 1/11 iter 1 - Add calculator.sh with basic ops
def5678 ghcralph: task 1/11 iter 2 - Fix arithmetic syntax error
ghi9012 ghcralph: task 2/11 iter 1 - Add subtraction operation

# Fallback to COMPLETE reason:
jkl3456 ghcralph: task 3/11 iter 2 - Complete: All operations working

# Fallback to action type:
mno7890 ghcralph: task 4/11 iter 1 - Create src/helper.sh
pqr1234 ghcralph: task 5/11 iter 1 - Run: npm test
```

---

## Appendix: Expected Progress File Structure

After fixes, progress.md should look like:

```markdown
# Ralph Progress Log

## Run Session

- **Started**: 2026-01-28T16:39:48.839Z
- **Branch**: ghcralph/task-15-20260128
- **Total Tasks**: 11
- **Completed**: 11
- **Elapsed**: 2m 55s

---

## Task 1: Create calculator.sh with basic structure

- **ID**: task-15
- **Status**: ✅ completed
- **Attempt**: 1
- **Iterations**: 2
- **Tokens Used**: 2,864
- **Started**: 2026-01-28T16:40:00.000Z
- **Completed**: 2026-01-28T16:40:45.000Z
- **Duration**: 45s
- **Summary**: Completed in 2 iterations

### Iteration Log

#### Iteration 1 (4:40:05 PM) ✓

- **Tokens**: 1,325
- **Summary**: [ACTION:CREATE]
- **Duration**: 20s

**Actions**:
- ✓ `[CREATE]` calculator.sh
- ✓ `[EXECUTE]` chmod +x calculator.sh && ./calculator.sh 5 + 3

#### Iteration 2 (4:40:25 PM) ✓

- **Tokens**: 1,539
- **Summary**: Task complete: calculator.sh created with basic structure
- **Duration**: 20s

**Actions**:
- ✓ `[EXECUTE]` ls -la *.test.*
- ✓ `[COMPLETE]` calculator.sh created with basic structure

---

## Task 2: Implement addition operation (+)

- **ID**: task-16
- **Status**: ✅ completed
...
```

# GHC Ralph CLI - Remediation Plan

**Date**: January 28, 2026  
**Issue**: CLI gets stuck after 2 iterations, processing only the first task of a multi-task plan  
**Severity**: Critical (core functionality broken)  
**Reported via**: `ghcralph run --file ./PLAN.md --verbose` in ghc-ralph-cli-demo

---

## Executive Summary

The `ghcralph` CLI fails to process all tasks in a Markdown plan file. After successfully completing the first task ("Create calculator.sh with basic structure"), the CLI terminates prematurely instead of continuing to the remaining 11 tasks in the plan.

---

## ⚠️ Critical Pattern Analysis (from Original Source)

After reviewing the original Ralph Wiggum pattern documentation from Geoffrey Huntley:
- [ghuntley.com/ralph](https://ghuntley.com/ralph/)
- [ghuntley.com/loop](https://ghuntley.com/loop/)

### Key Quotes from Original Pattern

**From /ralph/**:
> "In its purest form, Ralph is a Bash loop: `while :; do cat PROMPT.md | claude-code ; done`"

> "Ralph is monolithic. Ralph works autonomously in a single repository as a single process that **performs one task per loop**."

**From /loop/**:
> "In practice this means doing the loop manually via prompting or via automation **with a pause that involves having to press CTRL+C to progress onto the next task**. This is still ralphing..."

> "It's important to watch the loop as that is where your personal development and learning will come from."

### Pattern Interpretation Options

There are **two valid interpretations** of how the CLI should behave with multi-task plan files:

| Aspect         | Option 1: Strict Ralph                   | Option 2: Automated Multi-Task    |
| -------------- | ---------------------------------------- | --------------------------------- |
| **Philosophy** | Human-in-the-loop per task               | Fully automated plan execution    |
| **Flow**       | One task → Exit → Human reviews → Re-run | All tasks → Continuous until done |
| **Control**    | Press CTRL+C to continue                 | `--continuous` flag opt-in        |
| **Learning**   | Forces human observation                 | Async background processing       |

**The original pattern leans toward Option 1** (human pause between tasks), but the CLI's README and `--file PLAN.md` UX suggests **Option 2** is the expected behavior for this tool.

### Recommended Approach: Hybrid

Support both modes:
- **Default**: Process all tasks automatically (user expectation for `--file PLAN.md`)
- **`--pause-between-tasks`**: Stop after each task for human review (strict Ralph mode)

---

## Expected Process Flow (User's Requirement)

```
1. Parse plan file → Extract list of tasks (grouped by phases or not)
2. Get next non-completed task → Delegate to fresh AI agent instance
3. On agent result (success/failure) → Document in progress file, mark task status
4. Check for remaining tasks → If yes, go to step 2; If no, terminate
```

---

## 1. Investigation Findings

### 1.1 Observed Behavior

When running `ghcralph run --file ./PLAN.md`:

1. ✅ CLI correctly parses PLAN.md and identifies 12 tasks
2. ✅ CLI selects the first pending task: "Create calculator.sh with basic structure"
3. ✅ Loop engine runs 2 iterations successfully
4. ✅ AI creates a basic `calculator.sh` file (incomplete implementation)
5. ✅ AI marks the task as complete with `[ACTION:COMPLETE]`
6. ✅ Task checkbox is updated in PLAN.md (`[x]`)
7. ❌ **CLI terminates instead of processing the next pending task**

### 1.2 Evidence from Test Run

**Progress file state** (`.ghcralph/progress.md`):
- Status: ✅ Completed
- Iterations: 2/10
- Tokens Used: 2,285
- Only first task processed

**PLAN.md state**:
- Only 1 of 12 tasks marked complete: `[x] Create calculator.sh with basic structure`
- 11 remaining tasks still pending (unchecked)

**calculator.sh output**:
- Basic skeleton with argument parsing
- No arithmetic operations implemented
- Does not meet expected outcomes from PLAN.md

### 1.3 Root Cause Analysis

**PRIMARY ROOT CAUSE: Missing Task Iteration Loop**

The `run` command in [src/commands/run.ts](src/commands/run.ts) only processes **one task per invocation**. There is no outer loop to continue processing the remaining pending tasks after the first task completes.

**Architecture Documentation Gap**: The [docs/architecture.md](docs/architecture.md) sequence diagram shows the flow ending at "Phase 5: Completion" with no loop back to process additional tasks. This suggests the multi-task iteration was **never implemented**, even though the README and user expectations imply it should work.

**Code Flow Analysis:**

```
run.ts (lines 270-280):
  1. planManager.getNextTask()  ← Gets first pending task
  2. task = nextTask            ← Assigns to single variable
  3. engine.start(task)         ← Runs loop for ONE task
  4. planManager.completeTask() ← Marks task complete
  5. EXIT                       ← No loop to get next task!
```

**Key Issue Location**: [run.ts#L476-L480](src/commands/run.ts#L476-L480)

```typescript
if (finalState.status === 'completed') {
  // Mark task as complete in plan file if using a plan
  if (planManager) {
    await planManager.completeTask(task.id);
    info(`Task marked as complete in plan file`);
  }
  success('Loop completed successfully');  // ← Exits here!
}
```

After marking the task complete, the CLI simply exits instead of:
1. Calling `planManager.getNextTask()` to get the next pending task
2. Creating a **fresh AI agent instance** for that task (per Ralph pattern)
3. Starting a new loop for that task
4. Repeating until all tasks are complete

### 1.4 Secondary Issues Identified

| Issue                                    | Description                                                       | Severity |
| ---------------------------------------- | ----------------------------------------------------------------- | -------- |
| **Incomplete Implementation Quality**    | AI marked task complete with only a skeleton implementation       | Medium   |
| **No Verification Hook Failure**         | If tests existed, verification should have failed                 | Medium   |
| **Progress Not Persisted Across Tasks**  | Progress file only tracks current task, not overall plan progress | Low      |
| **No Task-Level Retry with Fresh Agent** | Failed tasks are marked failed, no retry with learning            | Medium   |
| **No Honesty Prompt Guidance**           | Prompt doesn't encourage agent to be honest about failures        | Medium   |

---

## 2. Proposed Solutions

### Option A: Hybrid Mode with `--continuous` Flag (Recommended)

**Description**: Add multi-task iteration loop that runs by default, with an optional `--pause-between-tasks` flag for strict Ralph pattern adherence. Include task-level retry with fresh agent that benefits from progress documentation.

**Behavior**:
- `ghcralph run --file PLAN.md` → Processes ALL tasks automatically (default)
- `ghcralph run --file PLAN.md --pause-between-tasks` → Stops after each task for human review
- Failed tasks can be retried with a fresh agent up to `maxRetriesPerTask` times (default: 2)
- Each retry creates a fresh agent but includes progress document learnings in context

**Pros**:
- Meets user expectations for `--file PLAN.md` workflow
- Respects original Ralph pattern philosophy with opt-in pause mode
- Failed tasks get retried with fresh agent + learned context
- Encourages honest failure reporting through prompt engineering
- `PlanManager` interface already supports `getNextTask()`

**Cons**:
- Additional flag to document
- Need to handle edge cases (interrupts, cumulative budgets)

**Implementation Sketch**:
```typescript
// In run.ts - after initial task selection
let task: Task | null = await planManager.getNextTask();
let taskNumber = 0;

// CheckpointManager is already created earlier and handles per-iteration commits
// We'll add a final "task complete" checkpoint after each task

while (task) {
  taskNumber++;
  let taskAttempt = 0;
  let taskCompleted = false;
  
  while (!taskCompleted && taskAttempt < config.maxRetriesPerTask) {
    taskAttempt++;
    
    if (taskAttempt === 1) {
      info(`\n📋 Task ${taskNumber}: ${task.title}`);
    } else {
      info(`\n🔄 Retry ${taskAttempt}/${config.maxRetriesPerTask} for task: ${task.title}`);
    }
    
    // Create FRESH agent instance for each attempt (Ralph pattern core principle)
    const agent = new CopilotAgent({ model, maxTokensPerRequest: 4096 });
    
    // Build context that includes learnings from progress document
    const previousProgress = await progressTracker.loadPreviousTaskResults();
    const engineConfigWithContext = {
      ...engineConfig,
      contextConfig: {
        ...engineConfig.contextConfig,
        previousTaskProgress: previousProgress, // Inject learnings from prior attempts/tasks
      }
    };
    
    const engine = new LoopEngine(agent, engineConfigWithContext);
    
    // NOTE: The engine's event handlers already create checkpoints (commits) 
    // after each successful ITERATION via checkpointManager.createCheckpoint()
    
    const finalState = await engine.start(task);
    
    // Document result in progress file (success OR failure - for learning)
    await progressTracker.appendTaskResult(task, finalState, taskAttempt);
    
    if (finalState.status === 'completed') {
      taskCompleted = true;
      await planManager.completeTask(task.id);
      
      // Create a "task complete" checkpoint commit
      await checkpointManager.createTaskCheckpoint(task, finalState);
      
      // Push changes to remote (opinionated addition)
      if (config.autoPush) {
        await gitManager.pushToRemote();
      }
      
      success(`✓ Task completed: ${task.title}`);
    } else {
      warn(`✗ Task attempt ${taskAttempt} failed: ${task.title}`);
      // On failure, commit progress so far for documentation
      await checkpointManager.createFailureCheckpoint(task, finalState, taskAttempt);
    }
    
    // Cleanup agent before next attempt or next task
    await agent.destroy();
  }
  
  if (!taskCompleted) {
    // All retries exhausted
    await planManager.failTask(task.id);
    error(`❌ Task failed after ${config.maxRetriesPerTask} attempts: ${task.title}`);
  }
  
  // Optional pause for human review (strict Ralph mode)
  if (options.pauseBetweenTasks) {
    info('Press Enter to continue to next task, or Ctrl+C to stop...');
    await waitForKeypress();
  }
  
  // Get next task
  await planManager.reload?.();
  task = await planManager.getNextTask();
}

success(`\n🎉 All ${taskNumber} tasks in the plan are complete!`);
```

#### Key Behaviors Preserved/Enhanced:

| Behavior                        | Current Implementation                                          | After Fix                                          |
| ------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| **Branch Isolation**            | ✅ Creates `ghcralph/*` branch at run start                      | ✅ Preserved                                        |
| **Per-Iteration Commits**       | ✅ `iterationEnd` event → `checkpointManager.createCheckpoint()` | ✅ Preserved                                        |
| **Per-Task Commits**            | ❌ Not implemented                                               | ✅ Add `createTaskCheckpoint()`                     |
| **Push to Remote**              | ❌ Not implemented                                               | ✅ Add `autoPush` config + `pushToRemote()`         |
| **Task Retry with Fresh Agent** | ❌ Not implemented                                               | ✅ Add retry loop with new agent per attempt        |
| **Learn from Progress Doc**     | ⚠️ Only within single agent session                              | ✅ Load previous task results for new agent context |

#### Prompt Engineering for Honesty & Graceful Failure

The prompt template in `src/core/context-builder.ts` should be enhanced to encourage honest reporting and graceful failure handling. Add the following to the prompt:

```typescript
// Add to DEFAULT_PROMPT_TEMPLATE in context-builder.ts

const HONESTY_GUIDANCE = `
## Failure Handling & Honesty

**IMPORTANT**: Be honest about your progress and limitations.

- If you **cannot complete** the task, do NOT use [ACTION:COMPLETE]
- Instead, document what you tried and why it failed
- Use [ACTION:EXECUTE] to verify your work before claiming completion
- If tests fail or you encounter blocking issues, report them honestly

**When you cannot proceed**, respond with:
\`\`\`
[ACTION:STUCK]
attempted: <what you tried>
blocker: <what is preventing completion>
suggestion: <what might help - different approach, human intervention, etc.>
\`\`\`

This honest reporting helps:
1. The next agent attempt learn from your experience
2. Humans understand what went wrong
3. The progress document serve as accurate documentation
`;
```

This guidance will be injected into the prompt, encouraging agents to:
1. **Be honest** about whether the task is truly complete
2. **Document failures** properly for learning
3. **Use verification** (tests) before claiming completion
4. **Report blockers** clearly instead of false completion

---

### Option B: Recursive Re-invocation via Child Process

**Description**: After completing a task, spawn a new `ghcralph run` process for the same plan file.

**Pros**:
- Clean state between tasks (fresh agent per task automatically)
- Simpler implementation

**Cons**:
- Overhead of process spawning
- Loss of session context
- Harder to manage cumulative token limits
- Not idiomatic

---

### Option C: Create a Separate `ghcralph run-plan` Command

**Description**: Create a new command specifically for running entire plan files, keeping `run` for single tasks.

**Pros**:
- Clear separation of concerns
- Backward compatible

**Cons**:
- User confusion (which command to use?)
- Code duplication
- Inconsistent with current `--file` behavior expectations

---

## 3. Recommended Solution

**Option A: Add Task Iteration Loop in run.ts**

This is the most natural fix because:
1. The `PlanManager` interface already has `getNextTask()` and `completeTask()` methods designed for this pattern
2. Users expect `--file PLAN.md` to process all tasks in the plan
3. Minimal disruption to existing codebase
4. Easy to test

---

## 4. Implementation Plan

### Phase 1: Core Fix (Critical)

| Task                                            | File                              | Effort |
| ----------------------------------------------- | --------------------------------- | ------ |
| Add outer while loop for task iteration         | `src/commands/run.ts`             | 2h     |
| Add task-level retry loop with fresh agent      | `src/commands/run.ts`             | 1.5h   |
| Add `--pause-between-tasks` flag                | `src/commands/run.ts`             | 0.5h   |
| Add `waitForKeypress()` utility                 | `src/utils/index.ts`              | 0.5h   |
| Reset engine state between tasks                | `src/core/loop-engine.ts`         | 1h     |
| Add `reload()` method to LocalMarkdownPlan      | `src/core/local-markdown-plan.ts` | 0.5h   |
| Update progress tracker for multi-task sessions | `src/core/progress-tracker.ts`    | 1h     |
| Add `loadPreviousTaskResults()` method          | `src/core/progress-tracker.ts`    | 1h     |
| Add `createTaskCheckpoint()` method             | `src/core/checkpoint-manager.ts`  | 0.5h   |
| Add `createFailureCheckpoint()` method          | `src/core/checkpoint-manager.ts`  | 0.5h   |
| Add `pushToRemote()` method                     | `src/core/git-branch-manager.ts`  | 0.5h   |
| Add `autoPush` and `maxRetriesPerTask` config   | `src/core/config-schema.ts`       | 0.5h   |

### Phase 1b: Prompt Engineering (Honesty & Failure Handling)

| Task                                      | File                          | Effort |
| ----------------------------------------- | ----------------------------- | ------ |
| Add `HONESTY_GUIDANCE` to prompt template | `src/core/context-builder.ts` | 0.5h   |
| Add `[ACTION:STUCK]` action type          | `src/core/response-parser.ts` | 1h     |
| Handle STUCK action in action-executor    | `src/core/action-executor.ts` | 0.5h   |
| Include previous task results in context  | `src/core/context-builder.ts` | 1h     |

### Phase 2: Token Budget Management

| Task                                      | File                  | Effort |
| ----------------------------------------- | --------------------- | ------ |
| Decide per-task vs cumulative token limit | Design decision       | 0.5h   |
| Implement token budget carry-over         | `src/commands/run.ts` | 1h     |
| Add `--per-task-budget` flag              | `src/commands/run.ts` | 0.5h   |

### Phase 3: Testing & Verification

| Task                                     | File                            | Effort |
| ---------------------------------------- | ------------------------------- | ------ |
| Add integration test for multi-task plan | `test/integration/`             | 2h     |
| Test task retry with fresh agent         | `test/integration/`             | 1h     |
| Test pause-between-tasks mode            | `test/integration/`             | 1h     |
| Test commit/push after task completion   | `test/integration/`             | 1h     |
| Test progress document learning          | `test/integration/`             | 1h     |
| Test STUCK action handling               | `test/integration/`             | 1h     |
| Test interruption/resume behavior        | `test/integration/`             | 1h     |
| Update documentation                     | `README.md`, `docs/cookbook.md` | 1h     |

---

## 5. Success Criteria

After implementing this fix:

### Core Functionality
1. ✅ Running `ghcralph run --file PLAN.md` processes ALL pending tasks sequentially (default)
2. ✅ Running `ghcralph run --file PLAN.md --pause-between-tasks` stops for human review after each task
3. ✅ Each task is delegated to a **fresh AI agent instance** (clean context per task)
4. ✅ Each task is marked complete/failed in PLAN.md after processing
5. ✅ Progress is documented in the progress file after each task (success or failure)
6. ✅ CLI only exits when all tasks are complete OR on error/interrupt
7. ✅ Token budget is properly managed (per-task or cumulative, based on design decision)

### Task Retry with Fresh Agent & Progress Learning
8. ✅ Failed tasks are retried with a **brand new agent instance** (fresh context window)
9. ✅ Fresh agents **benefit from progress document learnings** (previous task results injected)
10. ✅ Each retry attempt is logged with attempt number in progress document
11. ✅ Failure checkpoints preserve state for post-mortem analysis

### Prompt Engineering for Honest Failure Reporting
12. ✅ Agent prompt includes **honesty guidance** encouraging accurate result reporting
13. ✅ Agent can use `[ACTION:STUCK]` to gracefully signal inability to complete task
14. ✅ STUCK action triggers: failure checkpoint, retry with fresh agent, helpful error message
15. ✅ After max retries, task marked as failed with diagnostic information preserved

### Git Integration (Opinionated Additions - PRESERVED)
16. ✅ **Branch Isolation**: Run starts on isolated `ghcralph/*` branch (existing behavior preserved)
17. ✅ **Per-Iteration Commits**: Checkpoint commit after each successful iteration (existing behavior preserved)
18. ✅ **Per-Task Commits**: Additional checkpoint commit when task is marked complete (new)
19. ✅ **Auto-Push**: Push to remote after each successful task completion (new, via `autoPush` config)

---

## 6. Rollback Plan

If the fix introduces regressions:
1. Revert the commit
2. Document the issue for further investigation
3. Consider Option C (separate command) as a fallback

---

## 7. References

### Internal Code

- [loop-engine.ts](src/core/loop-engine.ts) - Core loop implementation
- [run.ts](src/commands/run.ts) - Run command (fix location)
- [local-markdown-plan.ts](src/core/local-markdown-plan.ts) - Plan manager
- [plan-manager.ts](src/core/plan-manager.ts) - PlanManager interface
- [docs/architecture.md](docs/architecture.md) - Architecture documentation (needs update)

### External References

- [ghuntley.com/ralph](https://ghuntley.com/ralph/) - Original Ralph Wiggum pattern description:
  > "In its purest form, Ralph is a Bash loop: `while :; do cat PROMPT.md | claude-code ; done`"
  > "Ralph works autonomously in a single repository as a single process that performs one task per loop."
  
- [ghuntley.com/loop](https://ghuntley.com/loop/) - Loop pattern details:
  > "In practice this means doing the loop manually via prompting or via automation with a pause that involves having to press CTRL+C to progress onto the next task."
  > "It's important to watch the loop as that is where your personal development and learning will come from."

- [README.md](README.md) - User-facing documentation of expected behavior

# Model Compatibility Test Plan

Goal: validate that each advertised/default model works end-to-end with `ghcralph run` (no hangs, produces ACTION blocks, can complete the calculator scenario).

## Scope
- Use the existing realistic scenario: `test/integration/calculator/PLAN.md`
- Run the same task with each model, capturing:
  - time-to-first-response (iteration 1)
  - whether iteration progresses beyond "Executing prompt"
  - whether the loop can reach COMPLETE
  - whether process exits cleanly (no external `timeout` kill)

## Models to Test
- [ ] gpt-4.1
- [ ] gpt-4
- [ ] gpt-5
- [ ] gpt-5.2-codex
- [ ] claude-sonnet-4.5

## Recommended Test Setup (per model)
1. Build CLI:
   - [ ] `npm run -s build`
2. Reset the calculator directory state (optional but recommended):
   - [ ] `cd test/integration/calculator && git checkout -- . && rm -f calculator.sh && rm -rf .ghcralph`
3. Configure model (local config preferred):
   - [ ] `cd test/integration/calculator && node ../../../bin/ghcralph.js config set defaultModel <MODEL>`
4. Run the plan with hard timeout and verbose logs:
   - [ ] `cd test/integration/calculator && timeout 180s node ../../../bin/ghcralph.js run --file PLAN.md --force --verbose`
5. Validate output:
   - [ ] `cd /workspaces/ghc-ralph-cli && npx vitest run --config vitest.integration.config.ts test/integration/calculator/calculator.test.ts`

## Expected Observations
- Iteration 1 should progress past:
  - `Executing prompt (...)`
  within a reasonable time (suggested budget: <60s).
- If the loop completes but the process does not exit, record it as "exit hang".
- If the loop never progresses past `Executing prompt`, record it as "request hang".

## Results Table (fill in)
| Model             | Iteration 1 response (s) | Completes? | Exits cleanly? | Notes |
| ----------------- | ------------------------ | ---------- | -------------- | ----- |
| gpt-4.1           |                          |            |                |       |
| gpt-4             |                          |            |                |       |
| gpt-5             |                          |            |                |       |
| gpt-5.2-codex     |                          |            |                |       |
| claude-sonnet-4.5 |                          |            |                |       |

## Follow-ups
- [ ] If a model hangs only with `sendAndWait`, prefer event-driven wait (session.idle).
- [ ] If a model hangs on exit, investigate Copilot SDK client shutdown (`stop()` vs `forceStop()`) and outstanding async tasks.

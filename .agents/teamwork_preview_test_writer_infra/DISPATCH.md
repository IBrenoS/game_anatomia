# Dispatch Assignment — Test Writer (E2E Testing Track Infrastructure)

## Mission
Establish the complete testing infrastructure for Batalha Anatômica per R4 (P3.1, P3.2, P3.3, P3.4, P3.5) and `TEST_INFRA.md`.

## Inputs & Authoritative References
- `D:\game_anatomia\.agents\ORIGINAL_REQUEST.md` (MUST read first)
- `D:\game_anatomia\PROJECT.md`
- `D:\game_anatomia\TEST_INFRA.md`
- `D:\game_anatomia\.agents\teamwork_preview_explorer_survey_3\handoff.md` (Detailed analysis of test gaps, missing configs, scripts)

## File Ownership (Exclusive)
- `tests/` directory (`tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/load/`)
- `playwright.config.ts`
- `packages/game/src/__tests__/scoring.test.ts`
- `packages/game/src/__tests__/ranking.test.ts`
- `packages/game/src/__tests__/state-machine.test.ts`
- Root `package.json` (scripts for `test:e2e`, `test:integration`, `test:load`, `typecheck`)

## Specific Tasks to Execute
1. **P3.1 Domain Unit Tests Expansion**:
   - Add boundary tests for 9999ms, 10000ms, 10001ms across all base points (100, 200, 300) in `packages/game/src/__tests__/scoring.test.ts`.
   - Add cascading multi-player tie tests (3+ players) with identical points/correct answers, checking distance to previous when tied, in `packages/game/src/__tests__/ranking.test.ts`.
   - Add state machine tests covering the 10th question sequence (`QUESTION_REVEAL` -> `FINAL_RANKING` -> `PODIUM` -> `FINISHED`) and terminal state immutability in `packages/game/src/__tests__/state-machine.test.ts`.
2. **P3.2 Worker + DO Integration Tests**:
   - Create comprehensive integration tests in `tests/integration/worker-game-room.test.ts` testing:
     - WebSocket upgrade and immediate snapshot delivery.
     - Player connection, presence, disconnect, and `RESUME_SESSION`.
     - 10th question transition sequence.
     - Authoritative answer submission and rejection of invalid options/out-of-time answers.
     - Pause and resume preserving active elapsed time and bonus window.
3. **P3.3 Playwright E2E Setup & Full 10-Question Suite**:
   - Create `playwright.config.ts` configured for local testing.
   - Update/expand `tests/e2e/game-flow.spec.ts` to test the FULL game lifecycle: Host opens room, Screen opens on `/screen/:pin`, players join on mobile view, play all 10 questions, transition through final ranking to sequential podium ceremony, plus testing player reconnection and duplicate nickname rejection.
4. **P3.4 Real WebSocket Load Test**:
   - Create/update `tests/load/websocket-load.ts` to run a REAL load test opening 50 concurrent WebSocket client connections against the server, each submitting answers within ~2s, measuring latencies, ensuring 0 dropped messages and verifying final state consistency.
5. **P3.5 Monorepo Typecheck & Build Scripts**:
   - Ensure root `package.json` has working scripts: `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:load`, `pnpm build`, `pnpm typecheck`.
   - Fix lint or typecheck discrepancies.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion & Handoff
Run tests and verify. When test suite is ready, publish `TEST_READY.md` at project root with the test summary and commands. Write your handoff report to `D:\game_anatomia\.agents\teamwork_preview_test_writer_infra\handoff.md` and notify parent.

## 2026-09-17T04:39:04Z
You are teamwork_preview_test_writer_infra.
Your working directory is D:\game_anatomia\.agents\teamwork_preview_test_writer_infra.
Read D:\game_anatomia\.agents\ORIGINAL_REQUEST.md, D:\game_anatomia\PROJECT.md, D:\game_anatomia\TEST_INFRA.md, and D:\game_anatomia\.agents\teamwork_preview_test_writer_infra\DISPATCH.md.
You are tasked with the E2E Testing Track Infrastructure (P3.1–P3.5).
Your exclusively owned files are:
- tests/ (tests/integration/, tests/e2e/, tests/load/)
- playwright.config.ts
- packages/game/src/__tests__/scoring.test.ts, ranking.test.ts, state-machine.test.ts
- root package.json (test and typecheck scripts)

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Expand unit tests, create DO integration tests, complete Playwright E2E 10-question suite, create 50-connection WebSocket load test, ensure build & typecheck scripts work, publish TEST_READY.md at project root when complete, write a comprehensive handoff report to D:\game_anatomia\.agents\teamwork_preview_test_writer_infra\handoff.md, and message parent when finished.


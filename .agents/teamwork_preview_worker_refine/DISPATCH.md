# Dispatch Assignment — Worker Refine (Join & Socket Polish + Full Suite Run)

## Mission
Polish `JoinPage.tsx` and `useGameSocket.ts` to address the minor edge cases identified in `TEST_READY.md § 3`, and execute all test suites to confirm 100% green status across the monorepo.

## Inputs & Authoritative References
- `D:\game_anatomia\.agents\ORIGINAL_REQUEST.md` (MUST read first)
- `D:\game_anatomia\PROJECT.md`
- `D:\game_anatomia\TEST_READY.md` (Section 3 details the two edge cases)

## File Ownership (Exclusive)
- `apps/web/src/pages/JoinPage.tsx`
- `apps/web/src/hooks/useGameSocket.ts`

## Specific Tasks
1. In `apps/web/src/pages/JoinPage.tsx`:
   - In `handleJoin`: If `wsManager.state === 'connected'`, call `wsManager.joinRoom(pin, nickname.trim())` directly. If state is not connected, call `connect(pin, 'player')` and await `connected`.
2. In `apps/web/src/hooks/useGameSocket.ts`:
   - Avoid closing the WebSocket on unmount if navigating between `/join` and `/play` with an active session token, or gracefully handle reconnection without requiring page reload.
3. Run and verify all suites:
   - `pnpm test`
   - `pnpm run test:integration`
   - `pnpm run test:e2e`
   - `pnpm run test:load`
   - `pnpm typecheck`
   - `pnpm build`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion & Handoff
Record all command outputs and results in `D:\game_anatomia\.agents\teamwork_preview_worker_refine\handoff.md` and message parent when complete.

## 2026-09-17T06:37:41Z
You are teamwork_preview_worker_refine.
Your working directory is D:\game_anatomia\.agents\teamwork_preview_worker_refine.
Read D:\game_anatomia\.agents\ORIGINAL_REQUEST.md, D:\game_anatomia\PROJECT.md, D:\game_anatomia\TEST_READY.md, and D:\game_anatomia\.agents\teamwork_preview_worker_refine\DISPATCH.md.
Your exclusively owned files are:
- apps/web/src/pages/JoinPage.tsx
- apps/web/src/hooks/useGameSocket.ts

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Refine JoinPage.tsx (handleJoin when already connected) and useGameSocket.ts per TEST_READY.md § 3.
Run the complete test suite:
- pnpm test
- pnpm run test:integration
- pnpm run test:e2e
- pnpm run test:load
- pnpm typecheck
- pnpm build

Write a complete report with exact outputs to D:\game_anatomia\.agents\teamwork_preview_worker_refine\handoff.md and send a message to parent when done.

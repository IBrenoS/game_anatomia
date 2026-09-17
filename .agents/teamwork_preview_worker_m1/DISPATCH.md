# Dispatch Assignment — Worker M1 (Backend & Realtime Stabilization)

## Mission
Implement all backend, Durable Object, WebSocket lifecycle, state machine, and realtime protocol fixes for Milestone 1 (P0.1–P0.7, P1.8, P1.9).

## Inputs & Authoritative References
- `D:\game_anatomia\.agents\ORIGINAL_REQUEST.md` (MUST read first)
- `D:\game_anatomia\PROJECT.md`
- `D:\game_anatomia\.agents\teamwork_preview_explorer_survey_1\handoff.md` (Detailed root causes and code solutions)

## File Ownership (Exclusive)
- `packages/game/src/state-machine.ts`
- `apps/web/worker/game-room.ts`
- `apps/web/worker/index.ts`
- `apps/web/src/lib/ws.ts`
- `apps/web/src/stores/gameStore.ts`

## Specific Tasks to Execute
1. **P0.1 Host Immediate Snapshot**: In `handleWebSocketUpgrade` in `apps/web/worker/game-room.ts`, immediately call `this.sendSnapshot(server, role)`. In `apps/web/src/lib/ws.ts`, send `REQUEST_SNAPSHOT` on `onopen`.
2. **P0.2 Player Lifecycle & Reconnection**: In `apps/web/src/lib/ws.ts`, automatically emit `RESUME_SESSION` with `token` and `pin` when connecting with a saved player token. In `game-room.ts` (`handleResumeSession`), include `reconnectToken` in `SESSION_ACCEPTED`. In `gameStore.ts` (`handleSnapshot`), restore `personalAnswers` from payload so buttons and answer state remain locked upon reconnection.
3. **P0.3 Protocol Ordering & Deduplication**: In `apps/web/src/lib/ws.ts`, implement `eventId` deduplication, validate `roomVersion` sequencing, discard outdated events, and trigger `REQUEST_SNAPSHOT` if a gap is detected (`roomVersion > current + 1`).
4. **P0.4 DO WebSocket Hibernation & Identity**: Use `ws.serializeAttachment({ playerId, role, connectionId })` and `ws.deserializeAttachment()` so identity survives DO hibernation without relying on volatile JS properties. Ensure `player:${playerId}` tag is set and presence/disconnect tracking updates SQLite accurately.
5. **P0.5 10th Question State Machine**: In `packages/game/src/state-machine.ts`, add `{ from: 'QUESTION_REVEAL', to: 'FINAL_RANKING', trigger: 'host shows ranking (last question)' }` to `VALID_TRANSITIONS`. Ensure state advances deterministically through `FINAL_RANKING` -> `PODIUM` -> `FINISHED` without error.
6. **P0.6 Authoritative Answer Validation**: In `handleSubmitAnswer`, verify that `questionId === activeQuestion.id`, that `optionId` belongs to `question.options`, that `receivedAt <= deadlineAt`, and game is not paused. If the player already submitted the identical `optionId`, re-acknowledge `ANSWER_ACCEPTED` idempotently without error.
7. **P0.7 Pause, Resume & Bonus Window**: In the `rounds` table, track `elapsed_active_ms` (accumulated active time). On pause, calculate and save elapsed active time. On resume, restore remaining time and keep elapsed active time accurate so the 10s speed bonus window is strictly preserved.
8. **P1.8 Host Session Security & P1.9 Rate Limiting**: In `apps/web/worker/index.ts`, implement an in-memory sliding-window rate limit for `POST /api/rooms` by IP. Enforce payload size limits on incoming WebSocket messages in `game-room.ts`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion & Handoff
Run unit tests (`pnpm test`) and verify clean build/typecheck for your owned files. Write your detailed report to `D:\game_anatomia\.agents\teamwork_preview_worker_m1\handoff.md` and message parent when complete.

## 2026-09-17T04:39:04Z
<USER_REQUEST>
You are teamwork_preview_worker_m1.
Your working directory is D:\game_anatomia\.agents\teamwork_preview_worker_m1.
Read D:\game_anatomia\.agents\ORIGINAL_REQUEST.md, D:\game_anatomia\PROJECT.md, and D:\game_anatomia\.agents\teamwork_preview_worker_m1\DISPATCH.md.
You are tasked with Milestone 1: Backend & Realtime Stabilization (P0.1–P0.7, P1.8, P1.9).
Your exclusively owned files are:
- packages/game/src/state-machine.ts
- apps/web/worker/game-room.ts
- apps/web/worker/index.ts
- apps/web/src/lib/ws.ts
- apps/web/src/stores/gameStore.ts

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the fixes, run unit tests to verify your changes, write a comprehensive handoff report to D:\game_anatomia\.agents\teamwork_preview_worker_m1\handoff.md, and message parent when finished.
</USER_REQUEST>


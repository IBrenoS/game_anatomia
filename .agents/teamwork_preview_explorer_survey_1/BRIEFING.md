# BRIEFING — 2026-09-17T04:35:50Z

## Mission
Investigate backend, Durable Object, WebSocket lifecycle, state machine, and realtime protocol in D:\game_anatomia to identify root causes and design fixes for P0.1-P0.7, P1.8, P1.9.

## 🔒 My Identity
- Archetype: explorer
- Roles: Teamwork explorer (backend & realtime audit)
- Working directory: D:\game_anatomia\.agents\teamwork_preview_explorer_survey_1
- Original parent: 85b15ce9-1e5c-40f7-9486-81353ffc68dd
- Milestone: survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Produce 5-component handoff report in handoff.md
- Use send_message to notify parent when complete

## Current Parent
- Conversation ID: 85b15ce9-1e5c-40f7-9486-81353ffc68dd
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `apps/web/worker/game-room.ts` & `index.ts`
  - `packages/game/src/state-machine.ts`, `eligibility.ts`, `scoring.ts`, `ranking.ts`
  - `packages/protocol/src/envelope.ts`, `schemas.ts`, `types.ts`, `errors.ts`, `constants.ts`
  - `apps/web/src/hooks/useGameSocket.ts`
  - `apps/web/src/lib/ws.ts` & `api.ts`
  - `apps/web/src/stores/gameStore.ts`
  - `apps/web/src/pages/HostPage.tsx`, `HostEntryPage.tsx`, `PlayerPage.tsx`, `JoinPage.tsx`, `ScreenPage.tsx`
  - `apps/web/src/components/host/HostControls.tsx`, `HostLobby.tsx`
  - `tests/e2e/game-flow.spec.ts` & `tests/load/load-simulation.ts`
- **Key findings**:
  - P0.1: `handleWebSocketUpgrade` never sends `SNAPSHOT` to host/screen; `roomState` remains `null`.
  - P0.2: `useGameSocket` disconnects on unmount; `PlayerPage` doesn't send `RESUME_SESSION`; `handleResumeSession` omits `reconnectToken`; `handleSnapshot` ignores `personalAnswers`.
  - P0.3: `ws.onmessage` lacks `eventId` deduplication, `roomVersion` gap detection, and `REQUEST_SNAPSHOT` trigger.
  - P0.4: `game-room.ts` uses volatile JS properties (`__playerId`, `__role`) lost during DO hibernation; never uses `ws.serializeAttachment(...)`.
  - P0.5: `VALID_TRANSITIONS` lacks `QUESTION_REVEAL -> FINAL_RANKING`, causing crash on Question 10.
  - P0.6: `handleSubmitAnswer` lacks question ID and option membership checks; lacks idempotent re-acknowledgement.
  - P0.7: `rounds` overwrites `started_at = now` on resume without storing active elapsed time, distorting the 10s agility bonus.
  - P1.8/P1.9: Host token stored in plaintext localStorage without HttpOnly cookie; no rate limiting or payload size caps.
- **Unexplored areas**: None for backend and realtime audit scope.

## Key Decisions Made
- Fully documented root causes, file locations, code snippets, logic chains, and concrete fix specifications in `handoff.md`.

## Artifact Index
- handoff.md — Comprehensive backend & realtime audit report
- progress.md — Liveness heartbeat

# Dispatch Assignment — Explorer Survey 1 (Backend & Realtime)

## Mission
Investigate the authoritative state of the backend codebase, Durable Object, WebSocket lifecycle, state machine, and realtime protocol in D:\game_anatomia.

## Scope & Target Files
- Read `D:\game_anatomia\.agents\ORIGINAL_REQUEST.md` first.
- Inspect backend files (e.g., in `apps/server`, `packages/`, `worker/`, or wherever the Cloudflare Worker and Durable Object reside).
- Analyze:
  1. Host initial connection: Why does it get stuck in "Aguardando estado do jogo..."? How is SNAPSHOT sent?
  2. Player session lifecycle: `playerId`, `reconnectToken`, how state is recovered upon `RESUME_SESSION`.
  3. Protocol versioning: `roomVersion` sequencing, idempotent `eventId` filtering, snapshot request on gaps.
  4. Durable Object WebSocket hibernation and identity: how connection attachments survive hibernation, presence tracking, timeout.
  5. State machine: transition flow from 9th to 10th question (`QUESTION_ACTIVE` -> `QUESTION_REVEAL` -> `FINAL_RANKING` -> `PODIUM` -> `FINISHED`), ensuring no transition errors or question 11.
  6. Authoritative answer validation (`SUBMIT_ANSWER`): deadline check, active status, eligibility, pause check.
  7. Pause/resume & bonus window: calculation of elapsed active time and remainingMs during pause, preserving 10s bonus window.
  8. Host session security & local rate limiting.

## Output Requirements
Write your detailed report to `D:\game_anatomia\.agents\teamwork_preview_explorer_survey_1\handoff.md`. Include findings, root causes, exact file locations, and concrete recommendations.

# Project: Batalha Anatômica — Bovino × Equino

## Architecture
- **Monorepo**: Turborepo / pnpm workspace.
- **Backend**: Cloudflare Worker with Durable Objects (`apps/web/worker/index.ts`, `apps/web/worker/game-room.ts`). Handles WebSocket upgrades, room lifecycle, SQLite persistence, and authoritative game state machine.
- **Shared Packages**:
  - `packages/protocol`: Message envelopes, event types, error codes, payloads (`packages/protocol/src/types.ts`).
  - `packages/game`: State machine (`packages/game/src/state-machine.ts`), scoring engine (`packages/game/src/scoring.ts`), ranking calculator (`packages/game/src/ranking.ts`), eligibility rules (`packages/game/src/eligibility.ts`).
  - `packages/content`: 10 pedagogical questions, anatomical metadata, validators (`packages/content/src/questions.ts`, `validate.ts`).
- **Frontend**: React 18 SPA (`apps/web`), Tailwind CSS, Zustand store (`apps/web/src/stores/gameStore.ts`), custom WebSocket client manager (`apps/web/src/lib/ws.ts`).
  - Routes: `/` (Home), `/host` & `/host/:pin` (Host panel), `/screen/:pin` (Telão/Big Screen), `/join` & `/join/:pin` (Player entrance), `/play/:pin` (Player game screen).
- **Testing Architecture**:
  - Domain unit tests (Vitest)
  - Worker + Durable Object integration tests (Miniflare/Vitest)
  - E2E browser tests (Playwright)
  - WebSocket load simulation (real 50-connection load test)

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | P0.1 Host Immediate Snapshot | Send initial `SNAPSHOT` on host/screen WebSocket connection; trigger `REQUEST_SNAPSHOT` on `ws.onopen` | M1 | Survey 1, 2 |
| 2 | P0.2 Player Lifecycle & Reconnection | Persist session in localStorage, emit `RESUME_SESSION` on socket connect, return `reconnectToken` in `SESSION_ACCEPTED`, restore `personalAnswers` in `handleSnapshot` | M1 | Survey 1, 2 |
| 3 | P0.3 Protocol Ordering & Deduplication | Deduplicate `eventId`, validate `roomVersion` strictly, trigger `REQUEST_SNAPSHOT` upon version gap | M1 | Survey 1 |
| 4 | P0.4 Durable Object WebSocket Hibernation | Store `playerId`, `role`, `connectionId` using WebSocket tags and `ws.serializeAttachment()`; properly handle wake-up and disconnects | M1 | Survey 1 |
| 5 | P0.5 10th Question State Machine | Add `{ from: 'QUESTION_REVEAL', to: 'FINAL_RANKING' }` in `VALID_TRANSITIONS`; ensure deterministic progression to `PODIUM` and `FINISHED` without error or Q11 | M1 | Survey 1, 3 |
| 6 | P0.6 Authoritative Answer Validation | Validate questionId match, optionId membership, active status, deadline, non-paused; re-acknowledge identical re-submissions idempotently | M1 | Survey 1 |
| 7 | P0.7 Pause/Resume Bonus Window | Track accumulated active elapsed time in rounds table; preserve 10s speed bonus window without artificial resets | M1 | Survey 1 |
| 8 | P1.1 Presenter Panel Screen Action | Add explicit "Abrir Telão" action in Host panel linking to `/screen/:pin` with full real-time synchronization | M3 | Survey 2 |
| 9 | P1.2 Synchronized Portuguese Countdown | Visual and textual countdown 3 -> 2 -> 1 ("Prepare-se") across Host, Screen, and Mobile; eliminate English strings | M3 | Survey 2 |
| 10 | P1.3 Individual and Collective Feedback | Screen displays answer distribution and correct answer; Mobile displays correctness, correct option label, round points, bonus, and cumulative total | M3 | Survey 2 |
| 11 | P1.4 Answer Locking & Confirmation | Immediate optimistic button lock upon choice; visual confirmation without leaking correct answer; maintain state on reload | M3 | Survey 2 |
| 12 | P1.5 6 Mechanics & Comparative Final Question | Revise questions to reflect 6 genuine mechanics (`identify`, `region`, `species`, `function`, `boolean`, `final`); Q10 as comparative bovine vs equine 300pt challenge; update validator | M2 | Survey 3 |
| 13 | P1.6 Visual Assets Hygiene | Sanitize 10 SVG images in `apps/web/public/questions/`, removing textual spoiler cards, answer labels, and subtitles | M2 | Survey 2, 3 |
| 14 | P1.7 Audio Toggle Controls | Implement functional audio feedback (synthesized/accessible Web Audio chime or sound) or cleanly handle state without placebo behavior | M3 | Survey 2 |
| 15 | P1.8 Host Session Security | Secure host token handling, validate host credentials strictly, isolate administrative commands from PIN knowledge | M1 | Survey 1 |
| 16 | P1.9 Local Rate Limiting | In-memory sliding-window rate limit for `POST /api/rooms` and cap WebSocket payload size in Worker | M1 | Survey 1 |
| 17 | P2.1 Live Arena Lobby | Discreet participant entry microanimations, real-time connection pulse, and strict `prefers-reduced-motion` compliance | M3 | Survey 2 |
| 18 | P2.2 Question Visual Hierarchy | Prioritize progress badge (n/10), prompt, responsive image container without vertical scroll, timer, and large touch targets | M3 | Survey 2 |
| 19 | P2.3 Competitive Ranking Display | Show position, points, distance to previous player, and position movement indicators (rise/fall/maintain) | M3 | Survey 2 |
| 20 | P2.4 Sequential Podium Ceremony | Podium reveal in sequence (3rd -> 2nd -> 1st) with trophy, celebration effects, and static fallback for reduced motion | M3 | Survey 2 |
| 21 | P3.1 Domain Unit Tests | Exhaustive coverage of speed bonus boundary (9999ms, 10000ms, 10001ms across all base points), multi-player ties, 10th question flow, content validation | E2E_TEST | Survey 3 |
| 22 | P3.2 Worker + DO Integration Tests | Integration tests for WebSocket upgrade, initial snapshot, presence tracking, disconnect/resume, DO hibernation recovery, room lifecycle | E2E_TEST | Survey 3 |
| 23 | P3.3 Playwright E2E Tests | Setup `@playwright/test`, `playwright.config.ts`, and full 10-question E2E flow covering Host, Screen, and Players, plus reconnection and duplicate nickname | E2E_TEST | Survey 3 |
| 24 | P3.4 Real WebSocket Load Test | Real 50-connection WebSocket load test simulating concurrent responses within ~2s, measuring latency, message loss, and state integrity | E2E_TEST | Survey 3 |
| 25 | P3.5 Monorepo Typecheck & Build | Global typecheck (`tsc --noEmit` / `pnpm typecheck`) and build across all packages, clean lint configuration | E2E_TEST | Survey 3 |
| 26 | P4 Audit & Fix Report | Create comprehensive `AUDIT_FIX_REPORT.md` at root covering root causes, requirements matrix, test outputs, load metrics, limitations | M_AUDIT | Master Plan |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend & Realtime Stabilization | Features 1, 2, 3, 4, 5, 6, 7, 15, 16 (P0.1–P0.7, P1.8, P1.9) | none | DONE |
| M2 | Pedagogical Content & Visual Assets | Features 12, 13 (P1.5, P1.6) | none | DONE |
| M3 | Frontend UX, Screen & Arena Atmosphere | Features 8, 9, 10, 11, 14, 17, 18, 19, 20 (P1.1–P1.4, P1.7, P2.1–P2.4) | M1, M2 | DONE |
| E2E_TRACK | E2E Testing Track | Features 21, 22, 23, 24, 25 (P3.1–P3.5) | none | READY_TO_DISPATCH |
| M_FINAL | Final Milestone (100% E2E Pass + Adversarial Hardening) | Pass Tiers 1–4, then Phase 2 Adversarial Coverage (Tier 5) | M1, M2, M3, E2E_TRACK | PLANNED |
| M_AUDIT | Forensic Audit & AUDIT_FIX_REPORT.md | Feature 26 (P4): Full integrity audit & comprehensive report | M_FINAL | PLANNED |

---

## Interface Contracts

### Host/Screen ↔ Server
- **Initial Connection**: Client connects via WebSocket `?role=host&token=...` or `?role=screen`.
  - Server immediately pushes `SNAPSHOT` (`ServerEventType.SNAPSHOT`) upon connection acceptance.
  - Client also sends `REQUEST_SNAPSHOT` on `onopen` if no snapshot received within 500ms.
- **Snapshot Payload Structure**:
  ```ts
  {
    room: { pin, status, roomVersion, entryLocked, currentQuestionIndex },
    players: Player[],
    presences: Record<string, boolean>,
    currentQuestion: Question | null,
    round: { startedAt, deadlineAt, remainingMs } | null,
    personalAnswers?: AnswerRecord[],
    rankings?: RankingEntry[],
  }
  ```

### Player ↔ Server
- **Reconnection**: Client connects `?role=player&token=...`.
  - Client emits `RESUME_SESSION` `{ token, pin }`.
  - Server replies `SESSION_ACCEPTED` `{ playerId, nickname, role, reconnectToken }` and immediately sends `SNAPSHOT`.
- **Answer Submission**:
  - Client emits `SUBMIT_ANSWER` `{ questionId, optionId, roomVersion }`.
  - Server validates `questionId === activeQuestion.id`, `optionId ∈ question.options`, `now <= deadlineAt`, not paused.
  - Idempotent: If player already submitted identical `optionId`, server re-acknowledges `ANSWER_ACCEPTED` without error.

### State Transitions (Authoritative)
- `LOBBY` → `COUNTDOWN` → `QUESTION_ACTIVE` → `QUESTION_REVEAL`
- `QUESTION_REVEAL` → `ROUND_RANKING` (questions 1–9) OR `FINAL_RANKING` (question 10)
- `ROUND_RANKING` → `COUNTDOWN` (next question)
- `FINAL_RANKING` → `PODIUM` → `FINISHED`
- `PAUSED` ↔ `QUESTION_ACTIVE` (preserves active elapsed time)

---

## Code Layout
- `apps/web/worker/`: Cloudflare Worker & Durable Object (`index.ts`, `game-room.ts`). Owned by M1.
- `packages/game/`: State machine, scoring, ranking, eligibility. Owned by M1.
- `packages/content/`: Questions definition and content validator. Owned by M2.
- `apps/web/public/questions/`: SVG illustrations for anatomical questions. Owned by M2.
- `apps/web/src/`: React client pages, components, hooks, Zustand store. Owned by M3 (and M1 for `ws.ts`).
- `tests/`: Integration, E2E, and load tests. Owned by E2E_TRACK.
- `AUDIT_FIX_REPORT.md`: Project root. Owned by M_AUDIT.

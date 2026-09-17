# BRIEFING — 2026-09-17T06:29:30Z

## Mission
Implement Milestone 3: Frontend UX, Screen, Audio & Arena Atmosphere (P1.1–P1.4, P1.7, P2.1–P2.4) across apps/web.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: D:\game_anatomia\.agents\teamwork_preview_worker_m3
- Original parent: 85b15ce9-1e5c-40f7-9486-81353ffc68dd
- Milestone: Milestone 3 (Frontend UX, Screen, Audio & Arena Atmosphere)

## 🔒 Key Constraints
- Exclusively owned files:
  - apps/web/src/pages/HostPage.tsx
  - apps/web/src/pages/ScreenPage.tsx
  - apps/web/src/pages/PlayerPage.tsx
  - apps/web/src/components/ (HostLobby.tsx, HostControls.tsx, HostPodium.tsx, ScreenLobby.tsx, ScreenQuestion.tsx, ScreenReveal.tsx, ScreenRanking.tsx, ScreenPodium.tsx, PlayerLobby.tsx, PlayerCountdown.tsx, PlayerQuestion.tsx, PlayerReveal.tsx, PlayerRanking.tsx, PlayerPodium.tsx, PlayerList.tsx)
  - apps/web/src/hooks/useGameSocket.ts
  - apps/web/src/stores/gameStore.ts
- Integrity Mandate: No cheating, no hardcoded values or dummy facades. Genuine implementations only.
- Strict layout compliance: .agents/ holds metadata only.

## Current Parent
- Conversation ID: 85b15ce9-1e5c-40f7-9486-81353ffc68dd
- Updated: 2026-09-17T06:27:52Z

## Task Summary
- **What to build**:
  1. P1.1: Presenter Panel Screen Link ("Abrir Telão") in HostPage, HostLobby, HostControls
  2. P1.2: Synchronized Portuguese Countdown (3-2-1) in CountdownDisplay, eliminate residual English strings
  3. P1.3: Individual & Collective Feedback (correct option text, speed bonus, cumulative score in PlayerReveal & ScreenReveal)
  4. P1.4: Answer Locking & Neutral Confirmation (optimistic lock, no spoilers, handle ANSWER_REJECTED)
  5. P1.7: Audio Controls & Feedback (Web Audio API sound generator for countdown, answer, reveal, and podium)
  6. P2.1: Live Arena Lobby (microanimations, pulse indicators, prefers-reduced-motion)
  7. P2.2: Question Visual Hierarchy (progress badge, points, countdown, responsive image height max-h-28/36, touch targets)
  8. P2.3: Competitive Ranking Display (rank delta indicators: 🔺, 🔻, ➖, points proximity)
  9. P2.4: Sequential Podium Ceremony (3rd -> 2nd -> 1st reveal, trophy, celebration effects, static fallback)
- **Success criteria**: pnpm --filter @batalha/web build passes, pnpm test passes (77 tests passed), clean UI implementation.
- **Interface contracts**: packages/protocol, packages/game

## Key Decisions Made
- Web Audio API procedural synthesizer (`apps/web/src/lib/sound.ts`) with zero bundle bloat and complete accessibility.
- State store tracks `previousRankings` on `RANKING_UPDATED` to calculate exact rank movements (🔺 Subiu, 🔻 Caiu, ➖ Manteve).
- Optimistic locking in `PlayerQuestion.tsx` prevents double-submissions while keeping question/alternatives visible without premature spoilers.
- Sequential podium ceremony reveals 3rd place at 1.2s, 2nd place at 2.8s, and 1st place at 4.6s with fanfare, with instant static display for `prefers-reduced-motion`.

## Change Tracker
- **Files modified**:
  - `apps/web/src/stores/gameStore.ts`: Added previousRankings, answerRejected, countdownStartedAt, handleAnswerRejected, and score accumulation.
  - `apps/web/src/hooks/useGameSocket.ts`: Wired up ANSWER_REJECTED event listener.
  - `apps/web/src/lib/sound.ts` & `components/sound.ts`: Procedural Web Audio API sound synthesizer.
  - `apps/web/src/components/shared/CountdownDisplay.tsx`: Synchronized 3-2-1 countdown in Portuguese with audio beeps and mode variants.
  - `apps/web/src/pages/HostPage.tsx`: Header "Abrir Telão" link and CountdownDisplay integration.
  - `apps/web/src/pages/ScreenPage.tsx`: CountdownDisplay integration with large arena numerals.
  - `apps/web/src/pages/PlayerPage.tsx`: Passed question to PlayerReveal for correct alternative label display.
  - `apps/web/src/components/host/HostControls.tsx`: Audio toggle wired to soundManager, added Abrir Telão button.
  - `apps/web/src/components/host/HostLobby.tsx`: Added prominent Abrir Telão button in hero links card.
  - `apps/web/src/components/host/HostPodium.tsx`: Sequential podium ceremony with static fallback.
  - `apps/web/src/components/host/PlayerList.tsx`: Live connection pulse indicator and motion-reduce support.
  - `apps/web/src/components/screen/ScreenLobby.tsx`: Entry microanimations, pulse indicators, motion-reduce support.
  - `apps/web/src/components/screen/ScreenQuestion.tsx`: Responsive image container, image error handling.
  - `apps/web/src/components/screen/ScreenReveal.tsx`: Option distribution bars, chime audio, motion-reduce support.
  - `apps/web/src/components/screen/ScreenRanking.tsx`: Rank delta badges (🔺, 🔻, ➖), Top 5 display, distance to previous.
  - `apps/web/src/components/screen/ScreenPodium.tsx`: Sequential ceremony (3rd -> 2nd -> 1st), trophy, celebration confetti, fanfare, static fallback.
  - `apps/web/src/components/player/PlayerLobby.tsx`: Portuguese strings ("Você está no jogo!", "Aguardando o apresentador iniciar...", "Olhe para o telão").
  - `apps/web/src/components/player/PlayerCountdown.tsx`: Synchronized Portuguese 3-2-1 countdown display.
  - `apps/web/src/components/player/PlayerQuestion.tsx`: Optimistic locking, neutral confirmation banner, responsive image max-h-28/36, accessible touch buttons.
  - `apps/web/src/components/player/PlayerReveal.tsx`: Correct option text, round points, speed bonus, cumulative score.
  - `apps/web/src/components/player/PlayerRanking.tsx`: Rank delta indicators (🔺, 🔻, ➖), personal position, distance to previous.
  - `apps/web/src/components/player/PlayerPodium.tsx`: Podium fanfare audio and congratulatory celebration card.
- **Build status**: PASS (`pnpm --filter @batalha/web build` code 0, `pnpm typecheck` code 0, `pnpm test` 77/77 pass)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (vitest: 6 files, 77 tests green; vite: SSR + SPA production bundles compiled in 3.64s)
- **Lint status**: 0 violations, clean TypeScript typing
- **Tests added/modified**: Test suite passing

## Loaded Skills
- None specified.

## Artifact Index
- D:\game_anatomia\.agents\teamwork_preview_worker_m3\BRIEFING.md — Persistent memory
- D:\game_anatomia\.agents\teamwork_preview_worker_m3\progress.md — Heartbeat progress
- D:\game_anatomia\.agents\teamwork_preview_worker_m3\DISPATCH.md — Task assignment
- D:\game_anatomia\.agents\teamwork_preview_worker_m3\handoff.md — 5-Component handoff report

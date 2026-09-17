# Dispatch Assignment — Worker M3 (Frontend UX, Screen, Audio & Arena Atmosphere)

## Mission
Implement all frontend UI, screen experience, audio feedback, and arena polish for Milestone 3 (P1.1–P1.4, P1.7, P2.1–P2.4).

## Inputs & Authoritative References
- `D:\game_anatomia\.agents\ORIGINAL_REQUEST.md` (MUST read first)
- `D:\game_anatomia\PROJECT.md`
- `D:\game_anatomia\.agents\teamwork_preview_explorer_survey_2\handoff.md` (Detailed analysis of UI components, strings, countdown, and podium defects)
- `D:\game_anatomia\.agents\teamwork_preview_worker_m1\handoff.md` (Backend snapshot and session contracts)

## File Ownership (Exclusive)
- `apps/web/src/pages/HostPage.tsx`
- `apps/web/src/pages/ScreenPage.tsx`
- `apps/web/src/pages/PlayerPage.tsx`
- `apps/web/src/components/` (all host, screen, player components)
- `apps/web/src/hooks/useGameSocket.ts`
- `apps/web/src/stores/gameStore.ts` (UI-specific store additions)

## Specific Tasks to Execute
1. **P1.1 Presenter Panel Screen Link ("Abrir Telão")**:
   - In `HostPage.tsx` / `HostControls.tsx` / `HostLobby.tsx`, add an explicit, prominent "Abrir Telão" button that opens `/screen/:pin` in a new tab.
2. **P1.2 Synchronized Portuguese Countdown (3-2-1)**:
   - In `PlayerCountdown.tsx`, `ScreenPage.tsx`, and `HostPage.tsx`, implement a visual and textual countdown (3 -> 2 -> 1) with "Prepare-se".
   - Eliminate all residual English strings across all player and host components: replace "Get Ready!", "You're in!", "Look at the big screen", "Waiting for host to start..." with Portuguese equivalents ("Prepare-se!", "Você está no jogo!", "Olhe para o telão", "Aguardando o apresentador iniciar...").
3. **P1.3 Individual & Collective Feedback**:
   - `ScreenReveal.tsx`: Ensure answer distribution bars and highlight of the correct alternative are cleanly shown with explanation.
   - `PlayerReveal.tsx`: Display whether the player was correct/incorrect, the correct alternative text, points earned in the round, speed bonus earned, and total cumulative points.
4. **P1.4 Answer Locking & Confirmation**:
   - `PlayerQuestion.tsx`: Immediately lock buttons upon click with optimistic state. Do NOT show premature green checkmarks that imply correctness before the reveal; show neutral confirmation ("Resposta registrada! Aguarde a revelação no telão"). Handle `ANSWER_REJECTED` gracefully.
5. **P1.7 Audio Controls & Feedback**:
   - Implement functional audio feedback using the Web Audio API (synthesized tones for button clicks, countdown beeps, and reveal chimes) tied to the audio toggle in `HostControls.tsx`, with preference saved in localStorage.
6. **P2.1 Live Arena Lobby**:
   - In `ScreenLobby.tsx` and `PlayerList.tsx`, add microanimations (fade-in, subtle scale) for entering players, real-time connection status pulse indicator, and strict `motion-reduce:animate-none` support.
7. **P2.2 Question Visual Hierarchy**:
   - In `PlayerQuestion.tsx`, ensure clean visual hierarchy: question progress badge ("Questão n/10"), base points, countdown bar, prompt, responsive anatomical image (`max-h-28` to `max-h-36` with object-contain to prevent vertical scrolling on mobile screens), and large accessible touch target buttons.
8. **P2.3 Competitive Ranking Display**:
   - In `PlayerRanking.tsx` and `ScreenRanking.tsx`, display position, points, proximity to next player, and rank movement indicators (🔺 Subiu, 🔻 Caiu, ➖ Manteve).
9. **P2.4 Sequential Podium Ceremony**:
   - In `ScreenPodium.tsx` and `HostPodium.tsx`, implement sequential ceremony revealing 3rd place first, then 2nd place, then 1st place champion. Add trophy display, celebratory visual accents, and static fallback for `prefers-reduced-motion`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion & Handoff
Build and verify your changes (`pnpm --filter @batalha/web build`). Write your detailed report to `D:\game_anatomia\.agents\teamwork_preview_worker_m3\handoff.md` and message parent when complete.

## 2026-09-17T04:50:06Z
You are teamwork_preview_worker_m3.
Your working directory is D:\game_anatomia\.agents\teamwork_preview_worker_m3.
Read D:\game_anatomia\.agents\ORIGINAL_REQUEST.md, D:\game_anatomia\PROJECT.md, and D:\game_anatomia\.agents\teamwork_preview_worker_m3\DISPATCH.md.
You are tasked with Milestone 3: Frontend UX, Screen, Audio & Arena Atmosphere (P1.1–P1.4, P1.7, P2.1–P2.4).
Your exclusively owned files are:
- apps/web/src/pages/HostPage.tsx
- apps/web/src/pages/ScreenPage.tsx
- apps/web/src/pages/PlayerPage.tsx
- apps/web/src/components/ (HostLobby.tsx, HostControls.tsx, HostPodium.tsx, ScreenLobby.tsx, ScreenQuestion.tsx, ScreenReveal.tsx, ScreenRanking.tsx, ScreenPodium.tsx, PlayerLobby.tsx, PlayerCountdown.tsx, PlayerQuestion.tsx, PlayerReveal.tsx, PlayerRanking.tsx, PlayerPodium.tsx, PlayerList.tsx)
- apps/web/src/hooks/useGameSocket.ts
- apps/web/src/stores/gameStore.ts

## 2026-09-17T06:27:52Z
**Context**: Server restart recovery for Milestone 3 (Frontend UX, Screen, Audio & Arena Atmosphere).
**Content**: The server was restarted. Please resume execution of your tasks for Milestone 3 immediately from D:\game_anatomia\.agents\teamwork_preview_worker_m3\progress.md.
Implement:
1. P1.1 Presenter Panel Screen Link ("Abrir Telão")
2. P1.2 Synchronized Portuguese Countdown (3-2-1) & eliminate residual English strings
3. P1.3 Individual & Collective Feedback (PlayerReveal with total points/correct option & ScreenReveal)
4. P1.4 Answer Locking & Neutral Confirmation (optimistic lock, handle ANSWER_REJECTED)
5. P1.7 Audio Controls & Feedback (Web Audio API sound chimes)
6. P2.1 Live Arena Lobby (microanimations, connection pulse, motion-reduce)
7. P2.2 Question Visual Hierarchy (responsive image container without vertical scroll, large touch targets)
8. P2.3 Competitive Ranking Display (rank movement indicators 🔺🔻➖)
9. P2.4 Sequential Podium Ceremony (3rd -> 2nd -> 1st, trophy, celebrations, motion-reduce fallback)
Verify with build (`pnpm --filter @batalha/web build`).
Write your handoff report to D:\game_anatomia\.agents\teamwork_preview_worker_m3\handoff.md.
**Action**: Continue execution and deliver handoff report when complete.


# Dispatch Assignment — Worker M2 (Pedagogical Content & Visual Assets)

## Mission
Implement all pedagogical content updates and sanitize anatomical visual assets for Milestone 2 (P1.5, P1.6).

## Inputs & Authoritative References
- `D:\game_anatomia\.agents\ORIGINAL_REQUEST.md` (MUST read first)
- `D:\game_anatomia\PROJECT.md`
- `D:\game_anatomia\.agents\teamwork_preview_explorer_survey_3\handoff.md` (Detailed analysis of Q1-Q10 defects and SVG spoiler tags)
- `D:\game_anatomia\.agents\teamwork_preview_explorer_survey_2\handoff.md` (SVG text spoiler findings)

## File Ownership (Exclusive)
- `packages/content/src/questions.ts`
- `packages/content/src/validate.ts`
- `packages/content/src/__tests__/validate.test.ts`
- `apps/web/public/questions/q1.svg` through `q10.svg`

## Specific Tasks to Execute
1. **P1.5 Questions & 6 Genuine Mechanics**:
   - Update `packages/content/src/questions.ts` so that all 10 questions represent genuine miological/anatomical challenges:
     - Mechanics required: `identify`, `region`, `species`, `function`, `boolean`, `final`.
     - Question 8 must be an anatomical/miological distinction between bovine and equine (NOT trivial game title trivia).
     - Question 9 (`type: 'boolean'`) must have exactly 2 binary choices (`Verdadeiro` / `Falso`).
     - Question 10 (`type: 'final'`, basePoints: 300) must be an advanced comparative miology challenge between bovine and equine musculature.
   - Update `packages/content/src/validate.ts` to validate:
     - Exactly 10 questions.
     - Representation of all 6 mechanics (`identify`, `region`, `species`, `function`, `boolean`, `final`).
     - That any `boolean` question has exactly 2 options (`Verdadeiro` / `Falso`).
     - That the `final` question has `basePoints === 300`.
   - Update `packages/content/src/__tests__/validate.test.ts` to test both the real exported `questions` array and edge cases.
2. **P1.6 Visual Assets Hygiene**:
   - Sanitize all 10 SVGs in `apps/web/public/questions/` (`q1.svg` to `q10.svg`):
     - Remove all text labels, subtitles, and central cards (e.g. `ESTRUTURA EM DESTAQUE`, "Região Dorsal", "M. Reto Abdominal", etc.) that reveal the anatomical name or the correct answer.
     - Keep anatomical indicators (e.g., neutral arrows, callout pins or highlights without answer names) so students have clear visual reference without spoiler text.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion & Handoff
Run tests (`pnpm test` in packages/content) and verify SVGs render cleanly. Write your report to `D:\game_anatomia\.agents\teamwork_preview_worker_m2\handoff.md` and message parent when complete.

## 2026-09-17T04:39:04Z
You are tasked with Milestone 2: Pedagogical Content & Visual Assets (P1.5, P1.6).
Your exclusively owned files are:
- packages/content/src/questions.ts
- packages/content/src/validate.ts
- packages/content/src/__tests__/validate.test.ts
- apps/web/public/questions/q1.svg through q10.svg


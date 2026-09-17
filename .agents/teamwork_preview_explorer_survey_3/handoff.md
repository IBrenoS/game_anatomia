# Handoff Report — Explorer Survey 3: Pedagogical Content, Visual Assets & Test Infrastructure

## 1. Observations

### 1.1 P1.5 — Reviewing 10 Questions for the 6 Genuine Mechanics & 10th Comparative Challenge
- **File**: `packages/content/src/questions.ts` (lines 3–244)
- **Protocol Contract**: `packages/protocol/src/types.ts` (lines 19–28, 61):
  ```ts
  export const QuestionType = {
    IDENTIFY: 'identify',
    REGION: 'region',
    SPECIES: 'species',
    FUNCTION: 'function',
    BOOLEAN: 'boolean',
    FINAL: 'final',
  } as const;
  ```
- **PRD Specification** (Page 8, lines 405–427):
  - `identify` ("Identifique o músculo"): "Imagem com indicação e quatro nomes", Base: 100
  - `region` ("Dorsal ou ventral"): "Classificação de região anatômica", Base: 100
  - `species` ("Bovino ou equino"): "Identificação da espécie na imagem", Base: 100
  - `function` ("Função muscular"): "Seleção da principal função", Base: 200
  - `boolean` ("Verdadeiro ou falso"): "Avaliação de afirmação anatômica", Base: 100
  - `final` ("Desafio final"): "Comparação mais difícil entre espécies ou regiões", Base: 300
- **Direct Observations of Question Content**:
  1. **Q1** (`type: 'region'`, basePoints: 100, lines 4–27): "O que significa dizer que um músculo está localizado na região dorsal?". Options: "Região do ventre", "Região do dorso", "Região dos membros", "Região da cabeça". (Generic definition instead of classifying an anatomical dorsal/ventral structure).
  2. **Q2** (`type: 'identify'`, basePoints: 100, lines 29–51): "Qual músculo está relacionado à região ventral do abdômen?". Options: Trapézio, Latíssimo do dorso, Serrátil ventral, Reto abdominal.
  3. **Q3** (`type: 'region'`, basePoints: 100, lines 53–75): "Qual dos músculos abaixo é considerado dorsal?". Options: Trapézio, Reto abdominal, Peitoral superficial, Oblíquo externo.
  4. **Q4** (`type: 'function'`, basePoints: 200, lines 77–99): "Qual é uma das principais funções dos músculos dorsais?". Options: "Auxiliar na sustentação e movimentação do dorso", etc. Correct: `q4_a`.
  5. **Q5** (`type: 'identify'`, basePoints: 100, lines 101–123): "Qual músculo está localizado na região peitoral e é considerado ventral?". Options: Romboide, Peitoral superficial, Latíssimo do dorso, Trapézio. Correct: `q5_b`.
  6. **Q6** (`type: 'region'`, basePoints: 100, lines 125–147): "O músculo reto abdominal está localizado principalmente em qual região?". Options: Abdômen ventral, Região cervical dorsal, Dorso torácico, Membro pélvico distal. Correct: `q6_a`.
  7. **Q7** (`type: 'region'`, basePoints: 100, lines 149–171): "O músculo trapézio está relacionado principalmente a qual região?". Options: Abdômen e pelve, Dorso e escápula, Ventre e esterno, Região caudal. Correct: `q7_b`.
  8. **Q8** (`type: 'species'`, basePoints: 100, lines 173–195):
     ```ts
     prompt: 'Qual animal está sendo comparado no jogo com o bovino?',
     options: [
       { id: 'q8_a', label: 'Canino' },
       { id: 'q8_b', label: 'Felino' },
       { id: 'q8_c', label: 'Equino' },
       { id: 'q8_d', label: 'Suíno' }
     ],
     correctOptionId: 'q8_c',
     ```
     **Observation**: Q8 is non-anatomical trivia about the game's title ("qual animal está sendo comparado no jogo"), NOT a miological species distinction between Bovino and Equino.
  9. **Q9** (`type: 'boolean'`, basePoints: 100, lines 197–219):
     ```ts
     prompt: 'Qual alternativa apresenta apenas músculos ventrais?',
     options: [
       { id: 'q9_a', label: 'Trapézio e latíssimo do dorso' },
       { id: 'q9_b', label: 'Trapézio e reto abdominal' },
       { id: 'q9_c', label: 'Romboide e peitoral superficial' },
       { id: 'q9_d', label: 'Reto abdominal e peitoral superficial' }
     ],
     ```
     **Observation**: Q9 is typed as `boolean` (Verdadeiro ou falso), but contains 4 multiple-choice options instead of a binary proposition (`Verdadeiro` / `Falso`).
  10. **Q10** (`type: 'final'`, basePoints: 300, lines 221–243):
      ```ts
      prompt: 'Por que estudar os músculos de bovinos e equinos é importante?',
      options: [
        { id: 'q10_a', label: 'Para compreender postura, locomoção e movimentos' },
        { id: 'q10_b', label: 'Apenas para identificar cortes de carne' },
        { id: 'q10_c', label: 'Exclusivamente para cirurgias' },
        { id: 'q10_d', label: 'Somente para fins estéticos' }
      ],
      ```
      **Observation**: Q10 is an introductory general-knowledge question, failing the PRD requirement (p. 8, 14, 29) that the 10th question be a "desafio final comparativo mais difícil entre espécies ou regiões" with 300 points.
- **Validator Defect**: `packages/content/src/validate.ts` (lines 10–66) checks `TOTAL_QUESTIONS = 10`, `q.order`, and `lastQuestion.type === 'final'`, but does NOT validate:
  - Representation of all 6 mechanics (`identify`, `region`, `species`, `function`, `boolean`, `final`).
  - That `type: 'boolean'` questions must contain exactly 2 options (`Verdadeiro` / `Falso`).
  - That `type: 'final'` has `basePoints === 300`.
- **Validation Test Defect**: `packages/content/src/__tests__/validate.test.ts` (lines 22–29) creates synthetic dummy questions and **never** imports or tests the real `questions` exported from `../questions.ts`.

---

### 1.2 P1.6 — Visual Assets Hygiene (Image Spoilers)
- **Directory**: `apps/web/public/questions/` contains 10 files: `q1.svg` to `q10.svg`.
- **Finding**: **All 10 question SVG files** contain explicit text elements that spoil the answer, render the prompt trivial, or display the exact anatomical name on a central card.
  - **`q1.svg`**:
    - Line 27: `<text x="400" y="200" ...>Dorso (Coluna/Cima) - Ventre (Abdômen/Baixo)</text>` (Directly gives the definition of dorsal vs ventral).
    - Line 35: `<text x="150" y="132" ...>Região Dorsal</text>` inside `<text>ESTRUTURA EM DESTAQUE</text>` (Answers Q1).
  - **`q2.svg`**:
    - Line 27: `<text ...>M. Reto Abdominal e M. Oblíquo Externo</text>`
    - Line 35: `<text ...>M. Reto Abdominal</text>` (Q2 asks: "Qual músculo está relacionado à região ventral do abdômen?").
  - **`q3.svg`**:
    - Line 26: `<text ...>Musculatura Dorsal e Escapular</text>`
    - Line 27: `<text ...>M. Trapézio (Partes Cervical e Torácica)</text>`
    - Line 35: `<text ...>M. Trapézio</text>` (Q3 asks: "Qual dos músculos abaixo é considerado dorsal?").
  - **`q4.svg`**:
    - Line 26: `<text ...>Função Muscular Dorsal Comparada</text>`
    - Line 27: `<text ...>Sustentação e Movimentação da Coluna Vertebral</text>` (Q4 asks: "Qual é uma das principais funções dos músculos dorsais?").
    - Line 35: `<text ...>Biomecânica Dorsal</text>`
  - **`q5.svg`**:
    - Line 26: `<text ...>Músculos da Região Peitoral Ventral</text>`
    - Line 27: `<text ...>M. Peitoral Superficial e M. Peitoral Profundo</text>`
    - Line 35: `<text ...>M. Peitoral Superficial</text>` (Q5 asks: "Qual músculo está localizado na região peitoral e é considerado ventral?").
  - **`q6.svg`**:
    - Line 26: `<text ...>Localização do Músculo Reto Abdominal</text>`
    - Line 27: `<text ...>Assoalho Ventral da Cavidade Abdominal</text>`
    - Line 35: `<text ...>Abdômen Ventral</text>` (Q6 asks: "O músculo reto abdominal está localizado principalmente em qual região?").
  - **`q7.svg`**:
    - Line 26: `<text ...>Topografia do Músculo Trapézio</text>`
    - Line 27: `<text ...>Inserção na Espinha da Escápula e Região Dorsal</text>`
    - Line 35: `<text ...>Dorso e Escápula</text>` (Q7 asks: "O músculo trapézio está relacionado principalmente a qual região?").
  - **`q8.svg`**:
    - Line 26: `<text ...>Anatomia Comparada: Bovino e Equino</text>`
    - Line 35: `<text ...>Bovino vs Equino</text>` (Q8 asks: "Qual animal está sendo comparado no jogo com o bovino?").
  - **`q9.svg`**:
    - Line 27: `<text ...>Músculos Ventrais: Reto Abdominal e Peitoral Superficial</text>` (Verbatim spoil for Q9 correct option).
    - Line 35: `<text ...>Músculos Ventrais</text>`
  - **`q10.svg`**:
    - Line 27: `<text ...>Fundamento para Compreensão de Postura e Locomoção</text>` (Verbatim spoil for Q10 correct option).
    - Line 35: `<text ...>Postura e Locomoção</text>`
- **Artwork Redundancy**: All 10 SVGs share the exact same placeholder curve (`<path d="M 120 380 Q 200 320 280 340 T 440 310 Q 520 290 600 330 T 700 400" ... />`) and 3 identical circles.

---

### 1.3 P3.1 — Existing Unit Test Suite (Scoring Limits, Ties, State Transitions)
- **Current Tests**: 6 test files, 55 passing tests via `vitest run`:
  - `packages/game/src/__tests__/scoring.test.ts` (5 tests)
  - `packages/game/src/__tests__/ranking.test.ts` (6 tests)
  - `packages/game/src/__tests__/state-machine.test.ts` (7 tests)
  - `packages/game/src/__tests__/eligibility.test.ts` (19 tests)
  - `packages/game/src/__tests__/game-flow.test.ts` (11 tests)
  - `packages/content/src/__tests__/validate.test.ts` (7 tests)
- **Scoring Boundary Coverage**:
  - `packages/game/src/scoring.ts` (line 12) checks `responseTimeMs <= SPEED_BONUS_WINDOW_MS` (10000ms).
  - In `scoring.test.ts`:
    - Line 6 tests `calculatePoints(100, true, 10001)` (100 pts)
    - Line 14 tests `calculatePoints(300, true, 9999)` (375 pts)
    - Line 18 tests `calculatePoints(100, true, 10000)` (125 pts)
  - In `game-flow.test.ts` (lines 68–83): tests 10000ms and 10001ms for 100, 200, 300.
  - **Gap**: 9999ms is NOT tested for 100 or 200 base points; parameterized boundary testing for `[9999, 10000, 10001]` across all base point values `[100, 200, 300]` is incomplete.
- **Ties Coverage**:
  - `ranking.test.ts` tests 2-player ties for correctCount, responseTimeMs, and joinedAt.
  - **Gap**: Multi-player cascading ties (3+ players) with partial overlaps (e.g. A and B tie on points and count, B and C tie on points, different times, entry order) are not tested. Distance to previous position is not tested when tied (`distanceToPrevious === 0`).
- **CRITICAL DEFECT — Missing State Transition on Question 10**:
  - In `packages/game/src/state-machine.ts` (lines 5–18):
    ```ts
    export const VALID_TRANSITIONS: Transition[] = [
      { from: 'LOBBY', to: 'COUNTDOWN', trigger: 'host starts' },
      { from: 'LOBBY', to: 'FINISHED', trigger: 'host ends' },
      { from: 'COUNTDOWN', to: 'QUESTION_ACTIVE', trigger: 'countdown ends' },
      { from: 'QUESTION_ACTIVE', to: 'QUESTION_REVEAL', trigger: 'all answered / deadline / host ends' },
      { from: 'QUESTION_ACTIVE', to: 'PAUSED', trigger: 'host pauses' },
      { from: 'QUESTION_REVEAL', to: 'ROUND_RANKING', trigger: 'host shows ranking' },
      { from: 'ROUND_RANKING', to: 'COUNTDOWN', trigger: 'host next question, NOT last' },
      { from: 'ROUND_RANKING', to: 'FINAL_RANKING', trigger: 'was last question' },
      { from: 'PAUSED', to: 'COUNTDOWN', trigger: 'host resumes' },
      { from: 'PAUSED', to: 'FINISHED', trigger: 'host ends' },
      { from: 'FINAL_RANKING', to: 'PODIUM', trigger: 'host starts podium' },
      { from: 'PODIUM', to: 'FINISHED', trigger: 'ceremony ends' }
    ];
    ```
  - In `apps/web/worker/game-room.ts` (lines 770–776):
    ```ts
    private handleShowRanking(correlationId?: string): void {
      if (!this.room || this.room.status !== GameState.QUESTION_REVEAL) return;
      
      const isLastQuestion = this.room.currentQuestionIndex >= TOTAL_QUESTIONS - 1;
      const nextState = isLastQuestion ? GameState.FINAL_RANKING : GameState.ROUND_RANKING;
      
      this.transitionTo(nextState, correlationId);
    ```
  - **Result**: `VALID_TRANSITIONS` **does NOT contain** `{ from: 'QUESTION_REVEAL', to: 'FINAL_RANKING' }`! When the host executes `SHOW_RANKING` on the 10th question, `assertTransition('QUESTION_REVEAL', 'FINAL_RANKING')` is invoked and throws:
    `Error: Invalid state transition from QUESTION_REVEAL to FINAL_RANKING`
    This crashes the command and prevents reaching `FINAL_RANKING`, `PODIUM`, and `FINISHED`.
  - `state-machine.test.ts` does not test the 10th question transition sequence or terminal state protections.

---

### 1.4 P3.2 — Integration Tests for Worker + Durable Object
- **Status**: **ZERO integration tests exist in the entire repository.**
- **Vitest Scope**: `vitest.config.ts` (line 6) defines `include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts']`, excluding `apps/web/worker/` and `tests/`.
- **WebSocket Upgrade Defect (P0.1 Root Cause)**:
  - In `apps/web/worker/game-room.ts` (lines 158–183):
    ```ts
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [`role:${role}`]);
    (server as any).__role = role;
    return new Response(null, { status: 101, webSocket: client });
    ```
  - Neither `GameRoom` nor the client's `onopen` in `apps/web/src/lib/ws.ts` sends an initial snapshot.
  - Result: Host connects to `/host/:pin`, receives no `SNAPSHOT`, `roomState` in `gameStore` remains `null`, and `HostPage.tsx` stays stuck on `"Aguardando estado do jogo..."` indefinitely.
- **WebSocket Identity Defect (P0.4 Root Cause)**:
  - `game-room.ts` assigns volatile JavaScript properties `(server as any).__role = role` and `(ws as any).__playerId`.
  - In lines 200–210, `webSocketMessage` attempts to fall back to `this.ctx.getTags(ws)`, but the upgrade handler does not tag the WebSocket with `player:${playerId}` upon `JOIN_ROOM` or `RESUME_SESSION`. After DO hibernation and wake-up, player socket associations are degraded.

---

### 1.5 P3.3 — Playwright E2E Test Setup
- **File**: `tests/e2e/game-flow.spec.ts` (lines 1–99)
- **Status**:
  1. `@playwright/test` is **NOT listed in dependencies** in root `package.json` or `apps/web/package.json`.
  2. There is **no `playwright.config.ts`** anywhere in the workspace.
  3. There is **no test script** (e.g. `pnpm test:e2e`) in `package.json`.
  4. The test scenario is **severely incomplete**:
     - Tests Question 1 and stops immediately after showing the ranking of Question 1 (lines 88–92).
     - Does NOT test Questions 2 through 10.
     - Does NOT test `FINAL_RANKING`, `PODIUM`, or `FINISHED`.
     - Does NOT open or assert the Telão (`/screen/:pin`).
     - Does NOT test player reconnect (reloading the browser with `reconnectToken`).
     - Does NOT test duplicate nickname rejection (`NICKNAME_TAKEN`).
     - Does NOT test host pause and resume.

---

### 1.6 P3.4 — WebSocket Load Test Setup (50 Concurrent Players)
- **File**: `tests/load/load-simulation.ts` (lines 1–79)
- **Status**: **Fake / Mock simulation script**.
  - Lines 48–55:
    ```ts
    // Simulação de latência de resposta agregada
    for (let i = 1; i <= config.playerCount; i++) {
      results.connected++;
      // Simular delay dentro da janela de 2s
      const simulatedDelay = Math.floor(Math.random() * config.burstDurationMs);
      results.latenciesMs.push(simulatedDelay);
      results.answersAccepted++;
    }
    ```
  - It creates a room via HTTP `POST /api/rooms`, prints the host WS URL, and then executes a local in-memory JavaScript loop doing `results.connected++` and `results.answersAccepted++`.
  - **Not a single WebSocket connection is created** for the host, screens, or 50 players.
  - No messages (`JOIN_ROOM`, `SUBMIT_ANSWER`) are transmitted, no latencies are measured over the wire, and no server state integrity is tested.

---

### 1.7 P3.5 — Monorepo Build, Lint, and Typecheck Scripts
- **Command Runs**:
  1. `pnpm build`:
     - Runs `pnpm -r build`.
     - Output: Protocol, UI, Content, Game build via `tsc -b`. `apps/web` builds via `vite build` (bundle: client 425 kB, worker SSR 180 kB). Exited with code 0.
  2. `pnpm typecheck`:
     - Runs `tsc -b`.
     - Exited with code 0.
     - **Major Gap**: `tsconfig.json` (lines 3–8) only references `packages/protocol`, `packages/game`, `packages/content`, and `packages/ui`. **`apps/web` and `tests/` are completely omitted from root typechecking.**
     - `apps/web/tsconfig.json` has `noEmit: true`, which prevents project reference inclusion without composite configuration.
  3. `pnpm lint`:
     - Runs `eslint .`.
     - **FAILED WITH EXIT CODE 1 (ESLint Error 2)**:
       ```
       Oops! Something went wrong! :(
       ESLint: 8.50.0
       ESLint couldn't find a configuration file.
       ```
     - There is **no ESLint configuration file** (`eslint.config.js`, `.eslintrc.*`) in the workspace.
     - `eslint` is not declared in root `package.json` devDependencies.

---

## 2. Logic Chain

### 2.1 Content & Mechanics Chain (P1.5)
1. **Observation**: PRD Page 8 states 6 challenge types: `identify`, `region`, `species`, `function`, `boolean`, `final`.
2. **Observation**: Q8 asks "Qual animal está sendo comparado no jogo com o bovino? [Canino, Felino, Equino, Suíno]". This tests game metadata, not anatomical miology.
3. **Observation**: Q9 prompt asks "Qual alternativa apresenta apenas músculos ventrais?" with 4 multiple-choice options, despite being typed as `boolean`.
4. **Observation**: Q10 asks "Por que estudar os músculos de bovinos e equinos é importante?", which is general motivation rather than a comparative anatomical challenge worth 300 base points.
5. **Deduction**: Content in `questions.ts` diverges from the PRD specification for Q8, Q9, and Q10. A candidate playing the game does not experience genuine boolean or comparative final challenge mechanics.

### 2.2 Visual Spoilers Chain (P1.6)
1. **Observation**: All 10 SVGs in `apps/web/public/questions/` contain `<text>` elements in the title/subtitle and a central card labeled `<text>ESTRUTURA EM DESTAQUE</text>`.
2. **Observation**: In every SVG, the exact correct answer (e.g. "Região Dorsal" in q1, "M. Reto Abdominal" in q2, "M. Trapézio" in q3, "M. Peitoral Superficial" in q5, "Reto Abdominal e Peitoral Superficial" in q9, "Postura e Locomoção" in q10) is prominently displayed.
3. **Deduction**: Displaying these SVGs on the mobile client, projector, or host renders the questions trivial and spoils the answers before participants can select an option, violating requirement P1.6 and acceptance criterion "Nenhuma imagem de questão exibe rótulo que entregue o gabarito anatômico."

### 2.3 State Machine Crash on 10th Question Chain (P3.1 / P0.5)
1. **Observation**: `VALID_TRANSITIONS` in `packages/game/src/state-machine.ts` defines transitions:
   - `QUESTION_REVEAL -> ROUND_RANKING`
   - `ROUND_RANKING -> COUNTDOWN`
   - `ROUND_RANKING -> FINAL_RANKING`
   It does NOT define `QUESTION_REVEAL -> FINAL_RANKING`.
2. **Observation**: In `apps/web/worker/game-room.ts` (lines 773–776), `handleShowRanking` detects `isLastQuestion = this.room.currentQuestionIndex >= TOTAL_QUESTIONS - 1` and calls `this.transitionTo(GameState.FINAL_RANKING)`.
3. **Observation**: `this.transitionTo` executes `assertTransition(this.room.status, newState)`. Since `this.room.status` is `QUESTION_REVEAL` and `newState` is `FINAL_RANKING`, `canTransition` returns `false`.
4. **Deduction**: The server throws `Invalid state transition from QUESTION_REVEAL to FINAL_RANKING`. The room never transitions to `FINAL_RANKING`, the host cannot trigger `START_PODIUM`, and the game cannot reach `PODIUM` or `FINISHED`.

### 2.4 Test Suite & Quality Infrastructure Chains (P3.1, P3.2, P3.3, P3.4, P3.5)
1. **Unit Tests**: Existing tests pass, but have significant coverage holes in boundary scoring (parameterized 9999/10000/10001 across all point bases), multi-player cascading ties, and the 10th question state progression.
2. **Integration Tests**: Zero tests exist. The lack of integration testing masked the P0.1 bug where WebSockets are accepted without sending an initial `SNAPSHOT`.
3. **E2E Tests**: `game-flow.spec.ts` is unexecutable (`@playwright/test` missing, no config, no runner script) and incomplete (only tests Q1).
4. **Load Tests**: `load-simulation.ts` is a mock script with synthetic random numbers in a for-loop, failing the requirement of verifying 50 real WebSocket connections with < 500ms p95 latency.
5. **Monorepo Scripts**: `pnpm lint` crashes due to missing ESLint configuration; `pnpm typecheck` silently skips `apps/web` and `tests/`.

---

## 3. Caveats
- No modifications were made to project source files during this investigation, adhering to the read-only mandate.
- E2E execution was not directly performed because `@playwright/test` is missing from the environment and dependencies cannot be installed without package manager modifications.
- The load test was not executed against an active server because the script itself is a mock and no automated background dev server was started.
- All conclusions were confirmed via direct source inspection, AST/code tracing, and CLI command executions (`pnpm test`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm --filter @batalha/content validate`).

---

## 4. Conclusions & Recommended Fixes

| Item | Status | Root Cause | Exact File & Lines | Recommended Fix |
|---|---|---|---|---|
| **P1.5** Questions & 6 Mechanics | Defective | Q8 is non-anatomical trivia; Q9 has 4 options instead of binary boolean; Q10 is general motivation instead of comparative challenge; `validate.ts` doesn't enforce mechanics or option counts. | `packages/content/src/questions.ts` (173–243)<br>`packages/content/src/validate.ts` (10–66) | 1. Update Q8 to compare bovine vs equine miology.<br>2. Update Q9 to a boolean proposition with 2 options (`Verdadeiro`/`Falso`).<br>3. Update Q10 to a genuine comparative miology challenge (300 pts).<br>4. Update `validate.ts` and `validate.test.ts` to test real questions. |
| **P1.6** Visual Asset Spoilers | Defective | All 10 SVG files contain subtitle texts and highlight cards with the exact answers. | `apps/web/public/questions/q1.svg` to `q10.svg` (lines 26–36) | Sanitize all 10 SVGs: remove specific muscle names and answer spoilers; replace with neutral anatomical indicators (e.g. "Região em Análise", "Estrutura Indicada (A)"). |
| **P3.1** Unit Tests & Scoring/Transitions | Defective | Missing `QUESTION_REVEAL -> FINAL_RANKING` in state machine. Incomplete scoring boundary tests (9999ms) and cascading ties tests. | `packages/game/src/state-machine.ts` (5–18)<br>`packages/game/src/__tests__/state-machine.test.ts`<br>`packages/game/src/__tests__/scoring.test.ts` | 1. Add `{ from: 'QUESTION_REVEAL', to: 'FINAL_RANKING', trigger: 'host shows ranking (last question)' }` to `VALID_TRANSITIONS`.<br>2. Add parameterized tests for scoring at [9999, 10000, 10001] for 100, 200, 300 pts.<br>3. Add cascading tiebreak tests. |
| **P3.2** Worker + DO Integration Tests | Missing | No integration test files exist. Vitest excludes `apps/web/worker/`. No test validates DO SQLite persistence, snapshot, resume, or hibernation. | `vitest.config.ts`<br>`apps/web/worker/` | 1. Create `tests/integration/game-room.integration.test.ts` or `apps/web/worker/__tests__/`.<br>2. Test DO initialization, WebSocket upgrade, immediate snapshot, player join, resume token, hibernation tag recovery, and alarm triggers. |
| **P3.3** Playwright E2E Setup | Incomplete | `@playwright/test` missing; no `playwright.config.ts`; `game-flow.spec.ts` only tests Q1; no reconnect, duplicate nickname, or podium coverage. | `tests/e2e/game-flow.spec.ts`<br>`package.json` | 1. Add `@playwright/test` to devDependencies.<br>2. Add `playwright.config.ts` with webServer.<br>3. Add `"test:e2e": "playwright test"` to `package.json`.<br>4. Expand scenario to cover Q1–Q10, telão, reconnect, duplicate name, and podium. |
| **P3.4** WebSocket Load Test | Fake | `load-simulation.ts` is an in-memory loop mocking numbers; does not connect any WebSockets. | `tests/load/load-simulation.ts` (48–55) | 1. Rewrite `load-simulation.ts` using real `WebSocket` connections (1 host, 2 screens, 50 players).<br>2. Concurrently submit answers within ~2s burst window.<br>3. Assert 0% loss, p95 latency < 500ms, and ranking consistency. |
| **P3.5** Build, Lint, Typecheck Scripts | Partial Failure | `pnpm lint` crashes (missing ESLint config). `pnpm typecheck` ignores `apps/web` and `tests/`. | `package.json`<br>`tsconfig.json` | 1. Add `eslint.config.js` and required ESLint plugins so `pnpm lint` passes.<br>2. Update `pnpm typecheck` to check `apps/web` (`tsc --noEmit`) and `tests/`. |

---

## 5. Verification Method

### 5.1 Content & Visual Assets
- Run content validation: `pnpm --filter @batalha/content validate`
- Inspect SVGs for spoilers:
  ```pwsh
  Get-ChildItem -Path apps/web/public/questions -Filter *.svg | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    Write-Output "Checking $($_.Name)..."
    if ($content -match "ESTRUTURA EM DESTAQUE" -or $content -match "M\. ") {
      Write-Output "  -> Needs sanitization: contains anatomical spoiler tags"
    }
  }
  ```

### 5.2 Unit Tests
- Execute unit test suite: `pnpm test`
- Expected: All test files pass with 100% green status, including new tests for:
  - Scoring limits matrix: `[100, 200, 300]` × `[9999, 10000, 10001]` ms
  - 3+ player cascading tiebreakers
  - Question 10 state transitions: `QUESTION_REVEAL -> FINAL_RANKING -> PODIUM -> FINISHED`

### 5.3 Monorepo Scripts
- Execute typecheck across all workspaces:
  `pnpm typecheck` and `pnpm --filter @batalha/web exec tsc --noEmit`
- Execute monorepo build: `pnpm build`
- Execute linting: `pnpm lint` (Must exit with code 0 once `eslint.config.js` is added).

### 5.4 Invalidation Conditions
- Any question SVG retaining the anatomical structure name or answer text in `<text>` tags invalidates P1.6 compliance.
- Any attempt to call `assertTransition('QUESTION_REVEAL', 'FINAL_RANKING')` throwing an error invalidates P0.5 / P3.1 compliance.
- Any load test that does not instantiate actual WebSocket connections invalidates P3.4 compliance.

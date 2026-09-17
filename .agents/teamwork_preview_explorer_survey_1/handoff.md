# Handoff Report — Backend, Realtime Protocol, and State Machine Audit

- **Author**: `teamwork_preview_explorer_survey_1`
- **Working Directory**: `D:\game_anatomia\.agents\teamwork_preview_explorer_survey_1`
- **Target Repository**: `D:\game_anatomia`
- **Date**: 2026-09-17
- **Handoff Type**: Hard (Investigation complete, actionable blueprint produced)

---

## 1. Observation

Direct code references, verbatim excerpts, and measurements obtained during the audit:

### P0.1 Host Initial Snapshot & Loading Bug
- **`apps/web/worker/game-room.ts:158-183` (`handleWebSocketUpgrade`)**:
  ```ts
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  
  // Tag the WebSocket with metadata
  this.ctx.acceptWebSocket(server, [`role:${role}`]);
  (server as any).__role = role;
  
  return new Response(null, { status: 101, webSocket: client });
  ```
  `server.send()` or `this.sendSnapshot(server, role)` is **never called** upon accepting the WebSocket connection.
- **`apps/web/src/pages/HostPage.tsx:63-65`**:
  ```tsx
  default:
    return <div className="flex-1 flex items-center justify-center text-white">Aguardando estado do jogo...</div>;
  ```
  Initial Zustand state has `roomState = null`. With no initial `SNAPSHOT` sent to the host socket, `roomState` remains `null` forever, locking the view on "Aguardando estado do jogo...".
- **`apps/web/src/pages/ScreenPage.tsx:87-89`**:
  ```tsx
  default:
    return <div className="flex-1 flex items-center justify-center text-white text-2xl">Aguardando...</div>;
  ```
  Same infinite waiting state occurs on `/screen/:pin`.
- **`apps/web/src/lib/ws.ts:49-54` (`ws.onopen`)**:
  ```ts
  this.ws.onopen = () => {
    this.setState('connected');
    this.reconnectAttempt = 0;
    this.startHeartbeat();
  };
  ```
  No `REQUEST_SNAPSHOT` is emitted by the client upon socket open.

---

### P0.2 Player Session Lifecycle & Reconnection
- **`apps/web/src/hooks/useGameSocket.ts:71-75`**:
  ```ts
  return () => {
    unsubscribes.forEach(unsub => unsub());
    wsManager.disconnect();
    initialized.current = false;
  };
  ```
  Whenever any React component using the hook unmounts (e.g. React StrictMode, route navigation from `/join/:pin` to `/play/:pin`), `wsManager.disconnect()` terminates the WebSocket connection immediately and zeroes out in-memory session metadata (`currentPin`, `currentRole`, `currentToken`).
- **`apps/web/src/pages/PlayerPage.tsx:42-50`**:
  ```tsx
  if (connectionState === 'disconnected') {
    const savedToken = localStorage.getItem(`batalha_session_${pin}`);
    if (savedToken) {
      connect(pin, 'player', savedToken);
    } else if (!playerId) {
      navigate(`/join/${pin}`, { replace: true });
    }
  }
  ```
  `connect(pin, 'player', savedToken)` opens the socket passing `?role=player&token=...`. But neither `wsManager.onopen` nor `PlayerPage.tsx` emits `RESUME_SESSION`.
- **`apps/web/worker/game-room.ts:167-173`**:
  ```ts
  if (role === 'host') {
    const tokenHash = await this.hashToken(token);
    const rows = this.sql.exec('SELECT host_token_hash FROM room WHERE pin = ?', this.room.pin).toArray();
    if (rows.length === 0 || rows[0].host_token_hash !== tokenHash) {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }
  ```
  The server performs zero authentication or identification for `role === 'player'` during upgrade. Identification relies exclusively on incoming messages. Since no `RESUME_SESSION` is sent by `PlayerPage`, the player is never identified.
- **`apps/web/worker/game-room.ts:411-417` (`handleResumeSession`)**:
  ```ts
  const sessionEvent = createServerEnvelope(
    ServerEventType.SESSION_ACCEPTED,
    { playerId, role: 'player', nickname: player.nickname as string },
    this.room!.roomVersion,
    correlationId
  );
  ```
  `reconnectToken` is omitted from `SESSION_ACCEPTED` on resume, overwriting the client store's `reconnectToken` with `undefined`.
- **`apps/web/src/stores/gameStore.ts:159-171` (`handleSnapshot`)**:
  ```ts
  handleSnapshot: (payload) => set((state) => ({
    ...state,
    roomState: payload.room?.status ?? state.roomState,
    roomVersion: payload.room?.roomVersion ?? state.roomVersion,
    entryLocked: payload.room?.entryLocked ?? state.entryLocked,
    currentQuestionIndex: payload.room?.currentQuestionIndex ?? state.currentQuestionIndex,
    players: payload.players ?? state.players,
    presences: payload.presences ?? state.presences,
    currentQuestion: payload.currentQuestion ?? state.currentQuestion,
    startedAt: payload.round?.startedAt ?? state.startedAt,
    deadlineAt: payload.round?.deadlineAt ?? state.deadlineAt,
    playerId: payload.playerId ?? state.playerId,
  })),
  ```
  The snapshot payload contains `personalAnswers: [...]` (line 1152 of `game-room.ts`), but `handleSnapshot` completely ignores it. Reconnected players have `answerSubmitted: false` and `selectedOptionId: null`, re-enabling answer buttons and leading to `ANSWER_ALREADY_SUBMITTED` upon click.

---

### P0.3 Protocol Versioning & Ordering
- **`apps/web/src/lib/ws.ts:67-92` (`ws.onmessage`)**:
  ```ts
  if ('roomVersion' in envelope && typeof envelope.roomVersion === 'number') {
     this._roomVersion = envelope.roomVersion;
  }
  ```
  1. No deduplication of `envelope.eventId`: duplicate frames are re-processed.
  2. No gap detection: if `envelope.roomVersion > this._roomVersion + 1`, the client does not request `REQUEST_SNAPSHOT`.
  3. No stale event filtering: if `envelope.roomVersion < this._roomVersion`, out-of-order events are still delivered to handlers.

---

### P0.4 WebSocket Hibernation & Connection Identity in Durable Object
- **`apps/web/worker/game-room.ts:322-341` (`handleJoinRoom`)**:
  ```ts
  // Store player-ws mapping via tags
  // Since we can't re-tag, store the association in the WebSocket's attachment
  (ws as any).__playerId = playerId;
  (ws as any).__role = 'player';
  (ws as any).__connectionId = connectionId;
  ```
  Volatile JavaScript properties (`__playerId`, `__role`, `__connectionId`) are assigned directly to the `WebSocket` JS instance.
- **Cloudflare Workers WebSocket Hibernation behavior**:
  When the Durable Object hibernates, the JS object graph is garbage collected and the instance is evicted. On wakeup, fresh `WebSocket` wrappers are created; `(ws as any).__playerId` and `__role` are `undefined`.
- **`apps/web/worker/game-room.ts:438-442` (`handleSubmitAnswer`)**:
  ```ts
  const playerId = (ws as any).__playerId as string;
  if (!playerId) {
    this.sendAnswerRejected(ws, ProtocolError.UNAUTHORIZED, 'Not authenticated', correlationId);
    return;
  }
  ```
  Any answer submitted after hibernation is rejected as `UNAUTHORIZED`.
- **`apps/web/worker/game-room.ts:240-247` (`webSocketClose`)**:
  ```ts
  const tags = this.ctx.getTags(ws);
  const playerId = tags.find(t => t.startsWith('player:'))?.slice(7);
  if (playerId) {
    this.markDisconnected(playerId);
    this.broadcastPresenceChange(playerId, false);
    this.checkAllAnswered();
  }
  ```
  `player:${playerId}` tag was never attached at `ctx.acceptWebSocket(server, [`role:${role}`])`. After hibernation or close, `playerId` is `undefined`, so disconnects are never processed in SQLite, leaving players permanently marked `connected = 1`.
- **`apps/web/worker/game-room.ts:1073-1075` (`getWebSocketsByRole`)**:
  ```ts
  return this.ctx.getWebSockets().filter(ws => (ws as any).__role === role);
  ```
  Returns `[]` after hibernation. In `endCurrentQuestion` (line 750), personal score/answer reveals are never delivered to players.

---

### P0.5 State Machine on 10th Question
- **`packages/game/src/state-machine.ts:5-18` (`VALID_TRANSITIONS`)**:
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
  Notice: `QUESTION_REVEAL` only permits transition to `ROUND_RANKING`.
- **`apps/web/worker/game-room.ts:770-776` (`handleShowRanking`)**:
  ```ts
  private handleShowRanking(correlationId?: string): void {
    if (!this.room || this.room.status !== GameState.QUESTION_REVEAL) return;
    
    const isLastQuestion = this.room.currentQuestionIndex >= TOTAL_QUESTIONS - 1;
    const nextState = isLastQuestion ? GameState.FINAL_RANKING : GameState.ROUND_RANKING;
    
    this.transitionTo(nextState, correlationId);
  ```
  On the 10th question (`currentQuestionIndex === 9`), `isLastQuestion` is `true`.
  `transitionTo(GameState.FINAL_RANKING)` calls `assertTransition('QUESTION_REVEAL', 'FINAL_RANKING')`.
  Because that transition is missing in `VALID_TRANSITIONS`, it throws `Error: Invalid state transition from QUESTION_REVEAL to FINAL_RANKING`, which is caught by `webSocketMessage` and returns `INTERNAL_ERROR`. The game is locked at `QUESTION_REVEAL` on question 10.

---

### P0.6 Authoritative Answer Validation
- **`apps/web/worker/game-room.ts:426-528` (`handleSubmitAnswer`)**:
  - Missing Question ID check: Does not verify `parsed.data.questionId === question.id`. Stale question answers are inserted with mismatched IDs.
  - Missing Option ID membership: Does not verify `question.options.some(opt => opt.id === parsed.data.optionId)`. Arbitrary option IDs can be inserted, distorting answer counts and statistics.
  - Identical resubmission handling: PRD FR 014 states identical resubmission should be ignored idempotently. Current code rejects all re-submissions with `ANSWER_ALREADY_SUBMITTED`.

---

### P0.7 Pause, Resume, and Bonus Window
- **`apps/web/worker/game-room.ts:835-844` (`handlePause`)**:
  ```ts
  const now = Date.now();
  const remainingMs = Math.max(0, round.deadlineAt - now);
  this.sql.exec(
    `UPDATE rounds SET state = 'paused', remaining_ms = ? WHERE question_id = ?`,
    remainingMs, round.questionId
  );
  ```
  The table does not store accumulated active elapsed time before pause.
- **`apps/web/worker/game-room.ts:643-650` (`startQuestion` on resume)**:
  ```ts
  deadlineAt = now + (round.remainingMs || 0);
  this.sql.exec(
    `UPDATE rounds SET state = 'active', started_at = ?, deadline_at = ?, remaining_ms = NULL WHERE question_id = ?`,
    now, deadlineAt, question.id
  );
  ```
  `started_at` is overwritten with `now`.
- **`apps/web/worker/game-room.ts:492-493` (`handleSubmitAnswer`)**:
  ```ts
  const responseTimeMs = now - round.startedAt;
  const awardedPoints = calculatePoints(question.basePoints, correct, responseTimeMs);
  ```
  Because `started_at` was set to `now` upon resume, `responseTimeMs` measures only the time since resumption.
  - If a player took 8s before the pause, and 3s after resumption: active elapsed time is 11s (bonus expired). But server calculates `3000ms`, erroneously awarding the 25% speed bonus.
  - If `started_at` were not updated, the pause duration would erroneously wipe out the speed bonus for everyone.

---

### P1.8 Host Session Security & P1.9 Local Rate Limiting
- **`apps/web/worker/index.ts:25-48`**:
  `POST /api/rooms` creates a room without IP rate limiting. `hostToken` is returned in plaintext JSON body and saved in `localStorage`.
  There is no cookie-based credential (`HttpOnly; SameSite=Strict`) nor payload size restriction.
- **`apps/web/worker/game-room.ts:186-190`**:
  WebSocket messages have no size cap before parsing JSON, risking CPU exhaustion.

---

## 2. Logic Chain

1. **Host Infinite Loading (P0.1)**:
   - Observation: `handleWebSocketUpgrade` returns 101 without sending `SNAPSHOT`. `ws.onopen` does not call `requestSnapshot`. `HostPage` defaults to "Aguardando...".
   - Logic: A newly mounted host expects the authoritative state machine projection to render the lobby. Without an initial message, the Zustand store keeps `roomState = null`.
   - Fix: Server must call `this.sendSnapshot(server, role)` inside `handleWebSocketUpgrade` after `acceptWebSocket`. The client must also send `REQUEST_SNAPSHOT` on `onopen` as a fallback.

2. **Session Lifecycle & Reconnection (P0.2)**:
   - Observation: `useGameSocket` disconnects the socket on unmount. `PlayerPage` connects with `?token=...` but never sends `RESUME_SESSION`. `handleResumeSession` omits `reconnectToken` in `SESSION_ACCEPTED`. `handleSnapshot` ignores `personalAnswers`.
   - Logic: A player refreshing the browser or remounting a component loses connection, reopens an unauthenticated socket, loses their reconnect token, and even upon receiving a snapshot has their answer state wiped.
   - Fix: Auto-send `RESUME_SESSION` in `ws.onopen` if token exists; return `reconnectToken` in `SESSION_ACCEPTED`; restore `selectedOptionId` and `answerSubmitted` from `personalAnswers` in `handleSnapshot`.

3. **Ordering and Gap Detection (P0.3)**:
   - Observation: `wsManager.ts` has no event deduplication and blindly assigns `this._roomVersion = envelope.roomVersion`.
   - Logic: Network packet reordering or drops cause client state desynchronization without recovery.
   - Fix: Maintain a bounded `Set<string>` of seen `eventId`s (FIFO eviction at 500 items). If `envelope.roomVersion > this._roomVersion + 1`, trigger `wsManager.requestSnapshot()`.

4. **DO WebSocket Hibernation (P0.4)**:
   - Observation: `game-room.ts` assigns `(ws as any).__playerId = playerId`. When DO hibernates, memory is evicted. On wakeup, `(ws as any).__playerId` is `undefined`.
   - Logic: `handleSubmitAnswer` fails with `UNAUTHORIZED`. `webSocketClose` cannot identify player, leaving SQLite presence stale. `getWebSocketsByRole` fails to deliver reveals.
   - Fix: Store `{ playerId, role, connectionId }` using Cloudflare's `ws.serializeAttachment(...)` and retrieve via `ws.deserializeAttachment()`.

5. **10th Question State Machine (P0.5)**:
   - Observation: Question 10 index is 9. `isLastQuestion` is true. `handleShowRanking` calls `transitionTo(GameState.FINAL_RANKING)`. `assertTransition('QUESTION_REVEAL', 'FINAL_RANKING')` throws because `VALID_TRANSITIONS` only permits `QUESTION_REVEAL -> ROUND_RANKING`.
   - Logic: The 10th question is impossible to complete; the host interface errors out.
   - Fix: Add `{ from: 'QUESTION_REVEAL', to: 'FINAL_RANKING', trigger: 'host shows ranking (last question)' }` to `VALID_TRANSITIONS`.

6. **Answer Validation (P0.6)**:
   - Observation: `handleSubmitAnswer` accepts options not matching `question.options` and does not verify `questionId === activeQuestion.id`.
   - Logic: Corrupts answer counts, percentages, and scoring.
   - Fix: Enforce `questionId === currentQuestion.id`, `question.options.some(o => o.id === optionId)`, and idempotently acknowledge identical re-submissions.

7. **Pause, Resume, and Bonus Window (P0.7)**:
   - Observation: `rounds` only saves `remaining_ms` and resets `started_at = now` on resume. Active elapsed time before pause is lost.
   - Logic: Players answering after resume receive an artificial speed bonus if time since resume <= 10s, even if total active time exceeded 10s.
   - Fix: Add `accumulated_active_ms` to `rounds`. On pause, add `(now - started_at)` to `accumulated_active_ms`. On answer, calculate `responseTimeMs = accumulated_active_ms + (now - started_at)`.

8. **Security & Rate Limiting (P1.8 / P1.9)**:
   - Observation: No rate limiter on `POST /api/rooms`. No size cap on WS frames. Host token in `localStorage`.
   - Logic: Vulnerable to DoS and token leakage.
   - Fix: Add in-memory sliding window IP rate limiter (5 rooms/min). Set `HttpOnly; SameSite=Strict` cookie on room creation. Cap WS frames at 16KB.

---

## 3. Caveats

- **No Caveats**: All 8 target areas were fully analyzed directly from repository source code, configuration files, and specification texts.
- **Scope Note**: Visual CSS polish, audio assets, and Playwright browser fixtures belong to subsequent implementation and QA milestones.

---

## 4. Conclusion & Recommended Fix Plan

The root causes across all 8 items are concrete, localized, and directly resolvable:

### Proposed Code Changes by File

#### 1. `packages/game/src/state-machine.ts`
Add the direct transition from `QUESTION_REVEAL` to `FINAL_RANKING` and support host terminations:
```diff
--- a/packages/game/src/state-machine.ts
+++ b/packages/game/src/state-machine.ts
@@ -10,6 +10,8 @@ export const VALID_TRANSITIONS: Transition[] = [
   { from: 'QUESTION_ACTIVE', to: 'PAUSED', trigger: 'host pauses' },
   { from: 'QUESTION_REVEAL', to: 'ROUND_RANKING', trigger: 'host shows ranking' },
+  { from: 'QUESTION_REVEAL', to: 'FINAL_RANKING', trigger: 'host shows ranking on last question' },
+  { from: 'ROUND_RANKING', to: 'FINISHED', trigger: 'host ends' },
+  { from: 'FINAL_RANKING', to: 'FINISHED', trigger: 'host ends' },
   { from: 'ROUND_RANKING', to: 'COUNTDOWN', trigger: 'host next question, NOT last' },
   { from: 'ROUND_RANKING', to: 'FINAL_RANKING', trigger: 'was last question' },
```

#### 2. `apps/web/worker/game-room.ts`
- In `initSchema()`: add `accumulated_active_ms INTEGER NOT NULL DEFAULT 0` to `rounds` table.
- In `handleWebSocketUpgrade`:
  ```ts
  this.ctx.acceptWebSocket(server, [`role:${role}`]);
  server.serializeAttachment({ role });
  if (role === 'host' || role === 'screen') {
    this.sendSnapshot(server, role);
  }
  return new Response(null, { status: 101, webSocket: client });
  ```
- Use `ws.serializeAttachment({ playerId, role, connectionId })` in `handleJoinRoom` and `handleResumeSession`.
- Helper `getConnectionMeta(ws)` using `ws.deserializeAttachment()`.
- In `handleResumeSession`: include `reconnectToken: parsed.data.reconnectToken` in `SESSION_ACCEPTED`.
- In `handleSubmitAnswer`:
  - Validate `parsed.data.questionId === question.id`.
  - Validate `question.options.some(opt => opt.id === parsed.data.optionId)`.
  - Check identical resubmission: if `existing.length > 0 && existing[0].option_id === parsed.data.optionId`, return `ANSWER_ACCEPTED` idempotently.
  - Calculate `responseTimeMs = (round.accumulatedActiveMs || 0) + (now - round.startedAt)`.
- In `handlePause`:
  - Record `accumulated_active_ms = (round.accumulatedActiveMs || 0) + (now - round.startedAt)`.
- In `getWebSocketsByRole`: check `this.getConnectionMeta(ws).role === role`.

#### 3. `apps/web/src/lib/ws.ts`
- Implement `seenEventIds: Set<string>` for idempotent deduplication.
- On gap (`envelope.roomVersion > this._roomVersion + 1`), invoke `this.requestSnapshot()`.
- On `this.ws.onopen`:
  - If `this.currentToken` and `this.currentRole === 'player'`, automatically call `this.resumeSession(this.currentPin, this.currentToken)`.
  - If `this.currentRole === 'host' || this.currentRole === 'screen'`, automatically call `this.requestSnapshot()`.

#### 4. `apps/web/src/stores/gameStore.ts`
- In `handleSnapshot`:
  - Check `payload.personalAnswers`: if answer exists for `payload.currentQuestion?.id`, set `answerSubmitted: true` and `selectedOptionId: ans.option_id`.
  - Restore `personalScore` from `payload.scores`.
  - If `payload.room?.status === 'QUESTION_REVEAL'`, restore `personalResult`.

#### 5. `apps/web/worker/index.ts`
- Add in-memory sliding window IP rate limiting on `POST /api/rooms` (e.g. max 5 creations / min / IP).
- Check `Content-Length <= 32768`.
- Set `Set-Cookie: batalha_host_<pin>=<token>; Path=/; HttpOnly; SameSite=Strict; Secure`.

---

## 5. Verification Method

### 1. State Machine Unit Tests
Run existing and new domain tests:
```bash
pnpm test
```
Verify new tests covering:
- `canTransition('QUESTION_REVEAL', 'FINAL_RANKING') === true`
- `canTransition('FINAL_RANKING', 'PODIUM') === true`
- `canTransition('PODIUM', 'FINISHED') === true`
- Resumed question scoring: 8,000ms active + pause + 3,000ms active = 11,000ms -> Base points only (no bonus).
- Resumed question scoring: 4,000ms active + pause + 4,000ms active = 8,000ms -> Bonus awarded (125 pts).

### 2. Monorepo Typecheck & Build
```bash
pnpm typecheck
pnpm build
```
Must exit with code 0.

### 3. Worker Integration / E2E Testing
- Host connection at `/host/:pin`: Verify immediate transition out of "Aguardando estado do jogo..." to lobby with QR code.
- Player reconnection: Refresh browser during active question; verify answer button state is preserved and does not prompt `ANSWER_ALREADY_SUBMITTED`.
- Full 10-question cycle: Play questions 1 through 10, reach Question 10 reveal, click "Ver Classificação", verify smooth transition to `FINAL_RANKING`, then `START_PODIUM` -> `PODIUM` -> `FINISHED`.

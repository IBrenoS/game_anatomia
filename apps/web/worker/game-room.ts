import { DurableObject } from 'cloudflare:workers';
import {
  GameState, Question, PublicQuestion, PlayerData, PresenceData, PlayerPresenceStatus,
  AnswerData, ScoreData, RoundData, RoomData, RankingEntry,
  MAX_PLAYERS_PER_ROOM, SPEED_BONUS_WINDOW_MS, PRESENCE_TIMEOUT_MS,
  ROOM_EXPIRY_MS, COUNTDOWN_DURATION_MS, TOTAL_QUESTIONS,
  REVEAL_DURATION_MS, ROUND_RANKING_DURATION_MS, FINAL_RANKING_DURATION_MS, PODIUM_DURATION_MS,
  HEARTBEAT_PING_FRAME, HEARTBEAT_PONG_FRAME,
  ProtocolError, ServerEventType, ClientEventType,
  createServerEnvelope,
  JoinRoomSchema, ResumeSessionSchema, SubmitAnswerSchema,
  HostCommandSchema, ClientAliveSchema, RequestSnapshotSchema,
  EventEnvelopeSchema,
} from '@batalha/protocol';
import {
  calculatePoints, buildRanking, canTransition, assertTransition,
  toPublicQuestion, isPlayerEligible, isPlayerActive,
  normalizeNickname, isNicknameUnique, shouldQuestionEnd,
  getPlayerPresenceStatus, getRoomPlayerCounts, canRevealAnswer,
} from '@batalha/game';
import { questions } from '@batalha/content';

export interface ConnectionMeta {
  role: string;
  playerId?: string;
  connectionId?: string;
  lastSeenAt?: number;
}

export class GameRoom extends DurableObject {
  private sql: SqlStorage;
  private room: RoomData | null = null;
  private currentRound: RoundData | null = null;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(HEARTBEAT_PING_FRAME, HEARTBEAT_PONG_FRAME),
    );
    this.initSchema();
  }

  private setConnectionMeta(ws: WebSocket, meta: Partial<ConnectionMeta>): void {
    const current = this.getConnectionMeta(ws);
    const merged: ConnectionMeta = { ...current, ...meta };
    try {
      (ws as any).serializeAttachment?.(merged);
    } catch {
      // In case serializeAttachment is not supported in test mocks
    }
    (ws as any).__connectionMeta = merged;
    (ws as any).__role = merged.role;
    if (merged.playerId) (ws as any).__playerId = merged.playerId;
    if (merged.connectionId) (ws as any).__connectionId = merged.connectionId;
  }

  private getConnectionMeta(ws: WebSocket): ConnectionMeta {
    if ((ws as any).__connectionMeta) {
      return (ws as any).__connectionMeta;
    }
    try {
      const deserialized = (ws as any).deserializeAttachment?.();
      if (deserialized && typeof deserialized === 'object') {
        const meta = deserialized as ConnectionMeta;
        (ws as any).__connectionMeta = meta;
        (ws as any).__role = meta.role;
        if (meta.playerId) (ws as any).__playerId = meta.playerId;
        if (meta.connectionId) (ws as any).__connectionId = meta.connectionId;
        return meta;
      }
    } catch {
      // ignore
    }
    let roleTag: string | undefined;
    let playerTag: string | undefined;
    try {
      const tags = this.ctx.getTags(ws);
      roleTag = tags.find(t => t.startsWith('role:'))?.slice(5);
      playerTag = tags.find(t => t.startsWith('player:'))?.slice(7);
    } catch {
      // ignore
    }
    const fallback: ConnectionMeta = {
      role: (ws as any).__role || roleTag || 'player',
      playerId: (ws as any).__playerId || playerTag,
      connectionId: (ws as any).__connectionId,
    };
    (ws as any).__connectionMeta = fallback;
    return fallback;
  }

  private initSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS room (
        pin TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'LOBBY',
        room_version INTEGER NOT NULL DEFAULT 0,
        last_state_version INTEGER NOT NULL DEFAULT 0,
        entry_locked INTEGER NOT NULL DEFAULT 0,
        current_question_index INTEGER NOT NULL DEFAULT -1,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        host_token_hash TEXT NOT NULL,
        phase_started_at INTEGER,
        phase_deadline_at INTEGER,
        countdown_kind TEXT
      );
      
      CREATE TABLE IF NOT EXISTS players (
        player_id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        eligible_from_question INTEGER NOT NULL DEFAULT 0,
        removed_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS presence (
        player_id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        last_seen_at INTEGER NOT NULL,
        connected INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (player_id) REFERENCES players(player_id)
      );
      
      CREATE TABLE IF NOT EXISTS rounds (
        question_id TEXT PRIMARY KEY,
        state TEXT NOT NULL DEFAULT 'active',
        started_at INTEGER NOT NULL,
        deadline_at INTEGER NOT NULL,
        remaining_ms INTEGER,
        accumulated_active_ms INTEGER NOT NULL DEFAULT 0,
        ended_at INTEGER,
        end_reason TEXT
      );
      
      CREATE TABLE IF NOT EXISTS answers (
        question_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        option_id TEXT NOT NULL,
        received_at INTEGER NOT NULL,
        response_time_ms INTEGER NOT NULL DEFAULT 0,
        correct INTEGER NOT NULL,
        awarded_points INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (question_id, player_id)
      );
      
      CREATE TABLE IF NOT EXISTS scores (
        player_id TEXT PRIMARY KEY,
        total_points INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        correct_response_time_ms INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players(player_id)
      );
      
      CREATE TABLE IF NOT EXISTS commands (
        command_id TEXT PRIMARY KEY,
        actor TEXT NOT NULL,
        type TEXT NOT NULL,
        accepted_at INTEGER NOT NULL,
        resulting_room_version INTEGER NOT NULL
      );
    `);

    try { this.sql.exec('ALTER TABLE room ADD COLUMN last_state_version INTEGER NOT NULL DEFAULT 0'); } catch { /* ignore */ }
    try { this.sql.exec('ALTER TABLE rounds ADD COLUMN accumulated_active_ms INTEGER NOT NULL DEFAULT 0'); } catch { /* ignore */ }
    try { this.sql.exec('ALTER TABLE answers ADD COLUMN response_time_ms INTEGER NOT NULL DEFAULT 0'); } catch { /* ignore */ }
    try { this.sql.exec('ALTER TABLE room ADD COLUMN phase_started_at INTEGER'); } catch { /* ignore */ }
    try { this.sql.exec('ALTER TABLE room ADD COLUMN phase_deadline_at INTEGER'); } catch { /* ignore */ }
    try { this.sql.exec('ALTER TABLE room ADD COLUMN countdown_kind TEXT'); } catch { /* ignore */ }
  }

  // ─── HTTP handlers ──────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/init' && request.method === 'POST') {
      return this.handleInit(request);
    }
    
    if (url.pathname === '/status' && request.method === 'GET') {
      return this.handleStatus();
    }
    
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request, url);
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  private async handleInit(request: Request): Promise<Response> {
    const { pin, hostToken } = await request.json() as { pin: string; hostToken: string };
    
    // Check if already initialized
    const existing = this.sql.exec('SELECT pin FROM room LIMIT 1').toArray();
    if (existing.length > 0) {
      return Response.json({ error: 'Room already initialized' }, { status: 409 });
    }
    
    const now = Date.now();
    const hostTokenHash = await this.hashToken(hostToken);
    
    this.sql.exec(
      `INSERT INTO room (pin, status, room_version, last_state_version, entry_locked, current_question_index, created_at, expires_at, host_token_hash)
       VALUES (?, 'LOBBY', 0, 0, 0, -1, ?, ?, ?)`,
      pin, now, now + ROOM_EXPIRY_MS, hostTokenHash
    );
    
    this.loadRoom();
    return Response.json({ ok: true }, { status: 201 });
  }

  private handleStatus(): Response {
    this.loadRoom();
    if (!this.room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }
    return Response.json({
      pin: this.room.pin,
      status: this.room.status,
      playerCount: this.getActivePlayers().length,
      entryLocked: this.room.entryLocked,
    });
  }

  // ─── WebSocket handling ─────────────────────

  private async handleWebSocketUpgrade(request: Request, url: URL): Promise<Response> {
    this.loadRoom();
    if (!this.room) {
      return Response.json({ error: 'ROOM_NOT_FOUND' }, { status: 404 });
    }
    
    const role = url.searchParams.get('role') || 'player';

    // P1.8 / Section 13: Host authentication exclusively via HttpOnly cookie (no query param fallback)
    if (role === 'host') {
      const cookie = request.headers.get('cookie') || '';
      const match = cookie.match(new RegExp(`(?:^|;\\s*)batalha_host_${this.room.pin}=([^;]+)`));
      const token = match ? match[1] : '';
      if (!token) {
        return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      const tokenHash = await this.hashToken(token);
      const rows = this.sql.exec('SELECT host_token_hash FROM room WHERE pin = ?', this.room.pin).toArray();
      if (rows.length === 0 || rows[0].host_token_hash !== tokenHash) {
        return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }
    
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    // Tag the WebSocket with metadata and attach hibernation data (P0.4)
    this.ctx.acceptWebSocket(server, [`role:${role}`]);
    this.setConnectionMeta(server, { role });
    
    // P0.1: Immediate snapshot on connection for host and screen
    if (role === 'host' || role === 'screen') {
      this.sendSnapshot(server, role);
    }
    
    return new Response(null, { status: 101, webSocket: client });
  }

  // Hibernation API callbacks
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    
    // P1.9: Enforce payload size limit (16KB)
    if (message.length > 16384) {
      this.sendError(ws, ProtocolError.INVALID_PAYLOAD, 'Payload exceeds 16KB limit');
      return;
    }

    try {
      const raw = JSON.parse(message);
      const envelope = EventEnvelopeSchema.safeParse(raw);
      if (!envelope.success) {
        this.sendError(ws, 'INVALID_ENVELOPE', 'Invalid event format');
        return;
      }
      
      const { type, payload, correlationId } = envelope.data;
      this.loadRoom();

      switch (type) {
        case 'JOIN_ROOM':
          await this.handleJoinRoom(ws, payload, correlationId);
          break;
        case 'RESUME_SESSION':
          await this.handleResumeSession(ws, payload, correlationId);
          break;
        case 'SUBMIT_ANSWER':
          await this.handleSubmitAnswer(ws, payload, correlationId);
          break;
        case 'CLIENT_ALIVE':
          this.handleClientAlive(ws, payload);
          break;
        case 'HOST_COMMAND':
          await this.handleHostCommand(ws, payload, correlationId);
          break;
        case 'REQUEST_SNAPSHOT':
          this.handleRequestSnapshot(ws, payload, correlationId);
          break;
        default:
          this.sendError(ws, 'UNKNOWN_EVENT', `Unknown event type: ${type}`);
      }
    } catch (err) {
      this.sendError(ws, 'INTERNAL_ERROR', 'Internal server error');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const meta = this.getConnectionMeta(ws);
    let playerId = meta.playerId;
    if (!playerId) {
      try {
        const tags = this.ctx.getTags(ws);
        playerId = tags.find(t => t.startsWith('player:'))?.slice(7);
      } catch {
        // ignore
      }
    }
    if (playerId && meta.connectionId && this.isCanonicalPlayerConnection(playerId, meta.connectionId)) {
      this.markDisconnected(playerId, meta.connectionId);
      this.broadcastPresenceChange(playerId, false);
      this.checkAllAnswered();
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    // Same as close
    await this.webSocketClose(ws, 1006, 'error');
  }

  // ─── Presence Expiration & Alarm Scheduling (Section 8) ─────

  private markPlayerPresent(playerId: string, connectionId?: string, now: number = Date.now()): boolean {
    if (!this.room) return false;

    // Confirm that player exists and is not removed
    const playerRows = this.sql.exec(
      'SELECT player_id, nickname, removed_at FROM players WHERE player_id = ?',
      playerId
    ).toArray();
    if (playerRows.length === 0 || playerRows[0].removed_at !== null) {
      return false;
    }

    // Find the current presence row in SQLite
    const presenceRows = this.sql.exec(
      'SELECT connected, connection_id FROM presence WHERE player_id = ?',
      playerId
    ).toArray();

    // Confirm that the connection belongs to the player
    if (
      connectionId &&
      presenceRows.length > 0 &&
      presenceRows[0].connection_id &&
      presenceRows[0].connection_id !== connectionId
    ) {
      return false;
    }

    const wasConnected = presenceRows.length > 0 && presenceRows[0].connected === 1;

    if (!wasConnected) {
      const finalConnId = connectionId || (presenceRows[0]?.connection_id as string) || crypto.randomUUID();
      this.sql.exec(
        `INSERT OR REPLACE INTO presence (player_id, connection_id, last_seen_at, connected)
         VALUES (?, ?, ?, 1)`,
        playerId, finalConnId, now
      );
      this.incrementVersion();
      this.broadcastPresenceChange(playerId, true);
      this.ensurePresenceAlarmScheduled(now);
      return true;
    } else {
      this.ensurePresenceAlarmScheduled(now);
      return true;
    }
  }

  private checkAndExpirePresence(now: number = Date.now()): boolean {
    if (!this.room) return false;
    const effectivePresences = this.getEffectivePresences(now);
    let expiredAny = false;

    for (const pr of effectivePresences) {
      if (!pr.connected) {
        const rows = this.sql.exec('SELECT connected FROM presence WHERE player_id = ?', pr.playerId).toArray();
        if (rows.length > 0 && rows[0].connected === 1) {
          this.sql.exec('UPDATE presence SET connected = 0 WHERE player_id = ?', pr.playerId);
          this.broadcastPresenceChange(pr.playerId, false);
          expiredAny = true;
        }
      }
    }

    if (expiredAny && this.room.status === GameState.QUESTION_ACTIVE) {
      this.checkAllAnswered();
    }

    return expiredAny;
  }

  private getCurrentPhaseDeadline(): number | null {
    if (!this.room) return null;
    if (this.room.status === GameState.PAUSED || this.room.status === GameState.LOBBY) {
      return null;
    }
    if (this.room.status === GameState.QUESTION_ACTIVE) {
      const round = this.getCurrentRound();
      if (round && round.state === 'active') {
        return round.deadlineAt;
      }
      return this.room.phaseDeadlineAt;
    }
    return this.room.phaseDeadlineAt;
  }

  private getNextAlarmTime(phaseDeadline?: number | null, now: number = Date.now()): number | null {
    const effectivePhaseDeadline = phaseDeadline !== undefined ? phaseDeadline : this.getCurrentPhaseDeadline();

    const connectedPresences = this.getEffectivePresences(now).filter(p => p.connected);
    let earliestPresenceExpiry: number | null = null;
    for (const p of connectedPresences) {
      const expiry = p.lastSeenAt + PRESENCE_TIMEOUT_MS + 100;
      if (expiry > now) {
        if (earliestPresenceExpiry === null || expiry < earliestPresenceExpiry) {
          earliestPresenceExpiry = expiry;
        }
      }
    }

    if (effectivePhaseDeadline !== null && earliestPresenceExpiry !== null) {
      return Math.min(effectivePhaseDeadline, earliestPresenceExpiry);
    }
    return effectivePhaseDeadline ?? earliestPresenceExpiry;
  }

  private scheduleNextAlarm(phaseDeadline?: number | null, now: number = Date.now()): void {
    const nextAlarm = this.getNextAlarmTime(phaseDeadline, now);
    if (nextAlarm !== null) {
      this.ctx.storage.setAlarm(nextAlarm);
    } else {
      this.ctx.storage.deleteAlarm();
    }
  }

  private ensurePresenceAlarmScheduled(now: number = Date.now()): void {
    this.scheduleNextAlarm(undefined, now);
  }

  // ─── Alarm handler (phase timer + autonomous presence) ──────

  async alarm(): Promise<void> {
    this.loadRoom();
    if (!this.room) return;
    const initialStatus = this.room.status;
    const now = Date.now();

    // 1. Check autonomous presence expiry
    this.checkAndExpirePresence(now);

    // If presence check already triggered a state change (e.g. all answered -> QUESTION_REVEAL),
    // do not fall through to process the new phase in the same alarm execution!
    if (this.room.status !== initialStatus) {
      return;
    }

    // 2. Process phase transitions
    switch (this.room.status) {
      case GameState.COUNTDOWN:
        if (this.isCurrentPhaseDue(now)) this.startQuestion();
        else this.scheduleNextAlarm(this.room.phaseDeadlineAt, now);
        break;
      case GameState.QUESTION_ACTIVE: {
        const round = this.getCurrentRound();
        if (round && now >= round.deadlineAt) {
          this.endCurrentQuestion('deadline');
        } else {
          // Presence checks are independent from phase deadlines. If nobody
          // expired, the question remains active and the next relevant alarm
          // is the earliest presence expiry or the authoritative deadline.
          this.scheduleNextAlarm(round?.deadlineAt ?? null, now);
        }
        break;
      }
      case GameState.QUESTION_REVEAL:
        if (this.isCurrentPhaseDue(now)) this.handleShowRanking();
        else this.scheduleNextAlarm(this.room.phaseDeadlineAt, now);
        break;
      case GameState.ROUND_RANKING:
        if (this.isCurrentPhaseDue(now)) this.handleNextQuestion();
        else this.scheduleNextAlarm(this.room.phaseDeadlineAt, now);
        break;
      case GameState.FINAL_RANKING:
        if (this.isCurrentPhaseDue(now)) this.handleStartPodium();
        else this.scheduleNextAlarm(this.room.phaseDeadlineAt, now);
        break;
      case GameState.PODIUM:
        if (this.isCurrentPhaseDue(now)) this.handleEndGame();
        else this.scheduleNextAlarm(this.room.phaseDeadlineAt, now);
        break;
      case GameState.FINISHED:
        if (this.isCurrentPhaseDue(now)) this.cleanupRoom();
        else this.scheduleNextAlarm(this.room.phaseDeadlineAt, now);
        break;
      case GameState.PAUSED:
        // Presence expiry check was executed at the beginning of alarm().
        // Do NOT consume remainingMs, do NOT advance game state, do NOT resume.
        // Reschedule next presence alarm if needed.
        this.ensurePresenceAlarmScheduled(now);
        break;
      default:
        this.scheduleNextAlarm(null, now);
    }
  }

  // ─── Event Handlers ─────────────────────────

  private async handleJoinRoom(ws: WebSocket, payload: unknown, correlationId?: string): Promise<void> {
    const parsed = JoinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Invalid join data');
      return;
    }
    
    if (!this.room) {
      this.sendError(ws, ProtocolError.ROOM_NOT_FOUND, 'Room not found');
      return;
    }
    
    if (this.room.entryLocked) {
      this.sendError(ws, ProtocolError.ROOM_LOCKED, 'Room entries are locked');
      return;
    }
    
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length >= MAX_PLAYERS_PER_ROOM) {
      this.sendError(ws, ProtocolError.ROOM_FULL, 'Room is full');
      return;
    }
    
    const nickname = normalizeNickname(parsed.data.nickname);
    if (!isNicknameUnique(nickname, activePlayers)) {
      this.sendError(ws, ProtocolError.NICKNAME_TAKEN, 'Nickname is taken');
      return;
    }
    
    const playerId = crypto.randomUUID();
    const reconnectToken = crypto.randomUUID();
    const tokenHash = await this.hashToken(reconnectToken);
    const now = Date.now();
    
    // Determine eligibility: if game is in progress, eligible from next question
    const eligibleFrom = this.room.status === GameState.LOBBY
      ? 0
      : (this.room.currentQuestionIndex + 1);
    
    this.sql.exec(
      `INSERT INTO players (player_id, nickname, token_hash, joined_at, eligible_from_question)
       VALUES (?, ?, ?, ?, ?)`,
      playerId, nickname, tokenHash, now, eligibleFrom
    );
    
    this.sql.exec(
      `INSERT INTO scores (player_id, total_points, correct_count, correct_response_time_ms)
       VALUES (?, 0, 0, 0)`,
      playerId
    );
    
    // Tag the WebSocket
    const connectionId = crypto.randomUUID();
    this.ctx.getTags(ws); // ensure it has tags
    // Re-accept with proper tags
    // Note: We can't re-tag, so we use the initial tags and track via presence table
    
    this.sql.exec(
      `INSERT OR REPLACE INTO presence (player_id, connection_id, last_seen_at, connected)
       VALUES (?, ?, ?, 1)`,
      playerId, connectionId, now
    );
    
    this.incrementVersion();
    
    // Store player-ws mapping via hibernation attachment and memory cache (P0.4)
    this.setConnectionMeta(ws, { role: 'player', playerId, connectionId, lastSeenAt: now });
    
    // Send SESSION_ACCEPTED to the player
    const sessionEvent = createServerEnvelope(
      ServerEventType.SESSION_ACCEPTED,
      { playerId, reconnectToken, role: 'player', nickname },
      this.room!.roomVersion,
      correlationId
    );
    ws.send(JSON.stringify(sessionEvent));
    
    // Broadcast PLAYER_JOINED to everyone
    const joinedCounts = getRoomPlayerCounts(
      this.getActivePlayers(),
      this.getEffectivePresences(now),
      this.room!.currentQuestionIndex,
      now
    );
    this.broadcastToAll(createServerEnvelope(
      ServerEventType.PLAYER_JOINED,
      {
        playerId,
        nickname,
        joinedAt: now,
        playerCount: this.getActivePlayers().length,
        ...joinedCounts,
      },
      this.room!.roomVersion
    ));

    // Broadcast live presence change (connected = true)
    this.broadcastPresenceChange(playerId, true);
    
    // Send snapshot to the new player
    this.sendSnapshot(ws, 'player', playerId);

    // Schedule presence check alarm
    this.ensurePresenceAlarmScheduled(now);
  }

  private async handleResumeSession(ws: WebSocket, payload: unknown, correlationId?: string): Promise<void> {
    const parsed = ResumeSessionSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Invalid resume data');
      return;
    }
    
    if (!this.room) {
      this.sendError(ws, ProtocolError.ROOM_NOT_FOUND, 'Room not found');
      return;
    }
    
    const tokenHash = await this.hashToken(parsed.data.reconnectToken);
    const rows = this.sql.exec(
      'SELECT player_id, nickname, removed_at FROM players WHERE token_hash = ?',
      tokenHash
    ).toArray();
    
    if (rows.length === 0 || rows[0].removed_at !== null) {
      this.sendError(ws, ProtocolError.UNAUTHORIZED, 'Invalid or revoked session');
      return;
    }
    
    const player = rows[0];
    const playerId = player.player_id as string;
    const connectionId = crypto.randomUUID();
    const now = Date.now();
    
    // Close old WebSocket if any
    this.closeOldConnection(playerId);
    
    // Update presence
    this.sql.exec(
      `INSERT OR REPLACE INTO presence (player_id, connection_id, last_seen_at, connected)
       VALUES (?, ?, ?, 1)`,
      playerId, connectionId, now
    );
    
    // Store player-ws mapping via hibernation attachment and memory cache (P0.4)
    this.setConnectionMeta(ws, { role: 'player', playerId, connectionId, lastSeenAt: now });
    
    this.incrementVersion();
    
    // Send SESSION_ACCEPTED with reconnectToken preserved (P0.2)
    const sessionEvent = createServerEnvelope(
      ServerEventType.SESSION_ACCEPTED,
      {
        playerId,
        role: 'player',
        nickname: player.nickname as string,
        reconnectToken: parsed.data.reconnectToken,
      },
      this.room!.roomVersion,
      correlationId
    );
    ws.send(JSON.stringify(sessionEvent));
    
    // Send full snapshot
    this.sendSnapshot(ws, 'player', playerId);
    
    // Broadcast presence change
    this.broadcastPresenceChange(playerId, true);

    // Rearm presence scheduler (V3.2 requirement 3)
    this.ensurePresenceAlarmScheduled(now);
  }

  private async handleSubmitAnswer(ws: WebSocket, payload: unknown, correlationId?: string): Promise<void> {
    const parsed = SubmitAnswerSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, ProtocolError.INVALID_PAYLOAD, 'Invalid answer data');
      return;
    }
    
    const meta = this.getConnectionMeta(ws);
    const playerId = meta.playerId;
    if (!playerId) {
      this.sendAnswerRejected(ws, ProtocolError.UNAUTHORIZED, 'Not authenticated', correlationId);
      return;
    }
    
    const now = Date.now();
    this.setConnectionMeta(ws, { lastSeenAt: now });
    const markedPresent = this.markPlayerPresent(playerId, meta.connectionId, now);
    if (!markedPresent) {
      this.sendAnswerRejected(ws, ProtocolError.UNAUTHORIZED, 'Player not active or connection mismatch', correlationId);
      return;
    }

    if (!this.room || this.room.status !== GameState.QUESTION_ACTIVE) {
      this.sendAnswerRejected(ws, ProtocolError.QUESTION_NOT_ACTIVE, 'No active question', correlationId);
      return;
    }
    const round = this.getCurrentRound();
    if (!round) {
      this.sendAnswerRejected(ws, ProtocolError.QUESTION_NOT_ACTIVE, 'No active round', correlationId);
      return;
    }

    // Check if paused (P0.6, P0.7)
    if (round.state === 'paused') {
      this.sendAnswerRejected(ws, ProtocolError.QUESTION_NOT_ACTIVE, 'Question is paused', correlationId);
      return;
    }
    
    // Check deadline (P0.6)
    if (now > round.deadlineAt) {
      this.sendAnswerRejected(ws, ProtocolError.DEADLINE_EXCEEDED, 'Deadline exceeded', correlationId);
      return;
    }

    // Validate active question existence and questionId match (P0.6)
    const question = questions[this.room.currentQuestionIndex];
    if (!question || parsed.data.questionId !== question.id) {
      this.sendAnswerRejected(ws, ProtocolError.QUESTION_NOT_ACTIVE, 'Question mismatch or invalid question ID', correlationId);
      return;
    }

    // Validate questionVersion (P0.6, P0.7)
    const currentQIndex = this.room.currentQuestionIndex;
    if (parsed.data.questionVersion < currentQIndex) {
      this.sendAnswerRejected(ws, ProtocolError.STALE_VERSION, 'Stale question version', correlationId);
      return;
    }
    if (parsed.data.questionVersion > currentQIndex) {
      this.sendAnswerRejected(ws, ProtocolError.INVALID_PAYLOAD, 'Future question version not allowed', correlationId);
      return;
    }

    // Validate optionId membership in question.options (P0.6)
    const validOption = question.options.some(opt => opt.id === parsed.data.optionId);
    if (!validOption) {
      this.sendAnswerRejected(ws, ProtocolError.INVALID_PAYLOAD, 'Invalid option for question', correlationId);
      return;
    }
    
    // Check player eligibility
    const playerRows = this.sql.exec(
      'SELECT * FROM players WHERE player_id = ?', playerId
    ).toArray();
    if (playerRows.length === 0) {
      this.sendAnswerRejected(ws, ProtocolError.UNAUTHORIZED, 'Player not found', correlationId);
      return;
    }
    const playerData = this.rowToPlayer(playerRows[0]);
    
    if (!isPlayerEligible(playerData, this.room.currentQuestionIndex)) {
      this.sendAnswerRejected(ws, ProtocolError.QUESTION_NOT_ACTIVE, 'Not eligible for this question', correlationId);
      return;
    }
    
    // Check if already answered (P0.6: idempotent re-acknowledgement for identical optionId)
    const existing = this.sql.exec(
      'SELECT option_id FROM answers WHERE question_id = ? AND player_id = ?',
      parsed.data.questionId, playerId
    ).toArray();
    
    if (existing.length > 0) {
      const prevOptionId = existing[0].option_id as string;
      if (prevOptionId === parsed.data.optionId) {
        // Idempotent re-acknowledgement
        const acceptedEvent = createServerEnvelope(
          ServerEventType.ANSWER_ACCEPTED,
          { questionId: parsed.data.questionId, receivedAt: now },
          this.room!.roomVersion,
          correlationId
        );
        ws.send(JSON.stringify(acceptedEvent));
        return;
      }
      this.sendAnswerRejected(ws, ProtocolError.ANSWER_ALREADY_SUBMITTED, 'Answer already submitted', correlationId);
      return;
    }
    
    // Calculate points: active response time includes accumulated active time from prior pause segments (P0.7)
    const activeInCurrentSegment = Math.max(0, now - round.startedAt);
    const responseTimeMs = round.accumulatedActiveMs + activeInCurrentSegment;
    const correct = parsed.data.optionId === question.correctOptionId;
    const awardedPoints = calculatePoints(question.basePoints, correct, responseTimeMs);
    
    // Persist answer
    this.sql.exec(
      `INSERT INTO answers (question_id, player_id, option_id, received_at, response_time_ms, correct, awarded_points)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      parsed.data.questionId, playerId, parsed.data.optionId, now, responseTimeMs, correct ? 1 : 0, awardedPoints
    );
    
    // Update score
    this.sql.exec(
      `UPDATE scores SET
        total_points = total_points + ?,
        correct_count = correct_count + ?,
        correct_response_time_ms = correct_response_time_ms + ?
       WHERE player_id = ?`,
      awardedPoints,
      correct ? 1 : 0,
      correct ? responseTimeMs : 0,
      playerId
    );
    
    this.incrementVersion();
    
    // Send ANSWER_ACCEPTED privately
    const acceptedEvent = createServerEnvelope(
      ServerEventType.ANSWER_ACCEPTED,
      { questionId: parsed.data.questionId, receivedAt: now },
      this.room!.roomVersion,
      correlationId
    );
    ws.send(JSON.stringify(acceptedEvent));
    
    // P0.12 & P0.13: Broadcast progress without answer leaks
    const allAnswers = this.getAnswersForQuestion(parsed.data.questionId);
    const progress = this.getCanonicalProgress(parsed.data.questionId, now);

    // Host receives distribution counts (NO correct answer highlight)
    const hostDistribution = question.options.map(opt => {
      const count = allAnswers.filter(a => a.optionId === opt.id).length;
      return {
        optionId: opt.id,
        count,
        percentage: allAnswers.length > 0 ? Math.round((count / allAnswers.length) * 100) : 0,
      };
    });

    this.broadcastByRole('host', createServerEnvelope(
      ServerEventType.ROUND_PROGRESS,
      {
        questionId: parsed.data.questionId,
        ...progress,
        totalEligible: progress.activeEligiblePlayers,
        distribution: hostDistribution,
      },
      this.room!.roomVersion
    ));

    // Screen and Players receive count only (NO distribution!)
    const publicProgress = createServerEnvelope(
      ServerEventType.ROUND_PROGRESS,
      {
        questionId: parsed.data.questionId,
        ...progress,
        totalEligible: progress.activeEligiblePlayers,
      },
      this.room!.roomVersion
    );
    this.broadcastByRole('screen', publicProgress);
    this.broadcastByRole('player', publicProgress);

    // Check if all eligible active players have answered
    this.checkAllAnswered();
  }

  private handleClientAlive(ws: WebSocket, payload: unknown): void {
    if (!ClientAliveSchema.safeParse(payload).success) return;

    const meta = this.getConnectionMeta(ws);
    if (!meta.playerId) return;

    const now = Date.now();
    this.setConnectionMeta(ws, { lastSeenAt: now });
    this.markPlayerPresent(meta.playerId, meta.connectionId, now);
  }

  private async handleHostCommand(ws: WebSocket, payload: unknown, correlationId?: string): Promise<void> {
    const parsed = HostCommandSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Invalid command data');
      return;
    }
    
    // Verify host authorization (P1.8)
    const role = this.getConnectionMeta(ws).role;
    if (role !== 'host') {
      this.sendError(ws, ProtocolError.UNAUTHORIZED, 'Not authorized as host', correlationId);
      return;
    }
    
    if (!this.room) {
      this.sendError(ws, ProtocolError.ROOM_NOT_FOUND, 'Room not found');
      return;
    }
    
    // Check room version for staleness (P0.6, P0.7)
    if (parsed.data.expectedRoomVersion > this.room.roomVersion) {
      this.sendError(ws, ProtocolError.INVALID_PAYLOAD, 'Future room version not allowed', correlationId);
      return;
    }
    const lastStateVersion = this.room.lastStateVersion ?? 0;
    if (parsed.data.expectedRoomVersion < lastStateVersion) {
      this.sendError(ws, ProtocolError.STALE_VERSION, 'Stale version', correlationId);
      return;
    }
    
    const { command, data } = parsed.data;
    
    switch (command) {
      case 'START_GAME':
        this.handleStartGame(correlationId, ws);
        break;
      case 'LOCK_ENTRIES':
        this.handleLockEntries(correlationId);
        break;
      case 'UNLOCK_ENTRIES':
        this.handleUnlockEntries(correlationId);
        break;
      case 'REMOVE_PLAYER':
        this.handleRemovePlayer(data as { playerId: string }, correlationId);
        break;
      case 'PAUSE':
        this.handlePause(correlationId, ws);
        break;
      case 'RESUME':
        this.handleResume(correlationId);
        break;
      case 'END_QUESTION':
        this.endCurrentQuestion('host', correlationId);
        break;
      case 'END_GAME':
        this.handleEndGame(correlationId);
        break;
    }
    
    // Record command
    const commandId = crypto.randomUUID();
    this.sql.exec(
      `INSERT INTO commands (command_id, actor, type, accepted_at, resulting_room_version)
       VALUES (?, 'host', ?, ?, ?)`,
      commandId, command, Date.now(), this.room!.roomVersion
    );
  }

  private handleRequestSnapshot(ws: WebSocket, payload: unknown, correlationId?: string): void {
    const meta = this.getConnectionMeta(ws);
    const playerId = meta.playerId;
    const role = meta.role || 'player';
    if (role === 'player' && playerId) {
      const now = Date.now();
      this.setConnectionMeta(ws, { lastSeenAt: now });
      this.markPlayerPresent(playerId, meta.connectionId, now);
    }
    this.sendSnapshot(ws, role, playerId, correlationId);
  }

  // ─── Game Flow Methods ──────────────────────

  private handleStartGame(correlationId?: string, ws?: WebSocket): void {
    if (!this.room) return;
    const now = Date.now();
    const players = this.getActivePlayers();
    const presences = this.getEffectivePresences(now);
    const counts = getRoomPlayerCounts(players, presences, 0, now);

    if (counts.connectedPlayers < 1) {
      if (ws) {
        this.sendError(ws, ProtocolError.NOT_ENOUGH_PLAYERS, 'Aguardando pelo menos um jogador conectado.', correlationId);
      }
      return;
    }
    
    const countdownStartedAt = Date.now();
    const countdownDeadlineAt = countdownStartedAt + COUNTDOWN_DURATION_MS;
    this.transitionTo(GameState.COUNTDOWN, correlationId, {
      phaseStartedAt: countdownStartedAt,
      phaseDeadlineAt: countdownDeadlineAt,
      countdownKind: 'INITIAL',
    });
    this.setEntryLocked(true);
    
    // Set alarm for countdown end
    this.scheduleNextAlarm(countdownDeadlineAt);
  }

  private startQuestion(): void {
    if (!this.room) return;
    
    // Check if there is a paused round we are resuming
    let round = this.getCurrentRound();
    const now = Date.now();
    let nextIndex = this.room.currentQuestionIndex;
    let deadlineAt = now;
    let question: Question;

    if (round && round.state === 'paused') {
      question = questions[nextIndex];
      deadlineAt = now + (round.remainingMs || 0);
      this.sql.exec(
        `UPDATE rounds SET state = 'active', started_at = ?, deadline_at = ?, remaining_ms = NULL WHERE question_id = ?`,
        now, deadlineAt, question.id
      );
      this.sql.exec(
        `UPDATE room SET status = 'QUESTION_ACTIVE', phase_started_at = ?, phase_deadline_at = ?, countdown_kind = NULL`,
        now, deadlineAt
      );
    } else {
      nextIndex = this.room.currentQuestionIndex + 1;
      if (nextIndex >= TOTAL_QUESTIONS) return;
      question = questions[nextIndex];
      deadlineAt = now + question.durationMs;
      
      this.sql.exec(
        `UPDATE room SET current_question_index = ?, status = 'QUESTION_ACTIVE', phase_started_at = ?, phase_deadline_at = ?, countdown_kind = NULL`,
        nextIndex, now, deadlineAt
      );
      this.sql.exec(
        `INSERT OR REPLACE INTO rounds (question_id, state, started_at, deadline_at, remaining_ms, accumulated_active_ms)
         VALUES (?, 'active', ?, ?, NULL, 0)`,
        question.id, now, deadlineAt
      );
    }
    
    this.incrementVersion();
    this.sql.exec('UPDATE room SET last_state_version = ? WHERE pin = ?', this.room!.roomVersion, this.room!.pin);
    this.room!.lastStateVersion = this.room!.roomVersion;
    this.loadRoom();
    
    // Set deadline alarm
    this.scheduleNextAlarm(deadlineAt);
    
    // Broadcast QUESTION_STARTED with public question (no answer)
    const publicQ = toPublicQuestion(question);
    this.broadcastToAll(createServerEnvelope(
      ServerEventType.QUESTION_STARTED,
      {
        question: publicQ,
        questionIndex: nextIndex,
        questionVersion: nextIndex,
        startedAt: now,
        deadlineAt,
        phaseStartedAt: now,
        phaseDeadlineAt: deadlineAt,
        countdownKind: null,
        ...this.getCanonicalProgress(question.id, now),
      },
      this.room!.roomVersion
    ));
  }

  private endCurrentQuestion(reason: 'all_answered' | 'deadline' | 'host', correlationId?: string): void {
    if (!this.room || this.room.status !== GameState.QUESTION_ACTIVE) return;
    
    const round = this.getCurrentRound();
    if (!round || round.state === 'ended') return;
    
    const now = Date.now();
    const question = questions[this.room.currentQuestionIndex];
    
    // End the round
    this.sql.exec(
      `UPDATE rounds SET state = 'ended', ended_at = ?, end_reason = ? WHERE question_id = ?`,
      now, reason, question.id
    );
    
    // Cancel deadline alarm
    this.ctx.storage.deleteAlarm();
    
    // Calculate distribution
    const answers = this.getAnswersForQuestion(question.id);
    const distribution = question.options.map(opt => {
      const count = answers.filter(a => a.optionId === opt.id).length;
      return {
        optionId: opt.id,
        count,
        percentage: answers.length > 0 ? Math.round((count / answers.length) * 100) : 0,
      };
    });
    
    // Transition to QUESTION_REVEAL
    const revealDeadlineAt = now + REVEAL_DURATION_MS;
    this.transitionTo(GameState.QUESTION_REVEAL, correlationId, {
      phaseStartedAt: now,
      phaseDeadlineAt: revealDeadlineAt,
      countdownKind: null,
    });
    
    // Broadcast QUESTION_ENDED
    this.broadcastToAll(createServerEnvelope(
      ServerEventType.QUESTION_ENDED,
      { reason, questionId: question.id },
      this.room!.roomVersion
    ));
    
    // Broadcast ANSWER_REVEAL (includes correct answer, distribution)
    // To host and screen: full reveal
    // To each player: personal result + correct answer
    const revealBase = {
      questionId: question.id,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
      distribution,
    };
    
    // Broadcast to screens and host
    this.broadcastByRole('host', createServerEnvelope(
      ServerEventType.ANSWER_REVEAL,
      revealBase,
      this.room!.roomVersion
    ));
    this.broadcastByRole('screen', createServerEnvelope(
      ServerEventType.ANSWER_REVEAL,
      revealBase,
      this.room!.roomVersion
    ));
    
    // Send personal results to each player
    const playerSockets = this.getWebSocketsByRole('player');
    for (const pws of playerSockets) {
      const pid = this.getConnectionMeta(pws).playerId;
      if (!pid) continue;
      const playerAnswer = answers.find(a => a.playerId === pid);
      const personalResult = playerAnswer ? {
        correct: playerAnswer.correct,
        selectedOptionId: playerAnswer.optionId,
        awardedPoints: playerAnswer.awardedPoints,
        responseTimeMs: playerAnswer.responseTimeMs,
      } : null;
      
      pws.send(JSON.stringify(createServerEnvelope(
        ServerEventType.ANSWER_REVEAL,
        { ...revealBase, personalResult },
        this.room!.roomVersion
      )));
    }

    // P0.15: Schedule automatic reveal transition to ranking (5 seconds)
    this.scheduleNextAlarm(revealDeadlineAt);
  }

  private handleShowRanking(correlationId?: string): void {
    if (!this.room || this.room.status !== GameState.QUESTION_REVEAL) return;
    
    const isLastQuestion = this.room.currentQuestionIndex >= TOTAL_QUESTIONS - 1;
    const nextState = isLastQuestion ? GameState.FINAL_RANKING : GameState.ROUND_RANKING;
    
    const now = Date.now();
    const phaseDeadlineAt = now + (isLastQuestion ? FINAL_RANKING_DURATION_MS : ROUND_RANKING_DURATION_MS);
    this.transitionTo(nextState, correlationId, {
      phaseStartedAt: now,
      phaseDeadlineAt,
      countdownKind: null,
    });
    
    const ranking = this.computeRanking();
    
    // Broadcast ranking to all (public)
    this.broadcastToAll(createServerEnvelope(
      ServerEventType.RANKING_UPDATED,
      { rankings: ranking, isFinal: isLastQuestion },
      this.room!.roomVersion
    ));

    // P0.17 & P0.19: Schedule next automatic step
    if (isLastQuestion) {
      this.scheduleNextAlarm(phaseDeadlineAt);
    } else {
      this.scheduleNextAlarm(phaseDeadlineAt);
    }
  }

  private handleNextQuestion(correlationId?: string): void {
    if (!this.room || this.room.status !== GameState.ROUND_RANKING) return;
    if (this.room.currentQuestionIndex >= TOTAL_QUESTIONS - 1) return;
    
    const now = Date.now();
    const phaseDeadlineAt = now + COUNTDOWN_DURATION_MS;
    this.transitionTo(GameState.COUNTDOWN, correlationId, {
      phaseStartedAt: now,
      phaseDeadlineAt,
      countdownKind: 'NEXT_QUESTION',
    });
    this.scheduleNextAlarm(phaseDeadlineAt);
  }

  private handleStartPodium(correlationId?: string): void {
    if (!this.room || this.room.status !== GameState.FINAL_RANKING) return;
    
    const now = Date.now();
    const phaseDeadlineAt = now + PODIUM_DURATION_MS;
    this.transitionTo(GameState.PODIUM, correlationId, {
      phaseStartedAt: now,
      phaseDeadlineAt,
      countdownKind: null,
    });
    
    const ranking = this.computeRanking();
    const podium = ranking.slice(0, 3);
    
    this.broadcastToAll(createServerEnvelope(
      ServerEventType.ROOM_FINISHED,
      { podium, fullRanking: ranking, isFinal: true },
      this.room!.roomVersion
    ));

    // P0.21 & P0.22: Schedule automatic transition to FINISHED after ceremony
    this.scheduleNextAlarm(phaseDeadlineAt);
  }

  private handleEndGame(correlationId?: string): void {
    if (!this.room) return;
    const now = Date.now();
    const cleanupAt = now + ROOM_EXPIRY_MS;
    this.sql.exec('UPDATE room SET expires_at = ?', cleanupAt);
    this.transitionTo(GameState.FINISHED, correlationId, {
      phaseStartedAt: now,
      phaseDeadlineAt: cleanupAt,
      countdownKind: null,
    });
    this.ctx.storage.deleteAlarm();
    
    const ranking = this.computeRanking();
    
    this.broadcastToAll(createServerEnvelope(
      ServerEventType.ROOM_FINISHED,
      { fullRanking: ranking, expiresAt: this.room!.expiresAt },
      this.room!.roomVersion
    ));
    
    // Set cleanup alarm
    this.scheduleNextAlarm(cleanupAt);
  }

  private handlePause(correlationId?: string, ws?: WebSocket): void {
    if (!this.room) return;
    const currentStatus = this.room.status;
    if (currentStatus !== GameState.QUESTION_ACTIVE) {
      if (ws) {
        this.sendError(ws, ProtocolError.INVALID_STATE, 'Pause is only permitted during QUESTION_ACTIVE', correlationId);
      }
      return;
    }
    
    const round = this.getCurrentRound();
    if (round) {
      const now = Date.now();
      const remainingMs = Math.max(0, round.deadlineAt - now);
      const activeInThisSegment = Math.max(0, now - round.startedAt);
      const accumulatedActiveMs = round.accumulatedActiveMs + activeInThisSegment;
      
      this.sql.exec(
        `UPDATE rounds SET state = 'paused', remaining_ms = ?, accumulated_active_ms = ? WHERE question_id = ?`,
        remainingMs, accumulatedActiveMs, round.questionId
      );
    }
    
    const pauseNow = Date.now();
    this.transitionTo(GameState.PAUSED, correlationId, {
      phaseStartedAt: pauseNow,
      phaseDeadlineAt: null,
      countdownKind: null,
    });
    this.ensurePresenceAlarmScheduled(pauseNow);
  }

  private handleResume(correlationId?: string): void {
    if (!this.room || this.room.status !== GameState.PAUSED) return;
    
    // Resume triggers countdown, then question resumes with remaining time
    const now = Date.now();
    const phaseDeadlineAt = now + COUNTDOWN_DURATION_MS;
    this.transitionTo(GameState.COUNTDOWN, correlationId, {
      phaseStartedAt: now,
      phaseDeadlineAt,
      countdownKind: 'RESUME',
    });
    
    // After countdown, we'll resume the question with remainingMs
    this.scheduleNextAlarm(phaseDeadlineAt);
  }

  private handleLockEntries(correlationId?: string): void {
    this.setEntryLocked(true);
    this.incrementVersion();
    this.broadcastStateChange(correlationId);
  }

  private handleUnlockEntries(correlationId?: string): void {
    this.setEntryLocked(false);
    this.incrementVersion();
    this.broadcastStateChange(correlationId);
  }

  private handleRemovePlayer(data: { playerId: string } | undefined, correlationId?: string): void {
    if (!data?.playerId) return;
    
    const now = Date.now();
    this.sql.exec(
      'UPDATE players SET removed_at = ? WHERE player_id = ? AND removed_at IS NULL',
      now, data.playerId
    );
    this.sql.exec(
      'UPDATE presence SET connected = 0 WHERE player_id = ?',
      data.playerId
    );
    
    // Close their WebSocket
    this.closeOldConnection(data.playerId);
    
    this.incrementVersion();
    this.broadcastPresenceChange(data.playerId, false, 'removed');
    this.checkAllAnswered();
  }

  // ─── Helper Methods ─────────────────────────

  private loadRoom(): void {
    const rows = this.sql.exec('SELECT * FROM room LIMIT 1').toArray();
    if (rows.length === 0) {
      this.room = null;
      return;
    }
    const r = rows[0];
    this.room = {
      pin: r.pin as string,
      status: r.status as GameState,
      roomVersion: r.room_version as number,
      lastStateVersion: (r.last_state_version as number) ?? 0,
      entryLocked: Boolean(r.entry_locked),
      currentQuestionIndex: r.current_question_index as number,
      createdAt: r.created_at as number,
      expiresAt: r.expires_at as number,
      phaseStartedAt: (r.phase_started_at as number | null) ?? null,
      phaseDeadlineAt: (r.phase_deadline_at as number | null) ?? null,
      countdownKind: (r.countdown_kind as RoomData['countdownKind']) ?? null,
    };
  }

  private getCurrentRound(): (RoundData & { accumulatedActiveMs: number }) | null {
    if (!this.room || this.room.currentQuestionIndex < 0) return null;
    const question = questions[this.room.currentQuestionIndex];
    const rows = this.sql.exec(
      'SELECT * FROM rounds WHERE question_id = ?', question.id
    ).toArray();
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      questionId: r.question_id as string,
      state: r.state as 'active' | 'paused' | 'ended',
      startedAt: r.started_at as number,
      deadlineAt: r.deadline_at as number,
      remainingMs: r.remaining_ms as number | null,
      accumulatedActiveMs: (r.accumulated_active_ms as number) || 0,
      endedAt: r.ended_at as number | null,
      endReason: r.end_reason as RoundData['endReason'],
    };
  }

  private getActivePlayers(): PlayerData[] {
    return this.sql.exec(
      'SELECT * FROM players WHERE removed_at IS NULL'
    ).toArray().map(this.rowToPlayer);
  }

  private rowToPlayer(r: Record<string, unknown>): PlayerData {
    return {
      playerId: r.player_id as string,
      nickname: r.nickname as string,
      tokenHash: r.token_hash as string,
      joinedAt: r.joined_at as number,
      eligibleFromQuestion: r.eligible_from_question as number,
      removedAt: r.removed_at as number | null,
    };
  }

  private getScores(): ScoreData[] {
    return this.sql.exec('SELECT * FROM scores').toArray().map(r => ({
      playerId: r.player_id as string,
      totalPoints: r.total_points as number,
      correctCount: r.correct_count as number,
      correctResponseTimeMs: r.correct_response_time_ms as number,
    }));
  }

  private getAnswersForQuestion(questionId: string): (AnswerData & { responseTimeMs: number })[] {
    return this.sql.exec(
      'SELECT * FROM answers WHERE question_id = ?', questionId
    ).toArray().map(r => ({
      questionId: r.question_id as string,
      playerId: r.player_id as string,
      optionId: r.option_id as string,
      receivedAt: r.received_at as number,
      responseTimeMs: (r.response_time_ms as number) || Math.max(0, (r.received_at as number) - (this.getCurrentRound()?.startedAt || 0)),
      correct: Boolean(r.correct),
      awardedPoints: r.awarded_points as number,
    }));
  }

  private getPresences(): PresenceData[] {
    return this.sql.exec('SELECT * FROM presence').toArray().map(r => ({
      playerId: r.player_id as string,
      connectionId: r.connection_id as string,
      lastSeenAt: r.last_seen_at as number,
      connected: Boolean(r.connected),
    }));
  }

  private getEffectivePresences(now = Date.now()): PresenceData[] {
    const playerSockets = this.getWebSocketsByRole('player');
    const players = this.getActivePlayers();

    return this.getPresences().map(presence => {
      const player = players.find(p => p.playerId === presence.playerId);
      const ws = playerSockets.find(socket => {
        const meta = this.getConnectionMeta(socket);
        return meta.playerId === presence.playerId
          && meta.connectionId === presence.connectionId;
      });

      let lastSeenAt = presence.lastSeenAt;
      if (ws) {
        const metaLastSeenAt = this.getConnectionMeta(ws).lastSeenAt ?? 0;
        const autoResponseLastSeenAt = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
        lastSeenAt = Math.max(presence.lastSeenAt, metaLastSeenAt, autoResponseLastSeenAt);
      }

      const connected = Boolean(ws && isPlayerActive({ ...presence, lastSeenAt }, now));
      const status = getPlayerPresenceStatus(player || { removedAt: null }, { connected, lastSeenAt }, now);

      return {
        ...presence,
        lastSeenAt,
        connected,
        status,
      };
    });
  }

  private computeRanking(): RankingEntry[] {
    const scores = this.getScores();
    const players = this.getActivePlayers();
    return buildRanking(scores, players);
  }

  private getCanonicalProgress(questionId: string, now: number = Date.now()): {
    answeredCount: number;
    totalPlayers: number;
    connectedPlayers: number;
    eligiblePlayers: number;
    activeEligiblePlayers: number;
  } {
    if (!this.room) {
      return {
        answeredCount: 0,
        totalPlayers: 0,
        connectedPlayers: 0,
        eligiblePlayers: 0,
        activeEligiblePlayers: 0,
      };
    }

    const players = this.getActivePlayers();
    const presences = this.getEffectivePresences(now);
    const counts = getRoomPlayerCounts(players, presences, this.room.currentQuestionIndex, now);
    const activeEligibleIds = new Set(
      players
        .filter(player => {
          if (!isPlayerEligible(player, this.room!.currentQuestionIndex)) return false;
          const presence = presences.find(candidate => candidate.playerId === player.playerId);
          return presence ? isPlayerActive(presence, now) : false;
        })
        .map(player => player.playerId)
    );
    const answeredCount = this.getAnswersForQuestion(questionId)
      .filter(answer => activeEligibleIds.has(answer.playerId)).length;

    return { answeredCount, ...counts };
  }

  private isCurrentPhaseDue(now: number): boolean {
    return this.room?.phaseDeadlineAt !== null
      && this.room?.phaseDeadlineAt !== undefined
      && now >= this.room.phaseDeadlineAt;
  }

  private incrementVersion(): void {
    this.sql.exec('UPDATE room SET room_version = room_version + 1');
    this.loadRoom();
  }

  private setEntryLocked(locked: boolean): void {
    this.sql.exec('UPDATE room SET entry_locked = ?', locked ? 1 : 0);
    this.loadRoom();
  }

  private transitionTo(
    newState: GameState,
    correlationId?: string,
    phase: {
      phaseStartedAt: number;
      phaseDeadlineAt: number | null;
      countdownKind: RoomData['countdownKind'];
    } = {
      phaseStartedAt: Date.now(),
      phaseDeadlineAt: null,
      countdownKind: null,
    }
  ): void {
    if (!this.room) return;
    assertTransition(this.room.status, newState);
    this.sql.exec(
      'UPDATE room SET status = ?, phase_started_at = ?, phase_deadline_at = ?, countdown_kind = ?',
      newState, phase.phaseStartedAt, phase.phaseDeadlineAt, phase.countdownKind
    );
    this.incrementVersion();
    this.sql.exec('UPDATE room SET last_state_version = ? WHERE pin = ?', this.room.roomVersion, this.room.pin);
    this.room.lastStateVersion = this.room.roomVersion;
    this.broadcastStateChange(correlationId);
  }

  private checkAllAnswered(): void {
    if (!this.room || this.room.status !== GameState.QUESTION_ACTIVE) return;
    
    const round = this.getCurrentRound();
    if (!round || round.state !== 'active') return;
    
    const question = questions[this.room.currentQuestionIndex];
    const now = Date.now();
    const players = this.getActivePlayers();
    const presences = this.getEffectivePresences(now);
    const answers = this.getAnswersForQuestion(question.id);
    
    const eligibleActivePlayers = players.filter(p => {
      if (!isPlayerEligible(p, this.room!.currentQuestionIndex)) return false;
      const presence = presences.find(pr => pr.playerId === p.playerId);
      if (!presence) return false;
      return isPlayerActive(presence, now);
    });
    
    const allAnswered = eligibleActivePlayers.every(p =>
      answers.some(a => a.playerId === p.playerId)
    );
    
    if (allAnswered && eligibleActivePlayers.length > 0) {
      this.endCurrentQuestion('all_answered');
    }
  }

  private isCanonicalPlayerConnection(playerId: string, connectionId: string): boolean {
    const rows = this.sql.exec(
      'SELECT connection_id FROM presence WHERE player_id = ?',
      playerId,
    ).toArray();
    return rows.length > 0 && rows[0].connection_id === connectionId;
  }

  private markDisconnected(playerId: string, connectionId: string): void {
    this.sql.exec(
      'UPDATE presence SET connected = 0 WHERE player_id = ? AND connection_id = ?',
      playerId, connectionId
    );
  }

  private closeOldConnection(playerId: string): void {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      if (this.getConnectionMeta(ws).playerId === playerId) {
        try { ws.close(1000, 'Replaced by new connection'); } catch { /* ignore */ }
      }
    }
  }

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ─── Broadcasting ───────────────────────────

  private broadcastToAll(envelope: unknown): void {
    const msg = JSON.stringify(envelope);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg); } catch { /* ignore closed */ }
    }
  }

  private broadcastByRole(role: string, envelope: unknown): void {
    const msg = JSON.stringify(envelope);
    for (const ws of this.ctx.getWebSockets()) {
      if (this.getConnectionMeta(ws).role === role) {
        try { ws.send(msg); } catch { /* ignore */ }
      }
    }
  }

  private getWebSocketsByRole(role: string): WebSocket[] {
    return this.ctx.getWebSockets().filter(ws => this.getConnectionMeta(ws).role === role);
  }

  private broadcastStateChange(correlationId?: string): void {
    if (!this.room) return;
    const progress = this.room.currentQuestionIndex >= 0
      ? this.getCanonicalProgress(questions[this.room.currentQuestionIndex].id)
      : {
          answeredCount: 0,
          ...getRoomPlayerCounts(this.getActivePlayers(), this.getEffectivePresences(), this.room.currentQuestionIndex, Date.now()),
        };
    const round = this.getCurrentRound();
    this.broadcastToAll(createServerEnvelope(
      ServerEventType.GAME_STATE_CHANGED,
      {
        state: this.room.status,
        roomVersion: this.room.roomVersion,
        entryLocked: this.room.entryLocked,
        currentQuestionIndex: this.room.currentQuestionIndex,
        gameState: this.room.status,
        phaseStartedAt: this.room.phaseStartedAt,
        phaseDeadlineAt: this.room.phaseDeadlineAt,
        countdownKind: this.room.countdownKind,
        remainingMs: this.room.status === GameState.PAUSED ? round?.remainingMs ?? null : null,
        ...progress,
      },
      this.room.roomVersion,
      correlationId
    ));
  }

  private broadcastPresenceChange(playerId: string, connected: boolean, reason?: string): void {
    if (!this.room) return;
    const now = Date.now();
    const presences = this.getEffectivePresences(now);
    const pr = presences.find(p => p.playerId === playerId);
    const status = pr?.status ?? (connected ? 'CONNECTED' : 'TEMPORARILY_DISCONNECTED');
    const counts = getRoomPlayerCounts(
      this.getActivePlayers(),
      presences,
      this.room.currentQuestionIndex,
      now
    );
    const answeredCount = this.room.currentQuestionIndex >= 0
      ? this.getCanonicalProgress(questions[this.room.currentQuestionIndex].id, now).answeredCount
      : 0;

    this.broadcastToAll(createServerEnvelope(
      ServerEventType.PLAYER_PRESENCE_CHANGED,
      { playerId, connected, status, reason, answeredCount, ...counts },
      this.room.roomVersion
    ));
  }

  private sendSnapshot(ws: WebSocket, role: string, playerId?: string, correlationId?: string): void {
    if (!this.room) return;
    const now = Date.now();
    const activePlayers = this.getActivePlayers();
    const presences = this.getEffectivePresences(now);
    const scores = this.getScores();
    const round = this.getCurrentRound();
    const rankings = this.computeRanking();
    const podium = rankings.slice(0, 3);
    const isLastQuestion = this.room.currentQuestionIndex >= TOTAL_QUESTIONS - 1;
    const counts = getRoomPlayerCounts(activePlayers, presences, this.room.currentQuestionIndex, now);

    const players = activePlayers.map(p => ({
      playerId: p.playerId,
      nickname: p.nickname,
      joinedAt: p.joinedAt,
      eligibleFromQuestion: p.eligibleFromQuestion,
    }));

    let currentQuestion: unknown = null;
    let distribution: unknown[] = [];
    let correctOptionId: string | null = null;
    let explanation: string | null = null;

    if (this.room.currentQuestionIndex >= 0 && this.room.currentQuestionIndex < TOTAL_QUESTIONS) {
      const q = questions[this.room.currentQuestionIndex];
      const answers = this.getAnswersForQuestion(q.id);
      
      const computedDistribution = q.options.map(opt => {
        const count = answers.filter(a => a.optionId === opt.id).length;
        return {
          optionId: opt.id,
          count,
          percentage: answers.length > 0 ? Math.round((count / answers.length) * 100) : 0,
        };
      });

      if (canRevealAnswer(this.room.status)) {
        currentQuestion = q;
        distribution = computedDistribution;
        correctOptionId = q.correctOptionId;
        explanation = q.explanation ?? null;
      } else {
        currentQuestion = toPublicQuestion(q);
        correctOptionId = null;
        explanation = null;
        if ((this.room.status === GameState.QUESTION_ACTIVE || this.room.status === GameState.PAUSED) && role === 'host') {
          distribution = computedDistribution;
        } else {
          distribution = [];
        }
      }
    }

    let personalAnswers: unknown[] = [];
    let personalResult: unknown = null;
    let personalScore: unknown = null;

    if (playerId) {
      personalAnswers = this.sql.exec(
        'SELECT question_id, option_id, received_at, response_time_ms, correct, awarded_points FROM answers WHERE player_id = ?',
        playerId
      ).toArray().map((a: any) => ({
        questionId: a.question_id as string,
        optionId: a.option_id as string,
        receivedAt: a.received_at as number,
        responseTimeMs: a.response_time_ms as number,
        correct: Boolean(a.correct),
        awardedPoints: a.awarded_points as number,
      }));

      const myScore = scores.find(s => s.playerId === playerId);
      const myRank = rankings.find(r => r.playerId === playerId);
      personalScore = {
        totalPoints: myScore?.totalPoints ?? 0,
        correctCount: myScore?.correctCount ?? 0,
        position: myRank?.position ?? 0,
      };

      if (this.room.currentQuestionIndex >= 0 && this.room.currentQuestionIndex < TOTAL_QUESTIONS) {
        const q = questions[this.room.currentQuestionIndex];
        const activeAnswer = (personalAnswers as any[]).find(a => a.questionId === q.id);
        if (activeAnswer) {
          if (canRevealAnswer(this.room.status)) {
            personalResult = {
              correct: activeAnswer.correct,
              selectedOptionId: activeAnswer.optionId,
              awardedPoints: activeAnswer.awardedPoints,
              responseTimeMs: activeAnswer.responseTimeMs,
            };
          }
        } else if (canRevealAnswer(this.room.status)) {
          personalResult = {
            correct: false,
            selectedOptionId: '',
            awardedPoints: 0,
            responseTimeMs: 0,
          };
        }
      }
    }

    const progress = this.room.currentQuestionIndex >= 0
      ? this.getCanonicalProgress(questions[this.room.currentQuestionIndex].id, now)
      : { answeredCount: 0, ...counts };
    const selectedAnswer = this.room.currentQuestionIndex >= 0
      ? (personalAnswers as Array<{ questionId: string; optionId: string }>).find(
          answer => answer.questionId === questions[this.room!.currentQuestionIndex].id
        )
      : undefined;
    const phaseStartedAt = this.room.phaseStartedAt
      ?? (this.room.status === GameState.QUESTION_ACTIVE ? round?.startedAt ?? null : null);
    const phaseDeadlineAt = this.room.phaseDeadlineAt
      ?? (this.room.status === GameState.QUESTION_ACTIVE ? round?.deadlineAt ?? null : null);

    const snapshot = createServerEnvelope(
      ServerEventType.SNAPSHOT,
      {
        room: {
          pin: this.room.pin,
          status: this.room.status,
          roomVersion: this.room.roomVersion,
          lastStateVersion: this.room.lastStateVersion ?? 0,
          entryLocked: this.room.entryLocked,
          currentQuestionIndex: this.room.currentQuestionIndex,
          phaseStartedAt,
          phaseDeadlineAt,
          countdownKind: this.room.countdownKind,
        },
        gameState: this.room.status,
        phaseStartedAt,
        phaseDeadlineAt,
        currentQuestionIndex: this.room.currentQuestionIndex,
        question: currentQuestion,
        questionVersion: this.room.currentQuestionIndex,
        remainingMs: this.room.status === GameState.PAUSED ? round?.remainingMs ?? null : null,
        countdownKind: this.room.countdownKind,
        answerSubmitted: Boolean(selectedAnswer),
        selectedOptionId: selectedAnswer?.optionId ?? null,
        answeredCount: progress.answeredCount,
        totalPlayers: progress.totalPlayers,
        connectedPlayers: progress.connectedPlayers,
        eligiblePlayers: progress.eligiblePlayers,
        activeEligiblePlayers: progress.activeEligiblePlayers,
        players,
        presences,
        scores,
        round,
        currentQuestion,
        distribution,
        correctOptionId,
        explanation,
        rankings,
        podium,
        isFinalRanking: isLastQuestion,
        personalAnswers,
        personalResult,
        personalScore,
        counts: {
          ...progress,
          totalEligible: progress.activeEligiblePlayers,
        },
        playerId,
      },
      this.room.roomVersion,
      correlationId
    );

    ws.send(JSON.stringify(snapshot));
  }

  private sendError(ws: WebSocket, code: string, message: string, correlationId?: string): void {
    const envelope = createServerEnvelope(
      ServerEventType.ERROR,
      { code, message },
      this.room?.roomVersion ?? 0,
      correlationId
    );
    ws.send(JSON.stringify(envelope));
  }

  private sendAnswerRejected(ws: WebSocket, code: string, message: string, correlationId?: string): void {
    const envelope = createServerEnvelope(
      ServerEventType.ANSWER_REJECTED,
      { code, message },
      this.room?.roomVersion ?? 0,
      correlationId
    );
    ws.send(JSON.stringify(envelope));
  }

  private cleanupRoom(): void {
    // PRD p.21: Remove responses, tokens, nicknames after expiry
    this.sql.exec('DELETE FROM answers');
    this.sql.exec('DELETE FROM presence');
    this.sql.exec('DELETE FROM scores');
    this.sql.exec('DELETE FROM commands');
    this.sql.exec('DELETE FROM rounds');
    this.sql.exec('DELETE FROM players');
    this.sql.exec('DELETE FROM room');
    
    // Close all remaining WebSockets
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(1000, 'Room expired'); } catch { /* ignore */ }
    }
  }
}

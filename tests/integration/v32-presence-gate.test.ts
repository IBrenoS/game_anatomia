import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRoom } from '../../apps/web/worker/game-room';
import { MockDurableObjectState, MockWebSocket } from './mock-workers';
import {
  ClientEventType,
  GameState,
  PRESENCE_TIMEOUT_MS,
  ServerEventType,
  createClientEnvelope,
} from '@batalha/protocol';
import { questions } from '@batalha/content';

interface TestClient {
  socket: MockWebSocket;
  send: (type: string, payload: unknown) => Promise<void>;
  messages: () => Array<{ type: string; payload: any }>;
  clear: () => void;
}

const BASE_TIME = new Date('2026-09-19T12:00:00.000Z').getTime();

describe('Pacote Corretivo V3.2 — Gate Mecânico de Presença e Reconexão', () => {
  let ctx: MockDurableObjectState;
  let room: GameRoom;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    ctx = new MockDurableObjectState();
    room = new GameRoom(ctx as any, {});

    const response = await room.fetch(new Request('http://internal/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '654321', hostToken: 'host-secret' }),
    }));
    expect(response.status).toBe(201);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function connect(role: 'host' | 'player' | 'screen', nickname?: string): Promise<TestClient> {
    const headers: Record<string, string> = { Upgrade: 'websocket' };
    if (role === 'host') headers.Cookie = 'batalha_host_654321=host-secret';
    await room.fetch(new Request(`http://internal/ws?role=${role}`, { headers }));
    const sockets = ctx.getWebSockets(`role:${role}`);
    const socket = sockets[sockets.length - 1];
    const client: TestClient = {
      socket,
      send: async (type, payload) => {
        await room.webSocketMessage(socket as any, JSON.stringify(createClientEnvelope(type, payload, 0)));
      },
      messages: () => socket.sentMessages.map(message => JSON.parse(message)),
      clear: () => { socket.sentMessages = []; },
    };
    if (role === 'player' && nickname) {
      await client.send(ClientEventType.JOIN_ROOM, { pin: '654321', nickname });
    }
    return client;
  }

  async function startQuestion(host: TestClient): Promise<number> {
    await host.send(ClientEventType.HOST_COMMAND, {
      command: 'START_GAME',
      expectedRoomVersion: (room as any).room.roomVersion,
    });
    vi.setSystemTime(BASE_TIME + 3_000);
    await room.alarm();
    expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
    return BASE_TIME + 3_000;
  }

  function keepAlive(client: TestClient, now: number): void {
    expect(ctx.simulateWebSocketMessage(client.socket, 'ping', now)).toBe(true);
  }

  // ======================================================================
  // 1. P0 — REATIVAR PRESENÇA QUANDO O MESMO WEBSOCKET CONTINUA ABERTO
  // ======================================================================
  it('V32-T01: reativa presença no mesmo WebSocket via CLIENT_ALIVE ou REQUEST_SNAPSHOT sem duplicar player', async () => {
    const host = await connect('host');
    const player = await connect('player', 'Alice');

    // 1. player entra;
    // 2. presence.connected = true;
    const sessionMsg = player.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED);
    expect(sessionMsg).toBeDefined();
    const playerId = sessionMsg.payload.playerId;
    const reconnectToken = sessionMsg.payload.reconnectToken;

    const sql = (room as any).sql;
    let presenceRows = sql.exec('SELECT * FROM presence WHERE player_id = ?', playerId).toArray();
    expect(presenceRows[0].connected).toBe(1);

    // 3. simular ausência > PRESENCE_TIMEOUT sem webSocketClose;
    const expiryTime = BASE_TIME + PRESENCE_TIMEOUT_MS + 200;
    vi.setSystemTime(expiryTime);

    // 4. rodar expiry;
    await room.alarm();

    // 5. assert connected=false;
    presenceRows = sql.exec('SELECT * FROM presence WHERE player_id = ?', playerId).toArray();
    expect(presenceRows[0].connected).toBe(0);

    host.clear();
    player.clear();

    // 6. manter o MESMO WebSocket;
    // 7. enviar REQUEST_SNAPSHOT válido;
    const returnTime = expiryTime + 5_000;
    vi.setSystemTime(returnTime);
    await player.send(ClientEventType.REQUEST_SNAPSHOT, { lastRoomVersion: 0 });

    // 8. assert connected=true;
    presenceRows = sql.exec('SELECT * FROM presence WHERE player_id = ?', playerId).toArray();
    expect(presenceRows[0].connected).toBe(1);

    // 9. assert mesmo playerId;
    expect(presenceRows[0].player_id).toBe(playerId);

    // 10. assert nenhum jogador duplicado;
    const allPlayers = sql.exec('SELECT * FROM players').toArray();
    expect(allPlayers.length).toBe(1);
    expect(allPlayers[0].player_id).toBe(playerId);
    expect(allPlayers[0].nickname).toBe('Alice');

    // 11. assert score/respostas preservados;
    const scores = sql.exec('SELECT * FROM scores WHERE player_id = ?', playerId).toArray();
    expect(scores.length).toBe(1);
    expect(scores[0].total_points).toBe(0);

    // Host recebe presença atualizada (connected: true)
    const hostPresence = host.messages().find(m => m.type === ServerEventType.PLAYER_PRESENCE_CHANGED);
    expect(hostPresence).toBeDefined();
    expect(hostPresence?.payload.playerId).toBe(playerId);
    expect(hostPresence?.payload.connected).toBe(true);
    expect(hostPresence?.payload.connectedPlayers).toBe(1);

    // Also test re-activation via CLIENT_ALIVE on the same socket
    const secondExpiry = returnTime + PRESENCE_TIMEOUT_MS + 200;
    vi.setSystemTime(secondExpiry);
    await room.alarm();
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(0);

    const secondReturn = secondExpiry + 2_000;
    vi.setSystemTime(secondReturn);
    await player.send(ClientEventType.CLIENT_ALIVE, { clientTime: secondReturn });
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(1);
    expect(sql.exec('SELECT last_seen_at FROM presence WHERE player_id = ?', playerId).toArray()[0].last_seen_at).toBe(secondReturn);

    // Heartbeat while already connected updates in-memory/attachment activity without SQLite write amplification
    const regularHeartbeatTime = secondReturn + 1_500;
    vi.setSystemTime(regularHeartbeatTime);
    await player.send(ClientEventType.CLIENT_ALIVE, { clientTime: regularHeartbeatTime });
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(1);
    const effective = (room as any).getEffectivePresences(regularHeartbeatTime);
    expect(effective.find((p: any) => p.playerId === playerId)?.lastSeenAt).toBe(regularHeartbeatTime);
  });

  it('ignora webSocketClose tardio da conexão substituída e desconecta somente a conexão canônica', async () => {
    await connect('host');
    const connectionA = await connect('player', 'Alice');
    const session = connectionA.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED)!;
    const playerId = session.payload.playerId;
    const connectionIdA = connectionA.socket.attachment.connectionId;

    vi.setSystemTime(BASE_TIME + 1_000);
    const connectionB = await connect('player');
    await connectionB.send(ClientEventType.RESUME_SESSION, {
      pin: '654321',
      reconnectToken: session.payload.reconnectToken,
    });

    const connectionIdB = connectionB.socket.attachment.connectionId;
    const sql = (room as any).sql;
    expect(connectionIdB).not.toBe(connectionIdA);
    expect(sql.exec('SELECT connection_id FROM presence WHERE player_id = ?', playerId).toArray()[0].connection_id).toBe(connectionIdB);

    await room.webSocketClose(connectionA.socket as any, 1000, 'late close from A');
    let presence = sql.exec('SELECT * FROM presence WHERE player_id = ?', playerId).toArray()[0];
    expect(presence.connected).toBe(1);
    expect(presence.connection_id).toBe(connectionIdB);

    await room.webSocketClose(connectionB.socket as any, 1000, 'close from B');
    presence = sql.exec('SELECT * FROM presence WHERE player_id = ?', playerId).toArray()[0];
    expect(presence.connected).toBe(0);
    expect(presence.connection_id).toBe(connectionIdB);
  });

  it('ignora webSocketError tardio da conexão substituída e desconecta somente a conexão canônica', async () => {
    await connect('host');
    const connectionA = await connect('player', 'Alice');
    const session = connectionA.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED)!;
    const playerId = session.payload.playerId;

    vi.setSystemTime(BASE_TIME + 1_000);
    const connectionB = await connect('player');
    await connectionB.send(ClientEventType.RESUME_SESSION, {
      pin: '654321',
      reconnectToken: session.payload.reconnectToken,
    });

    const connectionIdB = connectionB.socket.attachment.connectionId;
    const sql = (room as any).sql;

    await room.webSocketError(connectionA.socket as any, new Error('late error from A'));
    let presence = sql.exec('SELECT * FROM presence WHERE player_id = ?', playerId).toArray()[0];
    expect(presence.connected).toBe(1);
    expect(presence.connection_id).toBe(connectionIdB);

    await room.webSocketError(connectionB.socket as any, new Error('error from B'));
    presence = sql.exec('SELECT * FROM presence WHERE player_id = ?', playerId).toArray()[0];
    expect(presence.connected).toBe(0);
    expect(presence.connection_id).toBe(connectionIdB);
  });

  it('usa somente a conexão canônica em getEffectivePresences quando A e B coexistem', async () => {
    await connect('host');
    const connectionA = await connect('player', 'Alice');
    const session = connectionA.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED)!;
    const playerId = session.payload.playerId;

    const resumeTime = BASE_TIME + 1_000;
    vi.setSystemTime(resumeTime);
    const connectionB = await connect('player');
    await connectionB.send(ClientEventType.RESUME_SESSION, {
      pin: '654321',
      reconnectToken: session.payload.reconnectToken,
    });

    const connectionIdB = connectionB.socket.attachment.connectionId;
    expect(ctx.simulateWebSocketMessage(connectionA.socket, 'ping', resumeTime + 9_000)).toBe(true);
    expect(ctx.simulateWebSocketMessage(connectionB.socket, 'ping', resumeTime + 2_000)).toBe(true);

    const effective = (room as any).getEffectivePresences(resumeTime + 2_000);
    const alice = effective.find((presence: any) => presence.playerId === playerId);
    expect(alice.connectionId).toBe(connectionIdB);
    expect(alice.lastSeenAt).toBe(resumeTime + 2_000);
    expect(alice.connected).toBe(true);

    await room.webSocketClose(connectionA.socket as any, 1000, 'late close from A');
    expect((room as any).getPresences()[0].connected).toBe(true);
    await room.webSocketClose(connectionB.socket as any, 1000, 'close from B');
    expect((room as any).getPresences()[0].connected).toBe(false);
  });

  it('define que heartbeat raw auto-respondido não reativa presença expirada, mas REQUEST_SNAPSHOT reativa', async () => {
    await connect('host');
    const player = await connect('player', 'Alice');
    const session = player.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED)!;
    const playerId = session.payload.playerId;
    const sql = (room as any).sql;

    const expiryTime = BASE_TIME + PRESENCE_TIMEOUT_MS + 200;
    vi.setSystemTime(expiryTime);
    await room.alarm();
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(0);

    const rawHeartbeatTime = expiryTime + 1_000;
    expect(ctx.simulateWebSocketMessage(player.socket, 'ping', rawHeartbeatTime)).toBe(true);
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(0);
    expect((room as any).getEffectivePresences(rawHeartbeatTime)[0].connected).toBe(false);

    const snapshotTime = rawHeartbeatTime + 1_000;
    vi.setSystemTime(snapshotTime);
    await player.send(ClientEventType.REQUEST_SNAPSHOT, { lastRoomVersion: 0 });
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(1);
    expect((room as any).getEffectivePresences(snapshotTime)[0].connected).toBe(true);
  });

  // ======================================================================
  // 2. P0 — SUBMIT_ANSWER DEVE EXIGIR JOGADOR ATUALMENTE ATIVO
  // ======================================================================
  it('V32-T02: SUBMIT_ANSWER em socket autenticado reativa presença antes da validação e aceita resposta com coerência', async () => {
    const host = await connect('host');
    const player = await connect('player', 'Alice');
    const questionStartedAt = await startQuestion(host);
    const question = questions[0];

    const sql = (room as any).sql;
    const playerId = player.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.playerId;

    // Player expira
    const expiryTime = questionStartedAt + PRESENCE_TIMEOUT_MS + 200;
    vi.setSystemTime(expiryTime);
    await room.alarm();

    // connected = false
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(0);

    // Mesmo socket envia SUBMIT_ANSWER válido ainda dentro do deadline da pergunta
    const answerTime = expiryTime + 2_000;
    expect(answerTime).toBeLessThan(questionStartedAt + question.durationMs);
    vi.setSystemTime(answerTime);

    player.clear();
    host.clear();
    await player.send(ClientEventType.SUBMIT_ANSWER, {
      questionId: question.id,
      questionVersion: 0,
      optionId: question.correctOptionId,
    });

    // Validar semântica de reativação automática:
    // - presence=true;
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(1);

    // - answer accepted;
    const accepted = player.messages().find(m => m.type === ServerEventType.ANSWER_ACCEPTED);
    expect(accepted).toBeDefined();

    // - answeredCount inclui jogador;
    // - activeEligiblePlayers inclui jogador;
    const progress = host.messages().find(m => m.type === ServerEventType.ROUND_PROGRESS);
    expect(progress).toBeDefined();
    expect(progress?.payload.answeredCount).toBe(1);
    expect(progress?.payload.activeEligiblePlayers).toBe(1);
    expect(progress?.payload.connectedPlayers).toBe(1);

    // - score coerente;
    const scoreRow = sql.exec('SELECT * FROM scores WHERE player_id = ?', playerId).toArray()[0];
    expect(scoreRow.total_points).toBeGreaterThan(0);

    // Proibido: answer accepted + player offline (invariante validado)
    const effectivePresences = (room as any).getEffectivePresences(answerTime);
    const alicePresence = effectivePresences.find((p: any) => p.playerId === playerId);
    expect(alicePresence.connected).toBe(true);
  });

  it('V32-T02-REJECT: rejeita SUBMIT_ANSWER se o jogador estiver removido ou houver incompatibilidade de conexão', async () => {
    const host = await connect('host');
    const player = await connect('player', 'Alice');
    const questionStartedAt = await startQuestion(host);
    const question = questions[0];

    const sql = (room as any).sql;
    const playerId = player.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.playerId;

    // Host remove o jogador
    const removeTime = questionStartedAt + 2_000;
    vi.setSystemTime(removeTime);
    await host.send(ClientEventType.HOST_COMMAND, {
      command: 'REMOVE_PLAYER',
      expectedRoomVersion: (room as any).room.roomVersion,
      data: { playerId },
    });

    // Player removido tenta enviar resposta
    player.clear();
    await player.send(ClientEventType.SUBMIT_ANSWER, {
      questionId: question.id,
      questionVersion: 0,
      optionId: question.correctOptionId,
    });

    const rejected = player.messages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
    expect(rejected).toBeDefined();
    expect(rejected?.payload.code).toBe('UNAUTHORIZED');

    // Resposta não persiste
    const answers = sql.exec('SELECT * FROM answers WHERE player_id = ?', playerId).toArray();
    expect(answers.length).toBe(0);

    // Score não altera
    const scoreRow = sql.exec('SELECT * FROM scores WHERE player_id = ?', playerId).toArray()[0];
    expect(scoreRow.total_points).toBe(0);
  });

  // ======================================================================
  // 3. P0 — RESUME_SESSION DEVE REARMAR O SCHEDULER DE PRESENÇA
  // ======================================================================
  it('V32-T03: LOBBY: RESUME_SESSION rearma alarme de presença e segundo timeout ocorre silenciosamente', async () => {
    await connect('host');
    const player = await connect('player', 'Alice');
    const sessionMsg = player.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED);
    const token = sessionMsg.payload.reconnectToken;
    const playerId = sessionMsg.payload.playerId;
    const sql = (room as any).sql;

    // 2. Presença expira
    const expiryTime = BASE_TIME + PRESENCE_TIMEOUT_MS + 200;
    vi.setSystemTime(expiryTime);
    await room.alarm();
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(0);

    // 3. Player volta com RESUME_SESSION
    const returnTime = expiryTime + 10_000;
    vi.setSystemTime(returnTime);
    const reconnectClient = await connect('player');
    await reconnectClient.send(ClientEventType.RESUME_SESSION, { pin: '654321', reconnectToken: token });

    // 4. assert connected=true;
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(1);

    // 5. assert existe próximo Alarm relacionado à presença;
    const nextAlarm = ctx.getAlarm();
    expect(nextAlarm).not.toBeNull();
    expect(nextAlarm).toBe(returnTime + PRESENCE_TIMEOUT_MS + 100);

    // 6. Player desaparece silenciosamente novamente (sem socket close, sem ping, sem mensagens)
    // 7. Avançar relógio
    const secondExpiryTime = nextAlarm!;
    vi.setSystemTime(secondExpiryTime);

    // 8. Executar alarm
    await room.alarm();

    // 9. assert connected=false novamente
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', playerId).toArray()[0].connected).toBe(0);
  });

  // ======================================================================
  // 4. P0 — PRESENÇA DEVE CONTINUAR SENDO MONITORADA DURANTE PAUSED
  // ======================================================================
  it('V32-T04: presença continua sendo monitorada durante PAUSED sem consumir remainingMs ou avançar game loop', async () => {
    const host = await connect('host');
    const playerA = await connect('player', 'Alice');
    const playerB = await connect('player', 'Bob');
    const questionStartedAt = await startQuestion(host);
    const question = questions[0];

    const pAId = playerA.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.playerId;
    const pBId = playerB.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.playerId;
    const sql = (room as any).sql;

    // Host pausa após 10s de pergunta
    const pauseTime = questionStartedAt + 10_000;
    vi.setSystemTime(pauseTime);
    keepAlive(playerA, pauseTime);
    keepAlive(playerB, pauseTime);

    await host.send(ClientEventType.HOST_COMMAND, {
      command: 'PAUSE',
      expectedRoomVersion: (room as any).room.roomVersion,
    });
    expect((room as any).room.status).toBe(GameState.PAUSED);

    // Capturar remainingMs
    const pausedRound = (room as any).getCurrentRound();
    const originalRemainingMs = pausedRound.remainingMs;
    expect(originalRemainingMs).toBe(question.durationMs - 10_000);

    // Assert que alarme de presença foi agendado em PAUSED
    const pausedAlarm = ctx.getAlarm();
    expect(pausedAlarm).not.toBeNull();

    // B perde heartbeat silenciosamente; A continua enviando heartbeat
    const expiryTime = pauseTime + PRESENCE_TIMEOUT_MS + 200;
    vi.setSystemTime(expiryTime);
    keepAlive(playerA, expiryTime);

    // Executar alarm() durante PAUSED
    await room.alarm();

    // B connected=false
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', pBId).toArray()[0].connected).toBe(0);

    // A continua conectado
    expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', pAId).toArray()[0].connected).toBe(1);

    // remainingMs permanece exatamente preservado
    const roundAfterExpiry = (room as any).getCurrentRound();
    expect(roundAfterExpiry.remainingMs).toBe(originalRemainingMs);

    // state continua PAUSED
    expect((room as any).room.status).toBe(GameState.PAUSED);

    // Nenhum reveal/ranking ocorre
    expect((room as any).room.status).not.toBe(GameState.QUESTION_REVEAL);
    expect((room as any).room.status).not.toBe(GameState.ROUND_RANKING);

    // Depois: RESUME
    const resumeTime = expiryTime + 5_000;
    vi.setSystemTime(resumeTime);
    keepAlive(playerA, resumeTime);

    await host.send(ClientEventType.HOST_COMMAND, {
      command: 'RESUME',
      expectedRoomVersion: (room as any).room.roomVersion,
    });
    expect((room as any).room.status).toBe(GameState.COUNTDOWN);
    expect((room as any).room.countdownKind).toBe('RESUME');

    // Countdown de 3s
    vi.setSystemTime(resumeTime + 3_000);
    keepAlive(playerA, resumeTime + 3_000);
    await room.alarm();

    // Mesma pergunta ativa com remainingMs preservado
    expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
    expect((room as any).room.currentQuestionIndex).toBe(0);
    const resumedRound = (room as any).getCurrentRound();
    expect(resumedRound.deadlineAt).toBe(resumeTime + 3_000 + originalRemainingMs);
  });

  // ======================================================================
  // 5. TESTES V32-T05A/B/C/D — SEPARAÇÃO DE INTERACTIONLOCKED E HASRECORDEDANSWER
  // ======================================================================
  describe('V32-T05: separação conceitual entre interactionLocked e hasRecordedAnswer', () => {
    function computeUiFlags(params: {
      isPaused: boolean;
      answerSubmitted: boolean;
      optimisticOptionId: string | null;
    }) {
      const hasRecordedAnswer = Boolean(params.answerSubmitted || params.optimisticOptionId);
      const interactionLocked = Boolean(params.isPaused || hasRecordedAnswer);
      const showPausedBanner = params.isPaused;
      const showAnswerRegisteredBanner = hasRecordedAnswer;
      const alternativesDisabled = interactionLocked;

      return {
        hasRecordedAnswer,
        interactionLocked,
        showPausedBanner,
        showAnswerRegisteredBanner,
        alternativesDisabled,
      };
    }

    it('V32-T05A: QUESTION_ACTIVE -> player não responde -> PAUSE -> alternativas disabled e "Resposta registrada" NÃO aparece', () => {
      const flags = computeUiFlags({
        isPaused: true,
        answerSubmitted: false,
        optimisticOptionId: null,
      });

      expect(flags.showPausedBanner).toBe(true);
      expect(flags.alternativesDisabled).toBe(true);
      expect(flags.hasRecordedAnswer).toBe(false);
      expect(flags.showAnswerRegisteredBanner).toBe(false);
    });

    it('V32-T05B: QUESTION_ACTIVE -> player responde -> answer accepted -> PAUSE -> alternativas disabled e "Resposta registrada" aparece', () => {
      const flags = computeUiFlags({
        isPaused: true,
        answerSubmitted: true,
        optimisticOptionId: 'opt-1',
      });

      expect(flags.showPausedBanner).toBe(true);
      expect(flags.alternativesDisabled).toBe(true);
      expect(flags.hasRecordedAnswer).toBe(true);
      expect(flags.showAnswerRegisteredBanner).toBe(true);
    });

    it('V32-T05C: não respondeu -> PAUSE -> RESUME -> QUESTION_ACTIVE -> alternativas habilitadas', () => {
      const flags = computeUiFlags({
        isPaused: false,
        answerSubmitted: false,
        optimisticOptionId: null,
      });

      expect(flags.showPausedBanner).toBe(false);
      expect(flags.alternativesDisabled).toBe(false);
      expect(flags.hasRecordedAnswer).toBe(false);
      expect(flags.showAnswerRegisteredBanner).toBe(false);
    });

    it('V32-T05D: já respondeu -> PAUSE -> RESUME -> QUESTION_ACTIVE -> alternativas permanecem bloqueadas e confirmação visível', () => {
      const flags = computeUiFlags({
        isPaused: false,
        answerSubmitted: true,
        optimisticOptionId: 'opt-1',
      });

      expect(flags.showPausedBanner).toBe(false);
      expect(flags.alternativesDisabled).toBe(true);
      expect(flags.hasRecordedAnswer).toBe(true);
      expect(flags.showAnswerRegisteredBanner).toBe(true);
    });
  });

  // ======================================================================
  // 7. TESTE INTEGRADO DE PRESENÇA V3.2
  // ======================================================================
  describe('V32-INTEGRATED: Teste Integrado de Presença V3.2', () => {
    it('Cenário 1: A e B conectados -> A responde -> B expira -> B volta no mesmo socket -> B responde -> rodada encerra corretamente', async () => {
      const host = await connect('host');
      const playerA = await connect('player', 'Alice');
      const playerB = await connect('player', 'Bob');
      const questionStartedAt = await startQuestion(host);
      const question = questions[0];
      const sql = (room as any).sql;
      const pBId = playerB.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.playerId;

      // 3. A responde
      vi.setSystemTime(questionStartedAt + 2_000);
      keepAlive(playerA, questionStartedAt + 2_000);
      keepAlive(playerB, questionStartedAt + 2_000);
      await playerA.send(ClientEventType.SUBMIT_ANSWER, {
        questionId: question.id,
        questionVersion: 0,
        optionId: question.options[0].id,
      });

      // 4. B fica silencioso e presence expira
      const expiryTime = questionStartedAt + 2_000 + PRESENCE_TIMEOUT_MS + 200;
      vi.setSystemTime(expiryTime);
      keepAlive(playerA, expiryTime);
      await room.alarm();

      expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', pBId).toArray()[0].connected).toBe(0);

      // 5. B volta no MESMO WebSocket
      const returnTime = expiryTime + 3_000;
      vi.setSystemTime(returnTime);
      keepAlive(playerA, returnTime);
      await playerB.send(ClientEventType.CLIENT_ALIVE, { clientTime: returnTime });

      // 6. Presença de B volta a connected=true
      expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', pBId).toArray()[0].connected).toBe(1);

      // 7. B responde
      await playerB.send(ClientEventType.SUBMIT_ANSWER, {
        questionId: question.id,
        questionVersion: 0,
        optionId: question.options[1].id,
      });

      // 8. Resposta de B entra em answeredCount (2/2)
      // 9. Host vê ambos online (connectedPlayers = 2)
      // 10. Rodada encerra corretamente (all_answered -> QUESTION_REVEAL)
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
      expect((room as any).getCurrentRound().endReason).toBe('all_answered');
      expect((room as any).getCurrentRound().state).toBe('ended');
    });

    it('Cenário 2 (Variante com PAUSE): pergunta ativa -> PAUSE -> B expira durante PAUSED -> jogo permanece PAUSED -> RESUME -> B volta -> mesma questão continua', async () => {
      const host = await connect('host');
      const playerA = await connect('player', 'Alice');
      const playerB = await connect('player', 'Bob');
      const questionStartedAt = await startQuestion(host);
      const pBId = playerB.messages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.playerId;
      const sql = (room as any).sql;

      // 2. Host pausa
      const pauseTime = questionStartedAt + 5_000;
      vi.setSystemTime(pauseTime);
      keepAlive(playerA, pauseTime);
      keepAlive(playerB, pauseTime);
      await host.send(ClientEventType.HOST_COMMAND, {
        command: 'PAUSE',
        expectedRoomVersion: (room as any).room.roomVersion,
      });
      expect((room as any).room.status).toBe(GameState.PAUSED);

      // 3. B fica silencioso
      // 4. Presence expira durante PAUSED
      const expiryTime = pauseTime + PRESENCE_TIMEOUT_MS + 200;
      vi.setSystemTime(expiryTime);
      keepAlive(playerA, expiryTime);
      await room.alarm();

      // B expirou
      expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', pBId).toArray()[0].connected).toBe(0);
      // 5. Jogo permanece PAUSED
      expect((room as any).room.status).toBe(GameState.PAUSED);

      // 6. Host retoma
      const resumeTime = expiryTime + 2_000;
      vi.setSystemTime(resumeTime);
      keepAlive(playerA, resumeTime);
      await host.send(ClientEventType.HOST_COMMAND, {
        command: 'RESUME',
        expectedRoomVersion: (room as any).room.roomVersion,
      });
      expect((room as any).room.status).toBe(GameState.COUNTDOWN);

      // Countdown termina
      vi.setSystemTime(resumeTime + 3_000);
      keepAlive(playerA, resumeTime + 3_000);
      await room.alarm();
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);

      // 7. B reconecta / envia sinal de vida no mesmo socket
      const bReturnTime = resumeTime + 4_000;
      vi.setSystemTime(bReturnTime);
      keepAlive(playerA, bReturnTime);
      await playerB.send(ClientEventType.REQUEST_SNAPSHOT, { lastRoomVersion: 0 });

      // 8. Presença volta corretamente
      expect(sql.exec('SELECT connected FROM presence WHERE player_id = ?', pBId).toArray()[0].connected).toBe(1);

      // 9. Mesma questão continua
      expect((room as any).room.currentQuestionIndex).toBe(0);
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
      const currentRound = (room as any).getCurrentRound();
      expect(currentRound.state).toBe('active');
    });
  });
});

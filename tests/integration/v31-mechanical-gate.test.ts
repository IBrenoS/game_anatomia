import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRoom } from '../../apps/web/worker/game-room';
import { MockDurableObjectState, MockWebSocket } from './mock-workers';
import {
  ClientEventType,
  GameState,
  HostCommandSchema,
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

describe('Pacote Corretivo V3.1 — gate mecânico', () => {
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

  it('T31/T32: permanece ativa em 10s, 30s e 59.999s e encerra exatamente em 60s', async () => {
    const host = await connect('host');
    const player = await connect('player', 'Alice');
    const questionStartedAt = await startQuestion(host);

    for (const elapsed of [10_000, 30_000, 59_999]) {
      const now = questionStartedAt + elapsed;
      vi.setSystemTime(now);
      keepAlive(player, now);
      await room.alarm();
      expect((room as any).room.status, `estado em ${elapsed}ms`).toBe(GameState.QUESTION_ACTIVE);
    }

    vi.setSystemTime(questionStartedAt + 60_000);
    await room.alarm();
    expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
    expect((room as any).getCurrentRound().endReason).toBe('deadline');
  });

  it('T33: expiração silenciosa pode fechar por allAnswered antes do deadline', async () => {
    const host = await connect('host');
    const alice = await connect('player', 'Alice');
    const bob = await connect('player', 'Bob');
    await connect('player', 'Carol');
    const questionStartedAt = await startQuestion(host);
    const question = questions[0];

    await alice.send(ClientEventType.SUBMIT_ANSWER, {
      questionId: question.id,
      questionVersion: 0,
      optionId: question.options[0].id,
    });
    await bob.send(ClientEventType.SUBMIT_ANSWER, {
      questionId: question.id,
      questionVersion: 0,
      optionId: question.options[1].id,
    });
    expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);

    const expiryTime = BASE_TIME + PRESENCE_TIMEOUT_MS + 101;
    vi.setSystemTime(expiryTime);
    keepAlive(alice, expiryTime);
    keepAlive(bob, expiryTime);
    await room.alarm();

    expect(expiryTime).toBeLessThan(questionStartedAt + 60_000);
    expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
    expect((room as any).getCurrentRound().endReason).toBe('all_answered');
  });

  it('T36/T37: resume countdown expõe phaseDeadlineAt próprio, sem reutilizar deadline da pergunta', async () => {
    const host = await connect('host');
    await connect('player', 'Alice');
    const questionStartedAt = await startQuestion(host);
    const originalDeadline = questionStartedAt + 60_000;

    vi.setSystemTime(questionStartedAt + 5_000);
    await host.send(ClientEventType.HOST_COMMAND, {
      command: 'PAUSE',
      expectedRoomVersion: (room as any).room.roomVersion,
    });
    await host.send(ClientEventType.HOST_COMMAND, {
      command: 'RESUME',
      expectedRoomVersion: (room as any).room.roomVersion,
    });
    host.clear();
    await host.send(ClientEventType.REQUEST_SNAPSHOT, { lastRoomVersion: 0 });

    const snapshot = host.messages().find(message => message.type === ServerEventType.SNAPSHOT);
    expect(snapshot?.payload.gameState).toBe(GameState.COUNTDOWN);
    expect(snapshot?.payload.countdownKind).toBe('RESUME');
    expect(snapshot?.payload.phaseStartedAt).toBe(questionStartedAt + 5_000);
    expect(snapshot?.payload.phaseDeadlineAt).toBe(questionStartedAt + 8_000);
    expect(snapshot?.payload.phaseDeadlineAt).not.toBe(originalDeadline);
  });

  it('T38/T41: snapshot ativo contém progresso e os quatro contadores canônicos', async () => {
    const host = await connect('host');
    const alice = await connect('player', 'Alice');
    await connect('player', 'Bob');
    await startQuestion(host);
    const question = questions[0];
    await alice.send(ClientEventType.SUBMIT_ANSWER, {
      questionId: question.id,
      questionVersion: 0,
      optionId: question.options[0].id,
    });

    host.clear();
    await host.send(ClientEventType.REQUEST_SNAPSHOT, { lastRoomVersion: 0 });
    const snapshot = host.messages().find(message => message.type === ServerEventType.SNAPSHOT);

    expect(snapshot?.payload.gameState).toBe(GameState.QUESTION_ACTIVE);
    expect(snapshot?.payload.questionVersion).toBe(0);
    expect(snapshot?.payload.answeredCount).toBe(1);
    expect(snapshot?.payload.totalPlayers).toBe(2);
    expect(snapshot?.payload.connectedPlayers).toBe(2);
    expect(snapshot?.payload.eligiblePlayers).toBe(2);
    expect(snapshot?.payload.activeEligiblePlayers).toBe(2);
  });

  it('T43: comandos de avanço manual não pertencem ao protocolo público', () => {
    for (const command of ['SHOW_RANKING', 'NEXT_QUESTION', 'START_PODIUM', 'COMPLETE_GAME']) {
      expect(HostCommandSchema.safeParse({ command, expectedRoomVersion: 0 }).success).toBe(false);
    }
  });
});

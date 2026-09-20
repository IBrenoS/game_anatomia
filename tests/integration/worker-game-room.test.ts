import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameRoom } from '../../apps/web/worker/game-room';
import worker from '../../apps/web/worker/index';
import {
  MockDurableObjectState,
  MockWebSocket,
} from './mock-workers';
import {
  GameState,
  ProtocolError,
  ServerEventType,
  createClientEnvelope,
  TOTAL_QUESTIONS,
} from '@batalha/protocol';
import { questions } from '@batalha/content';
import { getRoomPlayerCounts } from '@batalha/game';

interface WsTestClient {
  server: MockWebSocket;
  client: MockWebSocket;
  send: (envelope: any) => Promise<void>;
  getLastMessage: () => any;
  getAllMessages: () => any[];
  clearMessages: () => void;
}

function attachTestClient(room: GameRoom, serverWs: MockWebSocket, clientWs: MockWebSocket): WsTestClient {
  return {
    server: serverWs,
    client: clientWs,
    send: async (envelope: any) => {
      await room.webSocketMessage(serverWs as any, JSON.stringify(envelope));
    },
    getLastMessage: () => {
      const msgs = serverWs.sentMessages;
      return msgs.length > 0 ? JSON.parse(msgs[msgs.length - 1]) : null;
    },
    getAllMessages: () => {
      return serverWs.sentMessages.flatMap(message => {
        try {
          return [JSON.parse(message)];
        } catch {
          return [];
        }
      });
    },
    clearMessages: () => {
      serverWs.sentMessages = [];
    },
  };
}

describe('Worker & Durable Object Integration Suite (P3.2)', () => {
  let ctx: MockDurableObjectState;
  let room: GameRoom;
  const testPin = '654321';
  const testHostToken = 'host-secret-xyz';

  function createHostRequest(pin: string = testPin, token: string = testHostToken): Request {
    return new Request('http://internal/ws?role=host', {
      headers: {
        Upgrade: 'websocket',
        Cookie: `batalha_host_${pin}=${token}`,
      },
    });
  }

  beforeEach(async () => {
    ctx = new MockDurableObjectState();
    room = new GameRoom(ctx as any, {});

    // Initialize room
    const initReq = new Request('http://internal/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: testPin, hostToken: testHostToken }),
    });
    const res = await room.fetch(initReq);
    expect(res.status).toBe(201);
  });

  async function runNextAlarm(): Promise<void> {
    const scheduledAt = (room as any).room?.phaseDeadlineAt ?? ctx.getAlarm();
    expect(scheduledAt).not.toBeNull();
    for (const socket of ctx.getWebSockets('role:player')) {
      ctx.simulateWebSocketMessage(socket, 'ping', scheduledAt!);
    }
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(scheduledAt!);
    try {
      await room.alarm();
    } finally {
      nowSpy.mockRestore();
    }
  }

  async function runScheduledAlarmWithoutHeartbeat(): Promise<void> {
    const scheduledAt = ctx.getAlarm();
    expect(scheduledAt).not.toBeNull();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(scheduledAt!);
    try {
      await room.alarm();
    } finally {
      nowSpy.mockRestore();
    }
  }

  async function runPhaseAlarmWithoutHeartbeat(): Promise<void> {
    const scheduledAt = (room as any).room?.phaseDeadlineAt;
    expect(scheduledAt).not.toBeNull();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(scheduledAt!);
    try {
      await room.alarm();
    } finally {
      nowSpy.mockRestore();
    }
  }

  describe('Worker HTTP API & Security (P1.8, P1.9)', () => {
    it('creates room with PIN, hostToken, joinUrl, and HttpOnly cookie', async () => {
      let createdPin = '';
      const mockEnv: any = {
        GAME_ROOM: {
          idFromName: (pin: string) => ({ toString: () => pin }),
          get: (id: any) => ({
            fetch: async (req: Request) => {
              if (req.url.endsWith('/init')) {
                const body = await req.json() as any;
                createdPin = body.pin;
                return new Response(JSON.stringify({ ok: true }), { status: 201 });
              }
              return new Response(null, { status: 404 });
            },
          }),
        },
      };

      const req = new Request('http://localhost:8787/api/rooms', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '10.0.0.1' },
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(201);
      const data = await res.json() as any;
      expect(data.pin).toBeDefined();
      expect(data.pin.length).toBe(6);
      expect(data.hostToken).toBeUndefined();
      expect(data.joinUrl).toContain(data.pin);

      // Verify HttpOnly cookie
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain(`batalha_host_${data.pin}=`);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
    });

    it('rejects oversized HTTP payloads (>32KB) with 413 (P1.9)', async () => {
      const mockEnv: any = { GAME_ROOM: {} };
      const req = new Request('http://localhost:8787/api/rooms', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '10.0.0.2',
          'content-length': '35000',
        },
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(413);
      const data = await res.json() as any;
      expect(data.error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rate limits room creation (>10 requests/minute per IP) with 429 (P1.9)', async () => {
      const mockEnv: any = {
        GAME_ROOM: {
          idFromName: (pin: string) => pin,
          get: () => ({
            fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 201 }),
          }),
        },
      };

      const ip = '192.168.100.99';
      // First 10 requests should succeed
      for (let i = 0; i < 10; i++) {
        const req = new Request('http://localhost:8787/api/rooms', {
          method: 'POST',
          headers: { 'cf-connecting-ip': ip },
        });
        const res = await worker.fetch(req, mockEnv, {} as any);
        expect(res.status).toBe(201);
      }

      // 11th request from same IP must be rate limited
      const req11 = new Request('http://localhost:8787/api/rooms', {
        method: 'POST',
        headers: { 'cf-connecting-ip': ip },
      });
      const res11 = await worker.fetch(req11, mockEnv, {} as any);
      expect(res11.status).toBe(429);
      const data11 = await res11.json() as any;
      expect(data11.error).toBe('RATE_LIMITED');
    });

    it('returns room status via GET /api/rooms/:pin', async () => {
      const mockEnv: any = {
        GAME_ROOM: {
          idFromName: (pin: string) => pin,
          get: () => ({
            fetch: async (req: Request) => {
              return room.fetch(req);
            },
          }),
        },
      };

      const req = new Request(`http://localhost:8787/api/rooms/${testPin}`, { method: 'GET' });
      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.pin).toBe(testPin);
      expect(data.status).toBe('LOBBY');
      expect(data.playerCount).toBe(0);
    });
  });

  describe('P0.1 WebSocket Upgrade & Immediate Snapshot', () => {
    it('configures hibernation-safe automatic ping/pong without waking the Durable Object', () => {
      const autoResponse = ctx.getWebSocketAutoResponse();

      expect(autoResponse?.getRequest()).toBe('ping');
      expect(autoResponse?.getResponse()).toBe('pong');
    });

    it('sends immediate SNAPSHOT to newly connected host with cookie token', async () => {
      const hostReq = createHostRequest();
      const res = await room.fetch(hostReq);
      expect(res.status).toBe(101);

      // Find the server WebSocket in ctx
      const hostSockets = ctx.getWebSockets('role:host');
      expect(hostSockets).toHaveLength(1);
      const hostWs = hostSockets[0];

      // Verify SNAPSHOT was sent immediately
      expect(hostWs.sentMessages.length).toBeGreaterThanOrEqual(1);
      const firstMsg = JSON.parse(hostWs.sentMessages[0]);
      expect(firstMsg.type).toBe(ServerEventType.SNAPSHOT);
      expect(firstMsg.payload.room.pin).toBe(testPin);
      expect(firstMsg.payload.room.status).toBe(GameState.LOBBY);
      expect(firstMsg.payload.players).toEqual([]);
    });

    it('sends immediate SNAPSHOT to newly connected screen without token', async () => {
      const screenReq = new Request('http://internal/ws?role=screen', {
        headers: { Upgrade: 'websocket' },
      });
      const res = await room.fetch(screenReq);
      expect(res.status).toBe(101);

      const screenSockets = ctx.getWebSockets('role:screen');
      expect(screenSockets).toHaveLength(1);
      const screenWs = screenSockets[0];

      expect(screenWs.sentMessages.length).toBeGreaterThanOrEqual(1);
      const firstMsg = JSON.parse(screenWs.sentMessages[0]);
      expect(firstMsg.type).toBe(ServerEventType.SNAPSHOT);
      expect(firstMsg.payload.room.status).toBe(GameState.LOBBY);
    });

    it('T18: accepts host authentication exclusively via HttpOnly cookie', async () => {
      const hostReq = createHostRequest();
      const res = await room.fetch(hostReq);
      expect(res.status).toBe(101);
    });

    it('T17: rejects host connection via query param token without cookie with 401', async () => {
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, {
        headers: { Upgrade: 'websocket' },
      });
      const res = await room.fetch(hostReq);
      expect(res.status).toBe(401);
    });

    it('rejects unauthorized host connection with 401', async () => {
      const hostReq = createHostRequest(testPin, 'invalid-token');
      const res = await room.fetch(hostReq);
      expect(res.status).toBe(401);
    });
  });

  describe('P0.2 Player Lifecycle, Presence, Reconnection & Duplicate Nicknames', () => {
    let hostClient: WsTestClient;

    beforeEach(async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostServer = ctx.getWebSockets('role:host')[0];
      hostClient = attachTestClient(room, hostServer, hostServer.peer!);
      hostClient.clearMessages();
    });

    it('registers player, broadcasts PLAYER_JOINED, and rejects duplicate nicknames', async () => {
      // 1. Connect player Alice
      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Server = ctx.getWebSockets('role:player')[0];
      const p1Client = attachTestClient(room, p1Server, p1Server.peer!);

      // Send JOIN_ROOM
      await p1Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p1Msgs = p1Client.getAllMessages();
      const sessionAccepted = p1Msgs.find(m => m.type === ServerEventType.SESSION_ACCEPTED);
      expect(sessionAccepted).toBeDefined();
      expect(sessionAccepted.payload.nickname).toBe('Alice');
      expect(sessionAccepted.payload.reconnectToken).toBeDefined();

      // Host must have received PLAYER_JOINED
      const hostMsgs = hostClient.getAllMessages();
      const playerJoined = hostMsgs.find(m => m.type === ServerEventType.PLAYER_JOINED);
      expect(playerJoined).toBeDefined();
      expect(playerJoined.payload.nickname).toBe('Alice');

      // 2. Player 2 tries duplicate nickname 'alice' (case-insensitive)
      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Server = ctx.getWebSockets('role:player')[1];
      const p2Client = attachTestClient(room, p2Server, p2Server.peer!);

      await p2Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'alice' }, 0));

      const p2Msgs = p2Client.getAllMessages();
      const errorMsg = p2Msgs.find(m => m.type === ServerEventType.ERROR);
      expect(errorMsg).toBeDefined();
      expect(errorMsg.payload.code).toBe(ProtocolError.NICKNAME_TAKEN);

      // Player 2 joins with unique name 'Bob'
      p2Client.clearMessages();
      await p2Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Bob' }, 0));
      const bobSession = p2Client.getAllMessages().find(m => m.type === ServerEventType.SESSION_ACCEPTED);
      expect(bobSession).toBeDefined();
      expect(bobSession.payload.nickname).toBe('Bob');
    });

    it('handles player disconnect and RESUME_SESSION with exact state restoration', async () => {
      // Connect Alice
      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Server = ctx.getWebSockets('role:player')[0];
      const p1Client = attachTestClient(room, p1Server, p1Server.peer!);

      await p1Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));
      const token = p1Client.getAllMessages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.reconnectToken;

      hostClient.clearMessages();

      // Disconnect Alice
      await room.webSocketClose(p1Server as any, 1000, 'Client closed');

      // Host receives PLAYER_PRESENCE_CHANGED with connected: false
      const presenceOff = hostClient.getAllMessages().find(m => m.type === ServerEventType.PLAYER_PRESENCE_CHANGED);
      expect(presenceOff).toBeDefined();
      expect(presenceOff.payload.connected).toBe(false);

      hostClient.clearMessages();

      // Reconnect Alice via RESUME_SESSION
      const reconReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(reconReq);
      const reconSockets = ctx.getWebSockets('role:player');
      const reconServer = reconSockets[reconSockets.length - 1];
      const reconClient = attachTestClient(room, reconServer, reconServer.peer!);

      await reconClient.send(createClientEnvelope('RESUME_SESSION', { pin: testPin, reconnectToken: token }, 0));

      const reconMsgs = reconClient.getAllMessages();
      const resumeAccepted = reconMsgs.find(m => m.type === ServerEventType.SESSION_ACCEPTED);
      expect(resumeAccepted).toBeDefined();
      expect(resumeAccepted.payload.nickname).toBe('Alice');

      // Receives SNAPSHOT immediately
      const snapshot = reconMsgs.find(m => m.type === ServerEventType.SNAPSHOT);
      expect(snapshot).toBeDefined();
      expect(snapshot.payload.room.pin).toBe(testPin);

      // Host receives PLAYER_PRESENCE_CHANGED with connected: true
      const presenceOn = hostClient.getAllMessages().find(m => m.type === ServerEventType.PLAYER_PRESENCE_CHANGED);
      expect(presenceOn).toBeDefined();
      expect(presenceOn.payload.connected).toBe(true);
    });

    it('rejects invalid RESUME_SESSION token', async () => {
      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pServer = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pServer, pServer.peer!);

      await pClient.send(createClientEnvelope('RESUME_SESSION', { pin: testPin, reconnectToken: 'fake-token-999' }, 0));
      const errorMsg = pClient.getAllMessages().find(m => m.type === ServerEventType.ERROR);
      expect(errorMsg).toBeDefined();
      expect(errorMsg.payload.code).toBe(ProtocolError.UNAUTHORIZED);
    });

    it('keeps legacy heartbeat compatibility without persisting each heartbeat', async () => {
      const playerReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(playerReq);
      const playerServer = ctx.getWebSockets('role:player')[0];
      const playerClient = attachTestClient(room, playerServer, playerServer.peer!);
      await playerClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const sql = (room as any).sql;
      const before = sql.exec('SELECT last_seen_at FROM presence LIMIT 1').toArray()[0].last_seen_at;

      const realNow = Date.now;
      Date.now = () => before + 5_000;
      try {
        await playerClient.send(createClientEnvelope('CLIENT_ALIVE', { clientTime: before + 5_000 }, 0));
      } finally {
        Date.now = realNow;
      }

      const after = sql.exec('SELECT last_seen_at FROM presence LIMIT 1').toArray()[0].last_seen_at;
      expect(after).toBe(before);
    });

    it('uses the automatic heartbeat timestamp when deciding whether every active player answered', async () => {
      const playerReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(playerReq);
      const playerServer = ctx.getWebSockets('role:player')[0];
      const playerClient = attachTestClient(room, playerServer, playerServer.peer!);
      await playerClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const joinedAt = (room as any).sql.exec('SELECT last_seen_at FROM presence LIMIT 1').toArray()[0].last_seen_at;
      const heartbeatAt = joinedAt + 15_000;
      expect(ctx.simulateWebSocketMessage(playerServer, 'ping', heartbeatAt)).toBe(true);

      const realNow = Date.now;
      Date.now = () => heartbeatAt;
      try {
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
        await runNextAlarm();

        const question = questions[0];
        await playerClient.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: question.id,
          questionVersion: 0,
          optionId: question.correctOptionId,
        }, 0));

        expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe('P0.6 Authoritative Answer Submission & Rejections', () => {
    let hostClient: WsTestClient;
    let aliceClient: WsTestClient;
    let bobClient: WsTestClient;

    beforeEach(async () => {
      // Connect host
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostServer = ctx.getWebSockets('role:host')[0];
      hostClient = attachTestClient(room, hostServer, hostServer.peer!);

      // Connect Alice
      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Server = ctx.getWebSockets('role:player')[0];
      aliceClient = attachTestClient(room, p1Server, p1Server.peer!);
      await aliceClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      // Connect Bob (so question does not auto-end when Alice answers)
      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Server = ctx.getWebSockets('role:player')[1];
      bobClient = attachTestClient(room, p2Server, p2Server.peer!);
      await bobClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Bob' }, 0));

      // Start game: LOBBY -> COUNTDOWN -> QUESTION_ACTIVE
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 1));
      // Trigger alarm to finish COUNTDOWN and start Question 1
      await runNextAlarm();
      aliceClient.clearMessages();
      bobClient.clearMessages();
    });

    it('accepts valid answer and idempotently re-acknowledges identical submission (P0.6)', async () => {
      const q1 = questions[0];
      const optionId = q1.options[0].id;

      // 1. Submit answer
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId,
      }, 0));

      const accepted1 = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_ACCEPTED);
      expect(accepted1).toBeDefined();
      expect(accepted1.payload.questionId).toBe(q1.id);

      // 2. Submit identical answer again while question is still active -> idempotent re-acknowledgement
      aliceClient.clearMessages();
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId,
      }, 0));

      const accepted2 = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_ACCEPTED);
      expect(accepted2).toBeDefined();
      expect(accepted2.payload.questionId).toBe(q1.id);
    });

    it('rejects changing answer with ANSWER_ALREADY_SUBMITTED', async () => {
      const q1 = questions[0];
      const opt1 = q1.options[0].id;
      const opt2 = q1.options[1].id;

      // First answer
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: opt1,
      }, 0));

      // Attempt second different answer while question is active
      aliceClient.clearMessages();
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: opt2,
      }, 0));

      const rejected = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(rejected).toBeDefined();
      expect(rejected.payload.code).toBe(ProtocolError.ANSWER_ALREADY_SUBMITTED);
    });

    it('rejects invalid option not belonging to question', async () => {
      const q1 = questions[0];
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: 'non_existent_option_id',
      }, 0));

      const rejected = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(rejected).toBeDefined();
      expect(rejected.payload.code).toBe(ProtocolError.INVALID_PAYLOAD);
    });

    it('rejects answer for wrong questionId', async () => {
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: 'q999',
        questionVersion: 0,
        optionId: 'q1_a',
      }, 0));

      const rejected = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(rejected).toBeDefined();
      expect(rejected.payload.code).toBe(ProtocolError.QUESTION_NOT_ACTIVE);
    });

    it('rejects answer with stale questionVersion and preserves state immutability', async () => {
      const q1 = questions[0];
      // Alice and Bob answer Question 0 so it completes
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 0));
      await bobClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 0));

      // Automatic loop advances reveal -> ranking -> countdown.
      await runNextAlarm();
      await runNextAlarm();
      await runNextAlarm(); // Question index 1 is now active!

      const q2 = questions[1];
      const initialVersion = (room as any).room.roomVersion;
      const initialAnswersCount = (room as any).sql.exec('SELECT count(*) as cnt FROM answers').toArray()[0].cnt;

      // Alice sends answer for Question 2 with stale questionVersion: 0 (< currentQuestionIndex 1)
      aliceClient.clearMessages();
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q2.id,
        questionVersion: 0, // Stale!
        optionId: q2.correctOptionId,
      }, 0));

      const rejected = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(rejected).toBeDefined();
      expect(rejected.payload.code).toBe(ProtocolError.STALE_VERSION);

      // Verify immutability: roomVersion and answers unchanged
      expect((room as any).room.roomVersion).toBe(initialVersion);
      expect((room as any).sql.exec('SELECT count(*) as cnt FROM answers').toArray()[0].cnt).toBe(initialAnswersCount);
    });

    it('rejects answer after deadline and preserves state immutability', async () => {
      const q1 = questions[0];
      const initialVersion = (room as any).room.roomVersion;
      const initialAnswersCount = (room as any).sql.exec('SELECT count(*) as cnt FROM answers').toArray()[0].cnt;

      const realNow = Date.now;
      try {
        Date.now = () => realNow() + 100_000; // Far past deadline
        await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: q1.id,
          questionVersion: 0,
          optionId: q1.options[0].id,
        }, 0));

        const rejected = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
        expect(rejected).toBeDefined();
        expect(rejected.payload.code).toBe(ProtocolError.DEADLINE_EXCEEDED);

        // Verify immutability
        expect((room as any).room.roomVersion).toBe(initialVersion);
        expect((room as any).sql.exec('SELECT count(*) as cnt FROM answers').toArray()[0].cnt).toBe(initialAnswersCount);
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe('P0.7 Pause, Resume & Speed Bonus Window Preservation', () => {
    let hostClient: WsTestClient;
    let aliceClient: WsTestClient;

    beforeEach(async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostServer = ctx.getWebSockets('role:host')[0];
      hostClient = attachTestClient(room, hostServer, hostServer.peer!);

      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pServer = ctx.getWebSockets('role:player')[0];
      aliceClient = attachTestClient(room, pServer, pServer.peer!);
      await aliceClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 1));
      await runNextAlarm(); // Start Question 1
      aliceClient.clearMessages();
    });

    it('rejects answers submitted while paused and preserves active response time across resume', async () => {
      const q1 = questions[0];

      // 1. Host pauses game
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'PAUSE', expectedRoomVersion: (room as any).room.roomVersion }, 3));

      // 2. Submitting answer while paused is rejected
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 4));

      const rejected = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(rejected).toBeDefined();
      expect(rejected.payload.code).toBe(ProtocolError.QUESTION_NOT_ACTIVE);

      // 3. Host resumes game
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'RESUME', expectedRoomVersion: (room as any).room.roomVersion }, 4));
      await runNextAlarm(); // Finishes resume countdown and reactivates question

      // 4. Submit answer after resume -> accepted
      aliceClient.clearMessages();
      await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 6));

      const accepted = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_ACCEPTED);
      expect(accepted).toBeDefined();
    });

    it('preserves exact speed bonus window across pause and resume (P0.7: 4s + 30s pause + 3s = 7s active)', async () => {
      const q1 = questions[0];
      const realNow = Date.now;
      let mockNow = Date.now();
      Date.now = () => mockNow;

      try {
        // 1. Question runs for 4 seconds active
        mockNow += 4000;

        // 2. Host pauses game
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'PAUSE', expectedRoomVersion: (room as any).room.roomVersion }, 2));

        // Submitting while paused is rejected with QUESTION_NOT_ACTIVE
        await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: q1.id,
          questionVersion: 0,
          optionId: q1.correctOptionId,
        }, 3));
        const rejected = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
        expect(rejected?.payload?.code).toBe(ProtocolError.QUESTION_NOT_ACTIVE);

        // 3. Paused for 30 seconds
        mockNow += 30_000;

        // 4. Host resumes
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'RESUME', expectedRoomVersion: (room as any).room.roomVersion }, 4));
        mockNow += 3000;
        await runNextAlarm(); // Resume countdown ends

        // 5. Player responds after 3 more seconds of active time (total active = 4s + 3s = 7s <= 10s bonus)
        mockNow += 3000;
        aliceClient.clearMessages();
        await aliceClient.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: q1.id,
          questionVersion: 0,
          optionId: q1.correctOptionId,
        }, 5));

        const accepted = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_ACCEPTED);
        expect(accepted).toBeDefined();

        // 6. Host ends question to reveal points and verify speed bonus was awarded (100 * 1.25 = 125)
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'END_QUESTION', expectedRoomVersion: (room as any).room.roomVersion }, 6));
        const reveal = aliceClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REVEAL);
        expect(reveal).toBeDefined();
        expect(reveal.payload.personalResult.awardedPoints).toBe(125);
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe('P0.5 final-question deterministic transition sequence', () => {
    it('progresses through all questions and transitions directly from QUESTION_REVEAL to FINAL_RANKING on the final question', async () => {
      // Connect host
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostServer = ctx.getWebSockets('role:host')[0];
      const hostClient = attachTestClient(room, hostServer, hostServer.peer!);

      // Connect player
      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pServer = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pServer, pServer.peer!);
      await pClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Champion' }, 0));

      // Start game
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 1));
      await runNextAlarm(); // starts Question 0 (Q1)

      // Play every question preceding the final question.
      for (let qIndex = 0; qIndex < TOTAL_QUESTIONS - 1; qIndex++) {
        const q = questions[qIndex];
        // Player answers (which automatically ends question because all answered!)
        await pClient.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: q.id,
          questionVersion: qIndex,
          optionId: q.correctOptionId,
        }, 0));

        // Automatic loop: reveal -> ranking -> countdown -> next question.
        await runNextAlarm();
        await runNextAlarm();
        await runNextAlarm(); // Countdown alarm -> starts next question
      }

      const finalQuestion = questions[TOTAL_QUESTIONS - 1];
      expect(finalQuestion.type).toBe('final');

      // Player answers the final question (which triggers auto-end and QUESTION_REVEAL)
      await pClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: finalQuestion.id,
        questionVersion: TOTAL_QUESTIONS - 1,
        optionId: finalQuestion.correctOptionId,
      }, 0));

      // On the final question, the automatic reveal transition goes directly to FINAL_RANKING.
      hostClient.clearMessages();
      await runNextAlarm();

      const rankEvent = hostClient.getAllMessages().find(m => m.type === ServerEventType.RANKING_UPDATED);
      expect(rankEvent).toBeDefined();
      expect(rankEvent.payload.isFinal).toBe(true);

      const stateChange1 = hostClient.getAllMessages().find(
        m => m.type === ServerEventType.GAME_STATE_CHANGED && m.payload.state === GameState.FINAL_RANKING
      );
      expect(stateChange1).toBeDefined();

      // From FINAL_RANKING to PODIUM
      hostClient.clearMessages();
      await runNextAlarm();
      const stateChange2 = hostClient.getAllMessages().find(
        m => m.type === ServerEventType.GAME_STATE_CHANGED && m.payload.state === GameState.PODIUM
      );
      expect(stateChange2).toBeDefined();

      // From PODIUM to FINISHED
      hostClient.clearMessages();
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'END_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      const stateChange3 = hostClient.getAllMessages().find(
        m => m.type === ServerEventType.GAME_STATE_CHANGED && m.payload.state === GameState.FINISHED
      );
      expect(stateChange3).toBeDefined();
    });

    it('executes room cleanup on alarm after FINISHED state (P3.2)', async () => {
      // Connect host & player
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostServer = ctx.getWebSockets('role:host')[0];
      const hostClient = attachTestClient(room, hostServer, hostServer.peer!);

      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pServer = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pServer, pServer.peer!);
      await pClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'CleanTest' }, 0));

      // End game
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'END_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      expect((room as any).room.status).toBe(GameState.FINISHED);

      // Trigger cleanup alarm
      await runNextAlarm();

      // Verify all tables were wiped
      const sql = (room as any).sql;
      expect(sql.exec('SELECT count(*) as cnt FROM answers').toArray()[0].cnt).toBe(0);
      expect(sql.exec('SELECT count(*) as cnt FROM presence').toArray()[0].cnt).toBe(0);
      expect(sql.exec('SELECT count(*) as cnt FROM scores').toArray()[0].cnt).toBe(0);
      expect(sql.exec('SELECT count(*) as cnt FROM rounds').toArray()[0].cnt).toBe(0);
      expect(sql.exec('SELECT count(*) as cnt FROM players').toArray()[0].cnt).toBe(0);
    });
  });

  describe('T1–T17 Comprehensive Specification Verification Suite', () => {
    it('T1 & T3: happy path with 2 players closes immediately when all answer, auto-progresses without host commands', async () => {
      // Connect host
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      // Connect Player A
      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'PlayerA' }, 0));

      // Connect Player B
      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2 = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'PlayerB' }, 0));

      // Host starts game: LOBBY -> COUNTDOWN
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      expect((room as any).room.status).toBe(GameState.COUNTDOWN);

      // Countdown finishes -> QUESTION_ACTIVE (Q1)
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
      expect((room as any).room.currentQuestionIndex).toBe(0);

      // Player A answers -> round stays active (B hasn't answered yet)
      const q1 = questions[0];
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 0));
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);

      // Player B answers -> all answered! Question closes immediately -> QUESTION_REVEAL
      await p2.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.options[1].id,
      }, 0));
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);

      // Automated Reveal alarm (5s) -> ROUND_RANKING (WITHOUT HOST ACTION!)
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.ROUND_RANKING);

      // Automated Ranking alarm (5s) -> COUNTDOWN (3s) (WITHOUT HOST ACTION!)
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.COUNTDOWN);

      // Automated Countdown alarm (3s) -> QUESTION_ACTIVE (Q2)
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
      expect((room as any).room.currentQuestionIndex).toBe(1);
    });

    it('T2: when 1 student answers out of 3, host gets distribution, screen does not leak, round stays open', async () => {
      // Connect host & 3 players & screen
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const screenReq = new Request('http://internal/ws?role=screen', { headers: { Upgrade: 'websocket' } });
      await room.fetch(screenReq);
      const screenWs = ctx.getWebSockets('role:screen')[0];
      const screenTestClient = attachTestClient(room, screenWs, screenWs.peer!);

      const pClients: WsTestClient[] = [];
      for (const name of ['Alice', 'Bob', 'Charlie']) {
        const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
        await room.fetch(pReq);
        const sockets = ctx.getWebSockets('role:player');
        const pWs = sockets[sockets.length - 1];
        const client = attachTestClient(room, pWs, pWs.peer!);
        await client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: name }, 0));
        pClients.push(client);
      }

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // start Q1

      hostTestClient.clearMessages();
      screenTestClient.clearMessages();
      pClients[0].clearMessages();

      // Alice answers
      const q1 = questions[0];
      await pClients[0].send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 0));

      // Alice receives ANSWER_ACCEPTED (no correct/incorrect reveal!)
      const aliceAccepted = pClients[0].getAllMessages().find(m => m.type === ServerEventType.ANSWER_ACCEPTED);
      expect(aliceAccepted).toBeDefined();

      // Host receives ROUND_PROGRESS with option distribution
      const hostProgress = hostTestClient.getAllMessages().find(m => m.type === ServerEventType.ROUND_PROGRESS);
      expect(hostProgress).toBeDefined();
      expect(hostProgress.payload.answeredCount).toBe(1);
      expect(hostProgress.payload.totalEligible).toBe(3);
      expect(hostProgress.payload.distribution).toBeDefined();

      // Screen receives ROUND_PROGRESS with counts only (NO distribution!)
      const screenProgress = screenTestClient.getAllMessages().find(m => m.type === ServerEventType.ROUND_PROGRESS);
      expect(screenProgress).toBeDefined();
      expect(screenProgress.payload.answeredCount).toBe(1);
      expect(screenProgress.payload.distribution).toBeUndefined();

      // Round remains active!
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
    });

    it('T4: timeout when player does not answer automatically closes round and awards 0 points', async () => {
      // Connect host & 1 player
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pWs = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pWs, pWs.peer!);
      await pClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'SlowPlayer' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // start Q1

      // Player does NOT answer. Move the persisted deadline into the past,
      // then execute the alarm that Cloudflare would deliver for that deadline.
      pClient.clearMessages();
      (room as any).sql.exec(
        'UPDATE rounds SET deadline_at = ? WHERE question_id = ?',
        Date.now() - 1,
        questions[0].id
      );
      await runNextAlarm(); // fires endCurrentQuestion('deadline')

      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
      const reveal = pClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REVEAL);
      expect(reveal).toBeDefined();
      // No personal result for unanswered player -> awardedPoints: 0
      expect(reveal.payload.personalResult).toBeNull();
    });

    it('T7: silent heartbeat expiry (without websocket close) expires player presence and does not block allAnswered', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      // Connect Alice & João
      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2 = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Joao' }, 0));
      const joaoPlayerId = p2.getAllMessages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.playerId;

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runPhaseAlarmWithoutHeartbeat(); // Q1 active

      // Alice answers first
      const q1 = questions[0];
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 0));
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);

      // João stops sending heartbeats silently (WITHOUT webSocketClose)
      const pastTime = Date.now() - 15_000;
      (p2Ws as any).__connectionMeta.lastSeenAt = pastTime;
      (room as any).sql.exec('UPDATE presence SET last_seen_at = ? WHERE player_id = ?', pastTime, joaoPlayerId);

      // Trigger autonomous presence check
      const expired = (room as any).checkAndExpirePresence(Date.now());
      expect(expired).toBe(true);

      // Round ends immediately into QUESTION_REVEAL because all remaining active players answered!
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
    });

    it('T8: clean websocket close marks player disconnected and does not block allAnswered', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      // Connect Alice & João
      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2 = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Joao' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runPhaseAlarmWithoutHeartbeat(); // Q1 active

      // João closes browser cleanly
      await room.webSocketClose(p2Ws as any, 1000, 'Browser closed');

      // Alice answers -> since João is disconnected, Alice is the ONLY active eligible player!
      const q1 = questions[0];
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 0));

      // Round ends immediately because all ACTIVE eligible players answered!
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
    });

    it('T9: pause and resume preserves registered answer for player who already answered', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));
      const alicePlayerId = p1.getAllMessages().find(m => m.type === ServerEventType.SESSION_ACCEPTED).payload.playerId;

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2 = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Bob' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // start Q1

      // Alice answers
      const q1 = questions[0];
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 0));

      // Host pauses
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'PAUSE', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      expect((room as any).room.status).toBe(GameState.PAUSED);

      // Host resumes -> COUNTDOWN
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'RESUME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      expect((room as any).room.status).toBe(GameState.COUNTDOWN);
      await runNextAlarm(); // resumes QUESTION_ACTIVE

      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);

      // Alice's answer in database is intact
      const answers = (room as any).sql.exec('SELECT * FROM answers WHERE player_id = ?', alicePlayerId).toArray();
      expect(answers.length).toBe(1);

      // Alice re-submitting a different answer is rejected
      p1.clearMessages();
      const differentOption = q1.options.find(o => o.id !== q1.correctOptionId)!;
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: differentOption.id,
      }, 0));
      const rejected = p1.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(rejected?.payload?.code).toBe(ProtocolError.ANSWER_ALREADY_SUBMITTED);
    });

    it('T10: host command succeeds when roomVersion advanced due to concurrent player answers (lastStateVersion buffer)', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2 = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Bob' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // start Q1

      // Host saw roomVersion at start of Q1
      const hostKnownVersion = (room as any).room.roomVersion;
      expect((room as any).room.lastStateVersion).toBe(hostKnownVersion);

      // Alice answers -> increments roomVersion on server!
      const q1 = questions[0];
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.options[0].id,
      }, 0));

      expect((room as any).room.roomVersion).toBeGreaterThan(hostKnownVersion);

      // Host sends PAUSE with its slightly older expectedRoomVersion (P0.6 concurrency resolution)
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'PAUSE',
        expectedRoomVersion: hostKnownVersion, // Not latest, but >= lastStateVersion!
      }, 0));

      // Must succeed!
      expect((room as any).room.status).toBe(GameState.PAUSED);
    });

    it('T11: rejects future versions (questionVersion > current or expectedRoomVersion > server roomVersion)', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // Q1 (index 0)

      // 1. Future questionVersion (9999) -> rejected with INVALID_PAYLOAD
      p1.clearMessages();
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: questions[0].id,
        questionVersion: 9999, // Future!
        optionId: questions[0].options[0].id,
      }, 0));
      const rejectedAnswer = p1.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(rejectedAnswer?.payload?.code).toBe(ProtocolError.INVALID_PAYLOAD);

      // 2. Future expectedRoomVersion (9999) -> rejected with INVALID_PAYLOAD
      hostTestClient.clearMessages();
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'PAUSE',
        expectedRoomVersion: 9999, // Future!
      }, 0));
      const hostError = hostTestClient.getAllMessages().find(m => m.type === ServerEventType.ERROR);
      expect(hostError?.payload?.code).toBe(ProtocolError.INVALID_PAYLOAD);
    });

    it('T12: 1 player plays all questions to podium and finished automatically', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'SoloHero' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // start Q1

      // Play every question preceding the final question.
      for (let i = 0; i < TOTAL_QUESTIONS - 1; i++) {
        expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
        expect((room as any).room.currentQuestionIndex).toBe(i);
        await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: questions[i].id,
          questionVersion: i,
          optionId: questions[i].correctOptionId,
        }, 0));
        expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
        await runNextAlarm(); // -> ROUND_RANKING
        expect((room as any).room.status).toBe(GameState.ROUND_RANKING);
        await runNextAlarm(); // -> COUNTDOWN
        expect((room as any).room.status).toBe(GameState.COUNTDOWN);
        await runNextAlarm(); // -> next QUESTION_ACTIVE
      }

      const finalQuestionIndex = TOTAL_QUESTIONS - 1;
      const finalQuestion = questions[finalQuestionIndex];
      expect((room as any).room.currentQuestionIndex).toBe(finalQuestionIndex);
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: finalQuestion.id,
        questionVersion: finalQuestionIndex,
        optionId: finalQuestion.correctOptionId,
      }, 0));
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);

      // Automated transition: QUESTION_REVEAL -> FINAL_RANKING
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.FINAL_RANKING);

      // Automated transition: FINAL_RANKING -> PODIUM
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.PODIUM);

      // Automated transition: PODIUM -> FINISHED
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.FINISHED);
    });

    it('T15: player counters totalPlayers, connectedPlayers, eligiblePlayers are consistent', () => {
      const now = Date.now();
      const mockPlayers: any[] = [
        { playerId: 'p1', nickname: 'Alice', joinedAt: now, eligibleFromQuestion: 0, removedAt: null },
        { playerId: 'p2', nickname: 'Bob', joinedAt: now, eligibleFromQuestion: 2, removedAt: null },
        { playerId: 'p3', nickname: 'Charlie', joinedAt: now, eligibleFromQuestion: 0, removedAt: now },
      ];
      const mockPresences: any[] = [
        { playerId: 'p1', connectionId: 'c1', lastSeenAt: now, connected: true },
        { playerId: 'p2', connectionId: 'c2', lastSeenAt: now - 30_000, connected: false },
        { playerId: 'p3', connectionId: 'c3', lastSeenAt: now, connected: true },
      ];

      const counts = getRoomPlayerCounts(mockPlayers as any, mockPresences as any, 0, now);

      // Alice (eligible, connected)
      // Bob (not eligible for Q0, disconnected)
      // Charlie (removed -> doesn't count in totalPlayers)
      expect(counts).toBeDefined();
      expect(counts.totalPlayers).toBe(2); // Alice and Bob
      expect(counts.connectedPlayers).toBe(1); // Alice only
      expect(counts.eligiblePlayers).toBe(1); // Alice only (Bob eligibleFrom 2)
    });

    it('T16: adaptive podium yields exact participant subsets for 1, 2, and 5 players', async () => {
      // 1 player
      const scores1 = [{ playerId: 'p1', totalPoints: 500, correctCount: 5, correctResponseTimeMs: 10000 }];
      const players1 = [{ playerId: 'p1', nickname: 'Alice', joinedAt: 0, eligibleFromQuestion: 0, removedAt: null }];
      const rank1 = (room as any).computeRanking.call({ getScores: () => scores1, getActivePlayers: () => players1 });
      expect(rank1.slice(0, 3)).toHaveLength(1);
      expect(rank1[0].position).toBe(1);

      // 2 players
      const scores2 = [
        { playerId: 'p1', totalPoints: 500, correctCount: 5, correctResponseTimeMs: 10000 },
        { playerId: 'p2', totalPoints: 300, correctCount: 3, correctResponseTimeMs: 12000 },
      ];
      const players2 = [
        { playerId: 'p1', nickname: 'Alice', joinedAt: 0, eligibleFromQuestion: 0, removedAt: null },
        { playerId: 'p2', nickname: 'Bob', joinedAt: 0, eligibleFromQuestion: 0, removedAt: null },
      ];
      const rank2 = (room as any).computeRanking.call({ getScores: () => scores2, getActivePlayers: () => players2 });
      expect(rank2.slice(0, 3)).toHaveLength(2);
      expect(rank2[0].position).toBe(1);
      expect(rank2[1].position).toBe(2);

      // 5 players
      const scores5 = Array.from({ length: 5 }, (_, i) => ({
        playerId: `p${i + 1}`,
        totalPoints: (5 - i) * 100,
        correctCount: 5 - i,
        correctResponseTimeMs: 10000,
      }));
      const players5 = Array.from({ length: 5 }, (_, i) => ({
        playerId: `p${i + 1}`,
        nickname: `Player${i + 1}`,
        joinedAt: 0,
        eligibleFromQuestion: 0,
        removedAt: null,
      }));
      const rank5 = (room as any).computeRanking.call({ getScores: () => scores5, getActivePlayers: () => players5 });
      const podium5 = rank5.slice(0, 3);
      expect(podium5).toHaveLength(3);
      expect(podium5[0].position).toBe(1);
      expect(podium5[1].position).toBe(2);
      expect(podium5[2].position).toBe(3);
    });

    it('T17: PIN alone does not authorize host commands; hostToken not leaked in JSON', async () => {
      // Connect client as player
      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pWs = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pWs, pWs.peer!);
      await pClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Hacker' }, 0));

      // Player attempts to send HOST_COMMAND (e.g. START_GAME) using only the PIN
      pClient.clearMessages();
      await pClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'START_GAME',
        expectedRoomVersion: 0,
      }, 0));

      const errorMsg = pClient.getAllMessages().find(m => m.type === ServerEventType.ERROR);
      expect(errorMsg).toBeDefined();
      expect(errorMsg.payload.code).toBe(ProtocolError.UNAUTHORIZED);
    });

    it('T03 & T04: registered player who disconnects does not enable START_GAME; reconnecting enables START_GAME', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      // 1. Initially 0 players -> rejected
      hostTestClient.clearMessages();
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'START_GAME',
        expectedRoomVersion: (room as any).room.roomVersion,
      }, 0));

      let err = hostTestClient.getAllMessages().find(m => m.type === ServerEventType.ERROR);
      expect(err?.payload?.code).toBe(ProtocolError.NOT_ENOUGH_PLAYERS);
      expect(err?.payload?.message).toContain('Aguardando pelo menos um jogador conectado');
      expect((room as any).room.status).toBe(GameState.LOBBY);

      // 2. Player joins -> totalPlayers = 1, connectedPlayers = 1
      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pWs = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pWs, pWs.peer!);
      await pClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Joao' }, 0));
      const sessionMsg = pClient.getAllMessages().find(m => m.type === ServerEventType.SESSION_ACCEPTED);
      const reconnectToken = sessionMsg.payload.reconnectToken;

      // 3. Player disconnects (clean close or timeout) -> totalPlayers = 1, connectedPlayers = 0
      await room.webSocketClose(pWs as any, 1000, 'Normal');
      expect((room as any).getEffectivePresences().filter((p: any) => p.connected)).toHaveLength(0);
      expect((room as any).getActivePlayers()).toHaveLength(1);

      // T03: START_GAME must be rejected because connectedPlayers = 0
      hostTestClient.clearMessages();
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'START_GAME',
        expectedRoomVersion: (room as any).room.roomVersion,
      }, 0));

      err = hostTestClient.getAllMessages().find(m => m.type === ServerEventType.ERROR);
      expect(err?.payload?.code).toBe(ProtocolError.NOT_ENOUGH_PLAYERS);
      expect(err?.payload?.message).toContain('Aguardando pelo menos um jogador conectado');
      expect((room as any).room.status).toBe(GameState.LOBBY);

      // 4. Player reconnects via RESUME_SESSION -> connectedPlayers = 1
      const pReq2 = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq2);
      const pWs2 = ctx.getWebSockets('role:player')[1];
      const pClient2 = attachTestClient(room, pWs2, pWs2.peer!);
      await pClient2.send(createClientEnvelope('RESUME_SESSION', { pin: testPin, reconnectToken }, 0));

      expect((room as any).getEffectivePresences().filter((p: any) => p.connected)).toHaveLength(1);

      // T04: START_GAME now succeeds -> transitions to COUNTDOWN
      hostTestClient.clearMessages();
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'START_GAME',
        expectedRoomVersion: (room as any).room.roomVersion,
      }, 0));

      expect((room as any).room.status).toBe(GameState.COUNTDOWN);
    });

    it('T06: live host distribution without correct answer leak vs screen/player count-only progress', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const screenReq = new Request('http://internal/ws?role=screen', { headers: { Upgrade: 'websocket' } });
      await room.fetch(screenReq);
      const screenWs = ctx.getWebSockets('role:screen')[0];
      const screenTestClient = attachTestClient(room, screenWs, screenWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1Client = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2Client = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Bob' }, 0));

      // Start game -> advance to QUESTION_ACTIVE
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runPhaseAlarmWithoutHeartbeat(); // Q1 active

      hostTestClient.clearMessages();
      screenTestClient.clearMessages();
      p2Client.clearMessages();

      // Alice answers option A
      const q1 = questions[0];
      await p1Client.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.options[0].id,
      }, 0));

      // 1. Host receives ROUND_PROGRESS with provisional distribution, NO correct answer
      const hostProgress = hostTestClient.getAllMessages().find(m => m.type === ServerEventType.ROUND_PROGRESS);
      expect(hostProgress).toBeDefined();
      expect(hostProgress.payload.answeredCount).toBe(1);
      expect(hostProgress.payload.totalEligible).toBe(2);
      expect(hostProgress.payload.distribution).toBeDefined();
      expect(hostProgress.payload.distribution).toHaveLength(4);
      expect(hostProgress.payload.correctOptionId).toBeUndefined();
      expect(hostProgress.payload.explanation).toBeUndefined();

      // 2. Screen receives ROUND_PROGRESS with count only, NO distribution, NO correct answer
      const screenProgress = screenTestClient.getAllMessages().find(m => m.type === ServerEventType.ROUND_PROGRESS);
      expect(screenProgress).toBeDefined();
      expect(screenProgress.payload.answeredCount).toBe(1);
      expect(screenProgress.payload.totalEligible).toBe(2);
      expect(screenProgress.payload.distribution).toBeUndefined();
      expect(screenProgress.payload.correctOptionId).toBeUndefined();

      // 3. Other player receives count only, NO distribution, NO correct answer
      const p2Progress = p2Client.getAllMessages().find(m => m.type === ServerEventType.ROUND_PROGRESS);
      expect(p2Progress).toBeDefined();
      expect(p2Progress.payload.distribution).toBeUndefined();
      expect(p2Progress.payload.correctOptionId).toBeUndefined();
    });

    it('T07: silent heartbeat drop expired by DO alarm triggers TEMPORARILY_DISCONNECTED and autonomous round end without webSocketClose', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1Client = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2Client = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'SilentBob' }, 0));
      const p2Session = p2Client.getAllMessages().find(m => m.type === ServerEventType.SESSION_ACCEPTED);
      const p2Id = p2Session.payload.playerId;

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runPhaseAlarmWithoutHeartbeat(); // Q1 active

      // Alice answers
      const q1 = questions[0];
      await p1Client.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.options[0].id,
      }, 0));

      // Bob does NOT answer and silently disappears (NO webSocketClose call!)
      // Simulate silent timeout by aging Bob's lastSeenAt beyond 10s grace period and removing physical socket
      const pastTime = Date.now() - 15000;
      ctx.storage.sql.exec('UPDATE presence SET last_seen_at = ? WHERE player_id = ?', pastTime, p2Id);
      (p2Ws as any).__connectionMeta.lastSeenAt = pastTime;
      ctx.sockets.delete(p2Ws);

      // Trigger DO alarm (multiplexed phase timer + presence check)
      const presenceAlarmAt = ctx.getAlarm();
      expect(presenceAlarmAt).not.toBeNull();
      ctx.simulateWebSocketMessage(p1Ws, 'ping', presenceAlarmAt!);
      await runScheduledAlarmWithoutHeartbeat();

      // Alice answered and was the only active player left, so round ended autonomously!
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
    });

    it('T08: clean WebSocket close triggers TEMPORARILY_DISCONNECTED and checks round end', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1Client = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2Client = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'BobClean' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // Q1 active

      // Alice answers
      const q1 = questions[0];
      await p1Client.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.options[0].id,
      }, 0));

      // Bob cleanly closes socket
      await room.webSocketClose(p2Ws as any, 1000, 'Clean departure');

      // Round should transition immediately to QUESTION_REVEAL
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
    });

    it('T09: pause/resume QUESTION_ACTIVE preserves question, remainingMs, activeMs, and submitted answer lock', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1Client = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2Client = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Bob' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // Q1 active

      const q1 = questions[0];
      // Alice answers
      await p1Client.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.options[0].id,
      }, 0));

      // Simulate 5 seconds elapsed on active question
      ctx.storage.sql.exec('UPDATE rounds SET started_at = ? WHERE question_id = ?', Date.now() - 5000, q1.id);

      // Host pauses
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'PAUSE', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      expect((room as any).room.status).toBe(GameState.PAUSED);

      const pausedRound = (room as any).getCurrentRound();
      expect(pausedRound.state).toBe('paused');
      expect(pausedRound.remainingMs).toBeGreaterThan(0);
      expect(pausedRound.accumulatedActiveMs).toBeGreaterThanOrEqual(5000);

      // While paused, Bob cannot answer
      p2Client.clearMessages();
      await p2Client.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.options[1].id,
      }, 0));
      const rejectedMsg = p2Client.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(rejectedMsg).toBeDefined();

      // Host resumes -> transitions to COUNTDOWN
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'RESUME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      expect((room as any).room.status).toBe(GameState.COUNTDOWN);

      // Alarm fires after resume countdown -> returns to QUESTION_ACTIVE on same question
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
      expect((room as any).room.currentQuestionIndex).toBe(0);

      // Alice's answer is still locked (cannot answer twice)
      p1Client.clearMessages();
      await p1Client.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.options[1].id,
      }, 0));
      const doubleAnswerMsg = p1Client.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REJECTED);
      expect(doubleAnswerMsg).toBeDefined();
      expect(doubleAnswerMsg.payload.code).toBe(ProtocolError.ANSWER_ALREADY_SUBMITTED);
    });

    it('T14: reopening finished room status returns FINISHED and rejects new joins', async () => {
      (room as any).transitionTo(GameState.FINISHED);
      expect((room as any).room.status).toBe(GameState.FINISHED);

      const statusRes = await room.fetch(new Request('http://internal/status'));
      expect(statusRes.status).toBe(200);
      const statusData = await statusRes.json() as any;
      expect(statusData.status).toBe('FINISHED');
    });

    it('T15: canonical counters (totalPlayers, connectedPlayers, eligiblePlayers) correctly reflect state', async () => {
      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1Client = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      const p2Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p2Req);
      const p2Ws = ctx.getWebSockets('role:player')[1];
      const p2Client = attachTestClient(room, p2Ws, p2Ws.peer!);
      await p2Client.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Bob' }, 0));

      // Disconnect Bob
      await room.webSocketClose(p2Ws as any, 1000, 'Left');

      const players = (room as any).getActivePlayers();
      const presences = (room as any).getEffectivePresences();
      const counts = getRoomPlayerCounts(players, presences, 0, Date.now());

      expect(counts.totalPlayers).toBe(2);
      expect(counts.connectedPlayers).toBe(1);
      expect(counts.eligiblePlayers).toBe(2);
    });

    it('T18: host query parameter token is rejected with 401 UNAUTHORIZED', async () => {
      const fakeTokenReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, {
        headers: { Upgrade: 'websocket' },
      });
      const res = await room.fetch(fakeTokenReq);
      expect(res.status).toBe(401);
      const data = await res.json() as any;
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('T10: rejects PAUSE in non-QUESTION_ACTIVE states with INVALID_STATE', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      // 1. Attempt PAUSE in LOBBY
      expect((room as any).room.status).toBe(GameState.LOBBY);
      hostTestClient.clearMessages();
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'PAUSE',
        expectedRoomVersion: (room as any).room.roomVersion,
      }, 0));
      const lobbyErr = hostTestClient.getAllMessages().find(m => m.type === ServerEventType.ERROR);
      expect(lobbyErr?.payload?.code).toBe(ProtocolError.INVALID_STATE);

      // Connect player and move to COUNTDOWN
      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pWs = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pWs, pWs.peer!);
      await pClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'P1' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'START_GAME',
        expectedRoomVersion: (room as any).room.roomVersion,
      }, 0));
      expect((room as any).room.status).toBe(GameState.COUNTDOWN);

      // 2. Attempt PAUSE in COUNTDOWN
      hostTestClient.clearMessages();
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', {
        command: 'PAUSE',
        expectedRoomVersion: (room as any).room.roomVersion,
      }, 0));
      const countdownErr = hostTestClient.getAllMessages().find(m => m.type === ServerEventType.ERROR);
      expect(countdownErr?.payload?.code).toBe(ProtocolError.INVALID_STATE);
    });

    it('T11 & T12: snapshot anti-spoiler in resume countdown (no gabarito) vs reveal (with gabarito)', async () => {
      const hostReq = createHostRequest();
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pWs = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pWs, pWs.peer!);
      await pClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await runNextAlarm(); // start Q1

      // Host pauses, then resumes -> enters COUNTDOWN
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'PAUSE', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'RESUME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      expect((room as any).room.status).toBe(GameState.COUNTDOWN);

      // T11: Request snapshot during resume COUNTDOWN
      pClient.clearMessages();
      await pClient.send(createClientEnvelope('REQUEST_SNAPSHOT', {}, 0));
      const countdownSnap = pClient.getAllMessages().find(m => m.type === ServerEventType.SNAPSHOT);
      expect(countdownSnap).toBeDefined();
      expect(countdownSnap.payload.correctOptionId).toBeNull();
      expect(countdownSnap.payload.explanation).toBeNull();
      expect(countdownSnap.payload.currentQuestion?.correctOptionId).toBeUndefined();
      expect(countdownSnap.payload.distribution).toEqual([]);

      // Advance countdown to active question
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);

      // Alice answers -> ends question into QUESTION_REVEAL
      const q1 = questions[0];
      await pClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q1.id,
        questionVersion: 0,
        optionId: q1.correctOptionId,
      }, 0));
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);

      // T12: Request snapshot during QUESTION_REVEAL
      pClient.clearMessages();
      await pClient.send(createClientEnvelope('REQUEST_SNAPSHOT', {}, 0));
      const revealSnap = pClient.getAllMessages().find(m => m.type === ServerEventType.SNAPSHOT);
      expect(revealSnap).toBeDefined();
      expect(revealSnap.payload.correctOptionId).toBe(q1.correctOptionId);
      expect(revealSnap.payload.explanation).toBe(q1.explanation ?? null);
      expect(revealSnap.payload.distribution.length).toBeGreaterThan(0);
    });

    it('T13: finish room A -> host creates room B -> player connects and joins room B in real-time', async () => {
      // 1. Room A completes to FINISHED
      (room as any).transitionTo(GameState.FINISHED);
      expect((room as any).room.status).toBe(GameState.FINISHED);

      // 2. Host creates Room B
      const pinB = '789012';
      const hostTokenB = 'host-token-bbb';
      const ctxB = new MockDurableObjectState();
      const roomB = new GameRoom(ctxB as any, {});

      const initBReq = new Request('http://internal/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinB, hostToken: hostTokenB }),
      });
      const resB = await roomB.fetch(initBReq);
      expect(resB.status).toBe(201);

      // Host connects to Room B with Room B cookie
      const hostReqB = createHostRequest(pinB, hostTokenB);
      const hostUpgradeB = await roomB.fetch(hostReqB);
      expect(hostUpgradeB.status).toBe(101);

      // 3. Player connects and joins Room B
      const pReqB = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      const pUpgradeB = await roomB.fetch(pReqB);
      expect(pUpgradeB.status).toBe(101);

      const pWsB = ctxB.getWebSockets('role:player')[0];
      const pClientB = attachTestClient(roomB, pWsB, pWsB.peer!);
      await pClientB.send(createClientEnvelope('JOIN_ROOM', { pin: pinB, nickname: 'AliceFresh' }, 0));

      const acceptMsg = pClientB.getAllMessages().find(m => m.type === ServerEventType.SESSION_ACCEPTED);
      expect(acceptMsg).toBeDefined();
      expect(acceptMsg.payload.nickname).toBe('AliceFresh');
      expect((roomB as any).room.pin).toBe(pinB);
      expect((roomB as any).getActivePlayers()).toHaveLength(1);
    });
  });

  describe('Host + Player dual session', () => {
    it('T2/T3/T6/T8/T9/T10: mantém identidades, score e lifecycle independentes', async () => {
      await room.fetch(createHostRequest());
      const hostServer = ctx.getWebSockets('role:host')[0];
      const host = attachTestClient(room, hostServer, hostServer.peer!);

      await room.fetch(new Request('http://internal/ws?role=player', {
        headers: { Upgrade: 'websocket' },
      }));
      const creatorServer = ctx.getWebSockets('role:player')[0];
      const creator = attachTestClient(room, creatorServer, creatorServer.peer!);
      await creator.send(createClientEnvelope('JOIN_ROOM', {
        pin: testPin,
        nickname: 'Criador',
      }, 0));

      const accepted = creator.getAllMessages().find(
        message => message.type === ServerEventType.SESSION_ACCEPTED,
      );
      expect(accepted).toBeDefined();
      const playerId = accepted.payload.playerId as string;
      const reconnectToken = accepted.payload.reconnectToken as string;

      expect(ctx.getWebSockets('role:host')).toHaveLength(1);
      expect(ctx.getWebSockets('role:player')).toHaveLength(1);
      const joined = host.getAllMessages().find(
        message => message.type === ServerEventType.PLAYER_JOINED,
      );
      expect(joined?.payload).toMatchObject({
        playerId,
        nickname: 'Criador',
        totalPlayers: 1,
        connectedPlayers: 1,
      });

      await host.send(createClientEnvelope('HOST_COMMAND', {
        command: 'START_GAME',
        expectedRoomVersion: (room as any).room.roomVersion,
      }, 0));
      await runNextAlarm();

      creator.clearMessages();
      const firstQuestion = questions[0];
      await creator.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: firstQuestion.id,
        questionVersion: 0,
        optionId: firstQuestion.correctOptionId,
      }, 0));

      expect(creator.getAllMessages().find(
        message => message.type === ServerEventType.ANSWER_ACCEPTED,
      )).toBeDefined();
      const progress = creator.getAllMessages().find(
        message => message.type === ServerEventType.ROUND_PROGRESS,
      );
      expect(progress?.payload.answeredCount).toBe(1);

      await room.webSocketClose(creatorServer as any, 1000, 'player network lost');
      expect(ctx.getWebSockets('role:host')[0].readyState).toBe(1);

      await room.fetch(new Request('http://internal/ws?role=player', {
        headers: { Upgrade: 'websocket' },
      }));
      const resumedServer = ctx.getWebSockets('role:player').at(-1)!;
      const resumed = attachTestClient(room, resumedServer, resumedServer.peer!);
      await resumed.send(createClientEnvelope('RESUME_SESSION', {
        pin: testPin,
        reconnectToken,
      }, 0));

      const resumedAccepted = resumed.getAllMessages().find(
        message => message.type === ServerEventType.SESSION_ACCEPTED,
      );
      const resumedSnapshot = resumed.getAllMessages().find(
        message => message.type === ServerEventType.SNAPSHOT,
      );
      expect(resumedAccepted?.payload.playerId).toBe(playerId);
      expect(resumedSnapshot?.payload.players.filter(
        (player: { playerId: string }) => player.playerId === playerId,
      )).toHaveLength(1);
      expect(resumedSnapshot?.payload.personalAnswers).toEqual(
        expect.arrayContaining([expect.objectContaining({ questionId: firstQuestion.id })]),
      );
      expect(resumedSnapshot?.payload.personalScore.totalPoints).toBeGreaterThan(0);

      await room.webSocketClose(hostServer as any, 1000, 'host network lost');
      resumed.clearMessages();
      await resumed.send(createClientEnvelope('REQUEST_SNAPSHOT', { lastRoomVersion: 0 }, 0));
      expect(resumed.getAllMessages().find(
        message => message.type === ServerEventType.SNAPSHOT,
      )).toBeDefined();

      await runNextAlarm();
      await runNextAlarm();
      await runNextAlarm();

      for (let questionIndex = 1; questionIndex < TOTAL_QUESTIONS - 1; questionIndex++) {
        const question = questions[questionIndex];
        await resumed.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: question.id,
          questionVersion: questionIndex,
          optionId: question.correctOptionId,
        }, 0));
        await runNextAlarm();
        await runNextAlarm();
        await runNextAlarm();
      }

      const finalQuestion = questions[TOTAL_QUESTIONS - 1];
      await resumed.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: finalQuestion.id,
        questionVersion: TOTAL_QUESTIONS - 1,
        optionId: finalQuestion.correctOptionId,
      }, 0));
      await runNextAlarm();
      await runNextAlarm();
      expect((room as any).room.status).toBe(GameState.PODIUM);

      resumed.clearMessages();
      await resumed.send(createClientEnvelope('REQUEST_SNAPSHOT', { lastRoomVersion: 0 }, 0));
      const podiumSnapshot = resumed.getAllMessages().find(
        message => message.type === ServerEventType.SNAPSHOT,
      );
      expect(podiumSnapshot?.payload.rankings[0].playerId).toBe(playerId);
      expect(podiumSnapshot?.payload.podium[0].playerId).toBe(playerId);
    });
  });
});

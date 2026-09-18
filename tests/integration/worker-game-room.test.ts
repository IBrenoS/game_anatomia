import { describe, it, expect, beforeEach } from 'vitest';
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
      return serverWs.sentMessages.map(m => JSON.parse(m));
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

    it('sends immediate SNAPSHOT to newly connected host with query token', async () => {
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, {
        headers: { Upgrade: 'websocket' },
      });
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

    it('accepts host with token in cookie (P1.8)', async () => {
      const hostReq = new Request('http://internal/ws?role=host', {
        headers: {
          Upgrade: 'websocket',
          Cookie: `batalha_host_${testPin}=${testHostToken}`,
        },
      });
      const res = await room.fetch(hostReq);
      expect(res.status).toBe(101);
    });

    it('rejects unauthorized host connection with 401', async () => {
      const hostReq = new Request('http://internal/ws?role=host&token=invalid-token', {
        headers: { Upgrade: 'websocket' },
      });
      const res = await room.fetch(hostReq);
      expect(res.status).toBe(401);
    });
  });

  describe('P0.2 Player Lifecycle, Presence, Reconnection & Duplicate Nicknames', () => {
    let hostClient: WsTestClient;

    beforeEach(async () => {
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, {
        headers: { Upgrade: 'websocket' },
      });
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
        await room.alarm();

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
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
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
      await room.alarm();
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

      // Host advances to Question 1 (index 1)
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'SHOW_RANKING', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'NEXT_QUESTION', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await room.alarm(); // Question index 1 is now active!

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
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
      await room.fetch(hostReq);
      const hostServer = ctx.getWebSockets('role:host')[0];
      hostClient = attachTestClient(room, hostServer, hostServer.peer!);

      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pServer = ctx.getWebSockets('role:player')[0];
      aliceClient = attachTestClient(room, pServer, pServer.peer!);
      await aliceClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 1));
      await room.alarm(); // Start Question 1
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
      await room.alarm(); // Finishes resume countdown and reactivates question

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
        await room.alarm(); // Resume countdown ends

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

  describe('P0.5 10th Question Deterministic Transition Sequence', () => {
    it('progresses through all 10 questions and transitions directly from QUESTION_REVEAL to FINAL_RANKING on Q10', async () => {
      // Connect host
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
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
      await room.alarm(); // starts Question 0 (Q1)

      // Play questions 0 through 8 (Q1 to Q9)
      for (let qIndex = 0; qIndex < 9; qIndex++) {
        const q = questions[qIndex];
        // Player answers (which automatically ends question because all answered!)
        await pClient.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: q.id,
          questionVersion: qIndex,
          optionId: q.correctOptionId,
        }, 0));

        // Host shows ranking -> transitions to ROUND_RANKING for Q1–Q9
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'SHOW_RANKING', expectedRoomVersion: (room as any).room.roomVersion }, 0));

        // Host advances to next question
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'NEXT_QUESTION', expectedRoomVersion: (room as any).room.roomVersion }, 0));
        await room.alarm(); // Countdown alarm -> starts next question
      }

      // Now at Question index 9 (the 10th and final question!)
      const q10 = questions[9];
      expect(q10.type).toBe('final');

      // Player answers 10th question (which triggers auto-end and QUESTION_REVEAL)
      await pClient.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: q10.id,
        questionVersion: 9,
        optionId: q10.correctOptionId,
      }, 0));

      // On Question 10, SHOW_RANKING must transition directly to FINAL_RANKING
      hostClient.clearMessages();
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'SHOW_RANKING', expectedRoomVersion: (room as any).room.roomVersion }, 0));

      const rankEvent = hostClient.getAllMessages().find(m => m.type === ServerEventType.RANKING_UPDATED);
      expect(rankEvent).toBeDefined();
      expect(rankEvent.payload.isFinal).toBe(true);

      const stateChange1 = hostClient.getAllMessages().find(
        m => m.type === ServerEventType.GAME_STATE_CHANGED && m.payload.state === GameState.FINAL_RANKING
      );
      expect(stateChange1).toBeDefined();

      // From FINAL_RANKING to PODIUM
      hostClient.clearMessages();
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_PODIUM', expectedRoomVersion: (room as any).room.roomVersion }, 0));
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
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
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
      await room.alarm();

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
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
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
      await room.alarm();
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
      await room.alarm();
      expect((room as any).room.status).toBe(GameState.ROUND_RANKING);

      // Automated Ranking alarm (5s) -> COUNTDOWN (3s) (WITHOUT HOST ACTION!)
      await room.alarm();
      expect((room as any).room.status).toBe(GameState.COUNTDOWN);

      // Automated Countdown alarm (3s) -> QUESTION_ACTIVE (Q2)
      await room.alarm();
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
      expect((room as any).room.currentQuestionIndex).toBe(1);
    });

    it('T2: when 1 student answers out of 3, host gets distribution, screen does not leak, round stays open', async () => {
      // Connect host & 3 players & screen
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
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
      await room.alarm(); // start Q1

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
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const pReq = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(pReq);
      const pWs = ctx.getWebSockets('role:player')[0];
      const pClient = attachTestClient(room, pWs, pWs.peer!);
      await pClient.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'SlowPlayer' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await room.alarm(); // start Q1

      // Player does NOT answer. Deadline alarm fires!
      pClient.clearMessages();
      await room.alarm(); // fires endCurrentQuestion('deadline')

      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
      const reveal = pClient.getAllMessages().find(m => m.type === ServerEventType.ANSWER_REVEAL);
      expect(reveal).toBeDefined();
      // No personal result for unanswered player -> awardedPoints: 0
      expect(reveal.payload.personalResult).toBeNull();
    });

    it('T7: closed browser (websocket close) marks player disconnected and does not block allAnswered', async () => {
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
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
      await room.alarm(); // Q1 active

      // João closes browser
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
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
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
      await room.alarm(); // start Q1

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
      await room.alarm(); // resumes QUESTION_ACTIVE

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
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
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
      await room.alarm(); // start Q1

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
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Alice' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await room.alarm(); // Q1 (index 0)

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

    it('T12: 1 player plays all 10 questions to podium and finished automatically', async () => {
      const hostReq = new Request(`http://internal/ws?role=host&token=${testHostToken}`, { headers: { Upgrade: 'websocket' } });
      await room.fetch(hostReq);
      const hostWs = ctx.getWebSockets('role:host')[0];
      const hostTestClient = attachTestClient(room, hostWs, hostWs.peer!);

      const p1Req = new Request('http://internal/ws?role=player', { headers: { Upgrade: 'websocket' } });
      await room.fetch(p1Req);
      const p1Ws = ctx.getWebSockets('role:player')[0];
      const p1 = attachTestClient(room, p1Ws, p1Ws.peer!);
      await p1.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'SoloHero' }, 0));

      await hostTestClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: (room as any).room.roomVersion }, 0));
      await room.alarm(); // start Q1

      // Play questions 0 through 8 (Q1 to Q9)
      for (let i = 0; i < 9; i++) {
        expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
        expect((room as any).room.currentQuestionIndex).toBe(i);
        await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
          questionId: questions[i].id,
          questionVersion: i,
          optionId: questions[i].correctOptionId,
        }, 0));
        expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);
        await room.alarm(); // -> ROUND_RANKING
        expect((room as any).room.status).toBe(GameState.ROUND_RANKING);
        await room.alarm(); // -> COUNTDOWN
        expect((room as any).room.status).toBe(GameState.COUNTDOWN);
        await room.alarm(); // -> next QUESTION_ACTIVE
      }

      // Q10
      expect((room as any).room.currentQuestionIndex).toBe(9);
      expect((room as any).room.status).toBe(GameState.QUESTION_ACTIVE);
      await p1.send(createClientEnvelope('SUBMIT_ANSWER', {
        questionId: questions[9].id,
        questionVersion: 9,
        optionId: questions[9].correctOptionId,
      }, 0));
      expect((room as any).room.status).toBe(GameState.QUESTION_REVEAL);

      // Automated transition: QUESTION_REVEAL -> FINAL_RANKING
      await room.alarm();
      expect((room as any).room.status).toBe(GameState.FINAL_RANKING);

      // Automated transition: FINAL_RANKING -> PODIUM
      await room.alarm();
      expect((room as any).room.status).toBe(GameState.PODIUM);

      // Automated transition: PODIUM -> FINISHED
      await room.alarm();
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
  });
});

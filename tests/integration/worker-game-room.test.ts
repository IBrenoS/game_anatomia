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
      expect(data.hostToken).toBeDefined();
      expect(data.joinUrl).toContain(data.pin);

      // Verify HttpOnly cookie
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain(`batalha_host_${data.pin}=${data.hostToken}`);
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
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: 9999 }, 1));
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
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'SHOW_RANKING', expectedRoomVersion: 9999 }, 0));
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'NEXT_QUESTION', expectedRoomVersion: 9999 }, 0));
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

      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: 9999 }, 1));
      await room.alarm(); // Start Question 1
      aliceClient.clearMessages();
    });

    it('rejects answers submitted while paused and preserves active response time across resume', async () => {
      const q1 = questions[0];

      // 1. Host pauses game
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'PAUSE', expectedRoomVersion: 9999 }, 3));

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
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'RESUME', expectedRoomVersion: 9999 }, 4));
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
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'PAUSE', expectedRoomVersion: 9999 }, 2));

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
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'RESUME', expectedRoomVersion: 9999 }, 4));
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
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'END_QUESTION', expectedRoomVersion: 9999 }, 6));
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
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_GAME', expectedRoomVersion: 99999 }, 1));
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
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'SHOW_RANKING', expectedRoomVersion: 99999 }, 0));

        // Host advances to next question
        await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'NEXT_QUESTION', expectedRoomVersion: 99999 }, 0));
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
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'SHOW_RANKING', expectedRoomVersion: 99999 }, 0));

      const rankEvent = hostClient.getAllMessages().find(m => m.type === ServerEventType.RANKING_UPDATED);
      expect(rankEvent).toBeDefined();
      expect(rankEvent.payload.isFinal).toBe(true);

      const stateChange1 = hostClient.getAllMessages().find(
        m => m.type === ServerEventType.GAME_STATE_CHANGED && m.payload.state === GameState.FINAL_RANKING
      );
      expect(stateChange1).toBeDefined();

      // From FINAL_RANKING to PODIUM
      hostClient.clearMessages();
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'START_PODIUM', expectedRoomVersion: 99999 }, 0));
      const stateChange2 = hostClient.getAllMessages().find(
        m => m.type === ServerEventType.GAME_STATE_CHANGED && m.payload.state === GameState.PODIUM
      );
      expect(stateChange2).toBeDefined();

      // From PODIUM to FINISHED
      hostClient.clearMessages();
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'END_GAME', expectedRoomVersion: 99999 }, 0));
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
      await hostClient.send(createClientEnvelope('HOST_COMMAND', { command: 'END_GAME', expectedRoomVersion: 99999 }, 0));
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
});

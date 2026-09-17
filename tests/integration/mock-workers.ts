import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

// Patch Response in Node to allow Cloudflare Workers' status: 101 WebSocket responses
const OriginalResponse = globalThis.Response;
export class MockResponse extends OriginalResponse {
  webSocket?: any;
  constructor(body?: any, init?: ResponseInit & { webSocket?: any }) {
    if (init && init.status === 101) {
      super(null, { ...init, status: 200 });
      Object.defineProperty(this, 'status', { value: 101, writable: false });
      if (init.webSocket) {
        this.webSocket = init.webSocket;
      }
      return;
    }
    super(body, init);
    if (init && (init as any).webSocket) {
      this.webSocket = (init as any).webSocket;
    }
  }
}
(globalThis as any).Response = MockResponse;

export class DurableObject {
  ctx: any;
  env: any;
  constructor(ctx: any, env: any) {
    this.ctx = ctx;
    this.env = env;
  }
}

export class MockWebSocket {
  readyState = 1; // 1 = OPEN
  tags: string[] = [];
  attachment: any = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  sentMessages: string[] = [];
  peer: MockWebSocket | null = null;

  send(data: string) {
    this.sentMessages.push(data);
    if (this.peer && this.peer.onmessage) {
      const dataCopy = data;
      queueMicrotask(() => {
        this.peer?.onmessage?.({ data: dataCopy });
      });
    }
  }

  close(code = 1000, reason = '') {
    this.readyState = 3; // 3 = CLOSED
    if (this.peer) {
      this.peer.readyState = 3;
      if (this.peer.onclose) {
        queueMicrotask(() => {
          this.peer?.onclose?.({ code, reason });
        });
      }
    }
  }

  serializeAttachment(data: any) {
    this.attachment = JSON.parse(JSON.stringify(data));
  }

  deserializeAttachment() {
    return this.attachment ? JSON.parse(JSON.stringify(this.attachment)) : null;
  }
}

export class MockWebSocketPair {
  0: MockWebSocket;
  1: MockWebSocket;
  constructor() {
    this[0] = new MockWebSocket();
    this[1] = new MockWebSocket();
    this[0].peer = this[1];
    this[1].peer = this[0];
  }
}

// Ensure WebSocketPair is globally available for Workers code
(globalThis as any).WebSocketPair = MockWebSocketPair;

export class MockSqlStorage {
  db: any;

  constructor() {
    this.db = new DatabaseSync(':memory:');
  }

  exec(query: string, ...params: any[]) {
    const trimmed = query.trim();
    if (params.length === 0 && (trimmed.includes(';') || trimmed.startsWith('CREATE') || trimmed.startsWith('ALTER'))) {
      this.db.exec(query);
      return { toArray: () => [] };
    }

    const stmt = this.db.prepare(query);
    if (trimmed.toUpperCase().startsWith('SELECT') || trimmed.toUpperCase().startsWith('PRAGMA')) {
      const rows = stmt.all(...params);
      return { toArray: () => rows };
    } else {
      stmt.run(...params);
      return { toArray: () => [] };
    }
  }
}

export class MockDurableObjectStorage {
  sql: MockSqlStorage;
  alarms: number[] = [];

  constructor() {
    this.sql = new MockSqlStorage();
  }

  setAlarm(timestamp: number) {
    this.alarms.push(timestamp);
  }

  deleteAlarm() {
    this.alarms = [];
  }

  getAlarm() {
    return this.alarms.length > 0 ? this.alarms[this.alarms.length - 1] : null;
  }
}

export class MockDurableObjectState {
  storage: MockDurableObjectStorage;
  sockets: Set<MockWebSocket> = new Set();

  constructor() {
    this.storage = new MockDurableObjectStorage();
  }

  acceptWebSocket(ws: MockWebSocket, tags?: string[]) {
    this.sockets.add(ws);
    if (tags) {
      ws.tags = [...(ws.tags || []), ...tags];
    }
  }

  getTags(ws: MockWebSocket): string[] {
    return ws.tags || [];
  }

  getWebSockets(tag?: string): MockWebSocket[] {
    if (!tag) return Array.from(this.sockets);
    return Array.from(this.sockets).filter(ws => ws.tags?.includes(tag));
  }

  setAlarm(timestamp: number) {
    this.storage.setAlarm(timestamp);
  }

  deleteAlarm() {
    this.storage.deleteAlarm();
  }

  getAlarm() {
    return this.storage.getAlarm();
  }
}

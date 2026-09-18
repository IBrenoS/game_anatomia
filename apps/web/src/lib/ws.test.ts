import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketManager } from './ws';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;

  readonly sentMessages: string[] = [];
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(readonly url: string) {
    sockets.push(this);
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  send(message: string): void {
    this.sentMessages.push(message);
  }

  close(): void {
    this.readyState = 3;
  }
}

const sockets: FakeWebSocket[] = [];

describe('WebSocketManager heartbeat', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal('window', { location: { origin: 'https://game.example.com' } });
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends the static ping frame handled by Durable Object auto-response', () => {
    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].open();

    vi.advanceTimersByTime(5_000);

    expect(sockets[0].sentMessages).toEqual(['ping']);
    manager.disconnect();
  });

  it('P0.1: requests snapshot on foreground sync when socket is open', () => {
    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].open();
    sockets[0].sentMessages.length = 0;

    manager.handleForegroundSync();

    expect(sockets[0].sentMessages.length).toBe(1);
    const sent = JSON.parse(sockets[0].sentMessages[0]);
    expect(sent.type).toBe('REQUEST_SNAPSHOT');
    manager.disconnect();
  });

  it('P0.1: reconnects on foreground sync when socket is closed', () => {
    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].close();
    sockets[0].readyState = 3;

    expect(sockets.length).toBe(1);
    manager.handleForegroundSync();

    expect(sockets.length).toBe(2);
    manager.disconnect();
  });

  it('P0.2: sets state to reconnecting on network offline', () => {
    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].open();

    manager.handleNetworkOffline();
    expect(manager.state).toBe('reconnecting');
    manager.disconnect();
  });

  it('P0.3: updates reconnectToken and localStorage on SESSION_ACCEPTED', () => {
    const storage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => { storage[k] = v; },
      getItem: (k: string) => storage[k] || null,
    });

    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].open();

    sockets[0].onmessage?.({
      data: JSON.stringify({
        protocolVersion: 1,
        eventId: 's_1',
        type: 'SESSION_ACCEPTED',
        sentAt: Date.now(),
        roomVersion: 1,
        payload: {
          playerId: 'p_1',
          reconnectToken: 'token_abc_123',
          role: 'player',
          nickname: 'Alice',
        },
      }),
    });

    expect(storage['batalha_session_123456']).toBe('token_abc_123');

    // On reconnect, it should use the new token
    sockets[0].close();
    sockets[0].readyState = 3;
    manager.connect('123456', 'player');
    expect(sockets[1].url).toContain('role=player');
    manager.disconnect();
  });

  it('P0.5: discards incremental event and requests snapshot upon version gap', () => {
    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].open();

    // Initial snapshot sets roomVersion to 8
    sockets[0].onmessage?.({
      data: JSON.stringify({
        protocolVersion: 1,
        eventId: 's_snap',
        type: 'SNAPSHOT',
        sentAt: Date.now(),
        roomVersion: 8,
        payload: { room: { roomVersion: 8, status: 'QUESTION_ACTIVE' } },
      }),
    });
    expect(manager.roomVersion).toBe(8);

    const receivedEvents: string[] = [];
    manager.onEvent('QUESTION_STARTED', () => {
      receivedEvents.push('QUESTION_STARTED');
    });

    sockets[0].sentMessages.length = 0;

    // Incremental event arrives with version 11 (gap from 8 to 11!)
    sockets[0].onmessage?.({
      data: JSON.stringify({
        protocolVersion: 1,
        eventId: 's_gap',
        type: 'QUESTION_STARTED',
        sentAt: Date.now(),
        roomVersion: 11,
        payload: {},
      }),
    });

    // Gap detected: event MUST be discarded (not delivered to handler)
    expect(receivedEvents).toEqual([]);
    // Manager MUST request snapshot
    expect(sockets[0].sentMessages.length).toBe(1);
    const sent = JSON.parse(sockets[0].sentMessages[0]);
    expect(sent.type).toBe('REQUEST_SNAPSHOT');

    manager.disconnect();
  });

  it('P0.1 & T5: sends RESUME_SESSION on open when player token is present upon reconnecting', () => {
    const manager = new WebSocketManager();
    manager.connect('123456', 'player', 'tok_existing');
    sockets[0].open();
    expect(sockets[0].sentMessages.length).toBe(1);
    const sent = JSON.parse(sockets[0].sentMessages[0]);
    expect(sent.type).toBe('RESUME_SESSION');
    expect(sent.payload).toEqual({ pin: '123456', reconnectToken: 'tok_existing' });

    manager.disconnect();
  });

  it('P0.1 & T5: preserves currentToken across reconnect when token argument is omitted', () => {
    const storage: Record<string, string> = { 'batalha_session_123456': 'tok_from_storage' };
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => { storage[k] = v; },
      getItem: (k: string) => storage[k] || null,
    });

    const manager = new WebSocketManager();
    // Connect without token; should resolve from localStorage
    manager.connect('123456', 'player');
    sockets[0].open();

    expect(sockets[0].sentMessages.length).toBe(1);
    const sent = JSON.parse(sockets[0].sentMessages[0]);
    expect(sent.type).toBe('RESUME_SESSION');
    expect(sent.payload.reconnectToken).toBe('tok_from_storage');

    manager.disconnect();
  });

  it('P0.1 & T5: closeSocketForTest terminates the underlying websocket', () => {
    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].open();
    expect(sockets[0].readyState).toBe(FakeWebSocket.OPEN);

    manager.closeSocketForTest();
    expect(sockets[0].readyState).toBe(3); // closed

    manager.disconnect();
  });

  it('P0.1 & T5: mobile lifecycle event listeners trigger foreground sync', () => {
    const docListeners: Record<string, ((e?: any) => void)[]> = {};
    const winListeners: Record<string, ((e?: any) => void)[]> = {};

    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (evt: string, cb: () => void) => {
        if (!docListeners[evt]) docListeners[evt] = [];
        docListeners[evt].push(cb);
      },
    });

    vi.stubGlobal('window', {
      location: { origin: 'https://game.example.com', pathname: '/play/123456' },
      addEventListener: (evt: string, cb: () => void) => {
        if (!winListeners[evt]) winListeners[evt] = [];
        winListeners[evt].push(cb);
      },
    });

    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].open();
    sockets[0].sentMessages.length = 0;

    // 1. visibilitychange to visible -> triggers sync (REQUEST_SNAPSHOT)
    docListeners['visibilitychange']?.forEach(cb => cb());
    expect(sockets[0].sentMessages.length).toBe(1);
    expect(JSON.parse(sockets[0].sentMessages[0]).type).toBe('REQUEST_SNAPSHOT');

    // 2. visibilitychange to hidden -> should NOT trigger sync
    sockets[0].sentMessages.length = 0;
    (document as any).visibilityState = 'hidden';
    docListeners['visibilitychange']?.forEach(cb => cb());
    expect(sockets[0].sentMessages.length).toBe(0);

    // 3. pageshow -> triggers sync
    winListeners['pageshow']?.forEach(cb => cb());
    expect(sockets[0].sentMessages.length).toBe(1);
    expect(JSON.parse(sockets[0].sentMessages[0]).type).toBe('REQUEST_SNAPSHOT');

    // 4. focus -> triggers sync
    sockets[0].sentMessages.length = 0;
    winListeners['focus']?.forEach(cb => cb());
    expect(sockets[0].sentMessages.length).toBe(1);
    expect(JSON.parse(sockets[0].sentMessages[0]).type).toBe('REQUEST_SNAPSHOT');

    manager.disconnect();
  });

  it('discards stale SNAPSHOT when incoming version is older than _roomVersion', () => {
    const manager = new WebSocketManager();
    manager.connect('123456', 'player');
    sockets[0].open();

    const snapshotEvents: any[] = [];
    manager.onEvent('SNAPSHOT', (p) => snapshotEvents.push(p));

    // First SNAPSHOT with version 10 establishes roomVersion
    sockets[0].onmessage?.({
      data: JSON.stringify({
        protocolVersion: 1,
        eventId: 's1',
        type: 'SNAPSHOT',
        sentAt: Date.now(),
        roomVersion: 10,
        payload: { room: { status: 'QUESTION_ACTIVE' } },
      }),
    });
    expect(manager.roomVersion).toBe(10);
    expect(snapshotEvents.length).toBe(1);

    // Delayed stale SNAPSHOT with version 5 arrives -> must be discarded
    sockets[0].onmessage?.({
      data: JSON.stringify({
        protocolVersion: 1,
        eventId: 's0_stale',
        type: 'SNAPSHOT',
        sentAt: Date.now(),
        roomVersion: 5,
        payload: { room: { status: 'LOBBY' } },
      }),
    });
    // roomVersion must remain 10 and stale snapshot discarded
    expect(manager.roomVersion).toBe(10);
    expect(snapshotEvents.length).toBe(1);

    manager.disconnect();
  });
});

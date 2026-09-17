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
});

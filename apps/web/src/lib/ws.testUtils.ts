import { vi } from 'vitest';

export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;

  readonly sentMessages: string[] = [];
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(readonly url: string) {}

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

export function installFakeWebSocket() {
  const sockets: FakeWebSocket[] = [];
  const Socket = class extends FakeWebSocket {
    constructor(url: string) {
      super(url);
      sockets.push(this);
    }
  };

  vi.stubGlobal('window', { location: { origin: 'https://game.example.com', pathname: '/' } });
  vi.stubGlobal('WebSocket', Socket);

  return {
    sockets,
    emit(socket: FakeWebSocket, envelope: unknown): void {
      socket.onmessage?.({ data: JSON.stringify(envelope) });
    },
    cleanup(): void {
      vi.unstubAllGlobals();
    },
  };
}

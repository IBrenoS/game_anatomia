import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServerEnvelope, ServerEventType } from '@batalha/protocol';
import {
  getHostParticipation,
  joinCreatedRoomAsPlayer,
  setHostParticipation,
} from './hostParticipation';
import { WebSocketManager } from './ws';
import { installFakeWebSocket } from './ws.testUtils';

describe('hostParticipation', () => {
  let fakeWebSocket: ReturnType<typeof installFakeWebSocket>;
  let manager: WebSocketManager | null;
  let storage: Record<string, string>;

  beforeEach(() => {
    fakeWebSocket = installFakeWebSocket();
    manager = null;
    storage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });
  });

  afterEach(() => {
    manager?.disconnect();
    fakeWebSocket.cleanup();
  });

  it('T1: PIN sem escolha explícita permanece presenter mesmo com token player', () => {
    localStorage.setItem('batalha_session_123456', 'old-token');

    expect(getHostParticipation('123456')).toBe('presenter');
  });

  it('persiste a escolha explícita por PIN', () => {
    setHostParticipation('123456', 'player');

    expect(getHostParticipation('123456')).toBe('player');
    expect(getHostParticipation('654321')).toBe('presenter');
  });

  it('T2: resolve ingresso somente após SESSION_ACCEPTED', async () => {
    manager = new WebSocketManager();
    let resolved = false;
    const promise = joinCreatedRoomAsPlayer('123456', 'Breno', manager);
    promise.then(() => { resolved = true; });

    fakeWebSocket.sockets[0].open();

    expect(JSON.parse(fakeWebSocket.sockets[0].sentMessages[0])).toMatchObject({
      type: 'JOIN_ROOM',
      payload: { pin: '123456', nickname: 'Breno' },
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    fakeWebSocket.emit(fakeWebSocket.sockets[0], createServerEnvelope(
      ServerEventType.SESSION_ACCEPTED,
      { playerId: 'p1', reconnectToken: 'token', nickname: 'Breno', role: 'player' },
      1,
    ));

    await expect(promise).resolves.toBeUndefined();
  });

  it('mantém a mesma sala disponível para retry após erro protocolar', async () => {
    manager = new WebSocketManager();
    const promise = joinCreatedRoomAsPlayer('123456', 'Breno', manager);
    fakeWebSocket.sockets[0].open();
    fakeWebSocket.emit(fakeWebSocket.sockets[0], createServerEnvelope(
      ServerEventType.ERROR,
      { code: 'NICKNAME_TAKEN', message: 'Nickname is taken' },
      1,
    ));

    await expect(promise).rejects.toMatchObject({ code: 'NICKNAME_TAKEN' });
    expect(fakeWebSocket.sockets[0].url).toContain('/api/rooms/123456/ws');
  });
});

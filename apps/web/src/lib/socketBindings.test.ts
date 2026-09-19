import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServerEnvelope, ServerEventType } from '@batalha/protocol';
import { useGameStore } from '../stores/gameStore';
import { bindGameSocketToStore } from './socketBindings';
import { WebSocketManager } from './ws';
import { installFakeWebSocket } from './ws.testUtils';

describe('bindGameSocketToStore', () => {
  let fakeWebSocket: ReturnType<typeof installFakeWebSocket>;
  const managers: WebSocketManager[] = [];

  beforeEach(() => {
    fakeWebSocket = installFakeWebSocket();
    useGameStore.getState().resetStore();
  });

  afterEach(() => {
    managers.forEach(manager => manager.disconnect());
    managers.length = 0;
    fakeWebSocket.cleanup();
  });

  it('T5: snapshot host sem binding não alimenta o estado competitivo', () => {
    const host = new WebSocketManager();
    const player = new WebSocketManager();
    managers.push(host, player);
    const unbindPlayer = bindGameSocketToStore(player);

    host.connect('123456', 'host');
    player.connect('123456', 'player');
    fakeWebSocket.sockets.forEach(socket => socket.open());

    fakeWebSocket.emit(fakeWebSocket.sockets[0], createServerEnvelope(
      ServerEventType.SNAPSHOT,
      {
        room: { pin: '123456', status: 'QUESTION_ACTIVE', roomVersion: 2, currentQuestionIndex: 0 },
        distribution: [{ optionId: 'a', count: 4, percentage: 100 }],
        correctOptionId: 'a',
      },
      2,
    ));
    fakeWebSocket.emit(fakeWebSocket.sockets[1], createServerEnvelope(
      ServerEventType.SNAPSHOT,
      {
        room: { pin: '123456', status: 'QUESTION_ACTIVE', roomVersion: 2, currentQuestionIndex: 0 },
        question: { id: 'q1', options: [{ id: 'a', label: 'A' }], durationMs: 60_000 },
        distribution: [],
        correctOptionId: null,
      },
      2,
    ));

    expect(useGameStore.getState().distribution).toEqual([]);
    expect(useGameStore.getState().correctOptionId).toBeNull();
    unbindPlayer();
  });

  it('preserva identidade Player aceita após snapshots subsequentes', () => {
    const player = new WebSocketManager();
    managers.push(player);
    const unbindPlayer = bindGameSocketToStore(player);
    useGameStore.getState().setPin('123456');
    player.connect('123456', 'player');
    fakeWebSocket.sockets[0].open();

    fakeWebSocket.emit(fakeWebSocket.sockets[0], createServerEnvelope(
      ServerEventType.SESSION_ACCEPTED,
      { playerId: 'player-1', nickname: 'Criador', reconnectToken: 'token-1', role: 'player' },
      1,
    ));
    fakeWebSocket.emit(fakeWebSocket.sockets[0], createServerEnvelope(
      ServerEventType.SNAPSHOT,
      {
        room: { pin: '123456', status: 'LOBBY', roomVersion: 2, currentQuestionIndex: -1 },
        players: [{ playerId: 'player-1', nickname: 'Criador', joinedAt: 1, eligibleFromQuestion: 0 }],
      },
      2,
    ));

    expect(useGameStore.getState()).toMatchObject({
      playerId: 'player-1',
      nickname: 'Criador',
      reconnectToken: 'token-1',
    });
    unbindPlayer();
  });
});

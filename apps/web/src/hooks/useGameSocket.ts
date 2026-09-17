import { useEffect, useCallback, useRef } from 'react';
import { wsManager } from '../lib/ws.js';
import { useGameStore } from '../stores/gameStore.js';
import { ServerEventType } from '@batalha/protocol';

/**
 * React hook that wires the WebSocket manager to the Zustand store.
 * Registers all server event handlers on mount, cleans up on unmount.
 * Returns { connect, disconnect, connectionState }.
 */
export function useGameSocket() {
  const store = useGameStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Register state change listener
    const unsubscribeState = wsManager.onStateChange((state) => {
      useGameStore.getState().setConnectionState(state);
    });

    // Register all server event handlers
    const unsubscribes = [
      // Session accepted — save identity and reconnect token
      wsManager.onEvent(ServerEventType.SESSION_ACCEPTED, (payload) => {
        useGameStore.getState().setSession({
          playerId: payload.playerId,
          reconnectToken: payload.reconnectToken,
          nickname: payload.nickname,
        });
      }),
      wsManager.onEvent(ServerEventType.SNAPSHOT, (payload) => {
        useGameStore.getState().handleSnapshot(payload);
      }),
      wsManager.onEvent(ServerEventType.PLAYER_JOINED, (payload) => {
        useGameStore.getState().handlePlayerJoined(payload);
      }),
      wsManager.onEvent(ServerEventType.PLAYER_PRESENCE_CHANGED, (payload) => {
        useGameStore.getState().handlePlayerPresenceChanged(payload);
      }),
      wsManager.onEvent(ServerEventType.GAME_STATE_CHANGED, (payload) => {
        useGameStore.getState().handleGameStateChanged(payload);
      }),
      wsManager.onEvent(ServerEventType.QUESTION_STARTED, (payload) => {
        useGameStore.getState().handleQuestionStarted(payload);
      }),
      wsManager.onEvent(ServerEventType.ANSWER_ACCEPTED, (payload) => {
        useGameStore.getState().handleAnswerAccepted(payload);
      }),
      wsManager.onEvent(ServerEventType.QUESTION_ENDED, (payload) => {
        useGameStore.getState().handleQuestionEnded(payload);
      }),
      wsManager.onEvent(ServerEventType.ANSWER_REVEAL, (payload) => {
        useGameStore.getState().handleAnswerReveal(payload);
      }),
      wsManager.onEvent(ServerEventType.RANKING_UPDATED, (payload) => {
        useGameStore.getState().handleRankingUpdated(payload);
      }),
      wsManager.onEvent(ServerEventType.ROOM_FINISHED, (payload) => {
        useGameStore.getState().handleRoomFinished(payload);
      }),
      // Error events
      wsManager.onEvent(ServerEventType.ERROR, (payload) => {
        console.error('[WS Error]', payload.code, payload.message);
      }),
      unsubscribeState,
    ];

    return () => {
      unsubscribes.forEach(unsub => unsub());
      wsManager.disconnect();
      initialized.current = false;
    };
  }, []);

  const connect = useCallback((pin: string, role: string, token?: string) => {
    useGameStore.getState().setPin(pin);
    useGameStore.getState().setRole(role as 'player' | 'host' | 'screen');
    wsManager.connect(pin, role, token);
  }, []);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
  }, []);

  return {
    connect,
    disconnect,
    connectionState: store.connectionState,
  };
}

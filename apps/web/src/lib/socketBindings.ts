import { ServerEventType } from '@batalha/protocol';
import { useGameStore } from '../stores/gameStore.js';
import type { WebSocketManager } from './ws.js';

export function bindGameSocketToStore(manager: WebSocketManager): () => void {
  const unsubscribes = [
    manager.onEvent(ServerEventType.SESSION_ACCEPTED, (payload) => {
      useGameStore.getState().setSession({
        playerId: payload.playerId,
        reconnectToken: payload.reconnectToken,
        nickname: payload.nickname,
      });
    }),
    manager.onEvent(ServerEventType.SNAPSHOT, payload => useGameStore.getState().handleSnapshot(payload)),
    manager.onEvent(ServerEventType.PLAYER_JOINED, payload => useGameStore.getState().handlePlayerJoined(payload)),
    manager.onEvent(ServerEventType.PLAYER_PRESENCE_CHANGED, payload => useGameStore.getState().handlePlayerPresenceChanged(payload)),
    manager.onEvent(ServerEventType.GAME_STATE_CHANGED, payload => useGameStore.getState().handleGameStateChanged(payload)),
    manager.onEvent(ServerEventType.QUESTION_STARTED, payload => useGameStore.getState().handleQuestionStarted(payload)),
    manager.onEvent(ServerEventType.ROUND_PROGRESS, payload => useGameStore.getState().handleRoundProgress(payload)),
    manager.onEvent(ServerEventType.ANSWER_ACCEPTED, payload => useGameStore.getState().handleAnswerAccepted(payload)),
    manager.onEvent(ServerEventType.ANSWER_REJECTED, payload => useGameStore.getState().handleAnswerRejected(payload)),
    manager.onEvent(ServerEventType.QUESTION_ENDED, payload => useGameStore.getState().handleQuestionEnded(payload)),
    manager.onEvent(ServerEventType.ANSWER_REVEAL, payload => useGameStore.getState().handleAnswerReveal(payload)),
    manager.onEvent(ServerEventType.RANKING_UPDATED, payload => useGameStore.getState().handleRankingUpdated(payload)),
    manager.onEvent(ServerEventType.ROOM_FINISHED, payload => useGameStore.getState().handleRoomFinished(payload)),
    manager.onEvent(ServerEventType.ERROR, (payload) => {
      console.error('[WS Error]', payload.code, payload.message);
    }),
  ];

  return () => unsubscribes.forEach(unsubscribe => unsubscribe());
}

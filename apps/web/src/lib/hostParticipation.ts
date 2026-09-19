import { ServerEventType } from '@batalha/protocol';
import type { WebSocketManager } from './ws.js';

export type HostParticipationMode = 'presenter' | 'player';

const participationKey = (pin: string) => `batalha_host_participation_${pin}`;

export function getHostParticipation(pin: string): HostParticipationMode {
  if (typeof localStorage === 'undefined') return 'presenter';
  return localStorage.getItem(participationKey(pin)) === 'player' ? 'player' : 'presenter';
}

export function setHostParticipation(pin: string, mode: HostParticipationMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(participationKey(pin), mode);
}

export class PlayerJoinError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlayerJoinError';
  }
}

export function joinCreatedRoomAsPlayer(
  pin: string,
  nickname: string,
  manager: WebSocketManager,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let joinSent = false;

    const cleanup = () => {
      unsubscribeState();
      unsubscribeAccepted();
      unsubscribeError();
    };
    const sendJoinOnce = () => {
      if (joinSent) return;
      joinSent = true;
      manager.joinRoom(pin, nickname);
    };
    const unsubscribeState = manager.onStateChange((state) => {
      if (state === 'connected') sendJoinOnce();
    });
    const unsubscribeAccepted = manager.onEvent(ServerEventType.SESSION_ACCEPTED, () => {
      cleanup();
      resolve();
    });
    const unsubscribeError = manager.onEvent(ServerEventType.ERROR, (payload) => {
      cleanup();
      reject(new PlayerJoinError(payload.code ?? 'JOIN_FAILED', payload.message ?? 'Não foi possível entrar na sala.'));
    });

    manager.connect(pin, 'player');
    if (manager.state === 'connected') sendJoinOnce();
  });
}

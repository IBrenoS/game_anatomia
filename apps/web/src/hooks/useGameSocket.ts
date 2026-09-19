import { useCallback, useEffect, useState } from 'react';
import {
  getWebSocketManager,
  type ConnectionState,
  type GameSocketRole,
} from '../lib/ws.js';
import { bindGameSocketToStore } from '../lib/socketBindings.js';
import { useGameStore } from '../stores/gameStore.js';

interface UseGameSocketOptions {
  syncStore?: boolean;
}

export function useGameSocket(
  role: GameSocketRole,
  options: UseGameSocketOptions = {},
) {
  const manager = getWebSocketManager(role);
  const [connectionState, setConnectionState] = useState<ConnectionState>(manager.state);
  const syncStore = options.syncStore ?? true;

  useEffect(() => {
    setConnectionState(manager.state);
    const unsubscribeState = manager.onStateChange(setConnectionState);
    const unsubscribeStore = syncStore ? bindGameSocketToStore(manager) : () => undefined;

    return () => {
      unsubscribeState();
      unsubscribeStore();
    };
  }, [manager, syncStore]);

  const connect = useCallback((pin: string, token?: string) => {
    useGameStore.getState().setPin(pin);
    manager.connect(pin, role, token);
  }, [manager, role]);

  const disconnect = useCallback(() => {
    manager.disconnect();
  }, [manager]);

  return { manager, connect, disconnect, connectionState };
}

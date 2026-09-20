import { useNavigate } from 'react-router';
import type { RankingEntry } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';
import { useGameSocket } from '../../hooks/useGameSocket.js';
import CollectiveCeremony, { type CeremonyPhase } from '../shared/CollectiveCeremony.js';

interface HostPodiumProps {
  podium: RankingEntry[];
  initialStep?: number;
  initialPhase?: CeremonyPhase;
  roomState?: string | null;
}

export default function HostPodium({ podium, initialStep, initialPhase, roomState }: HostPodiumProps) {
  const navigate = useNavigate();
  const startedAt = useGameStore((s) => s.startedAt);
  const podiumStartedAt = useGameStore((s) => s.podiumStartedAt);
  const hostSocket = useGameSocket('host', { syncStore: false });

  const effectivePodiumStartedAt = podiumStartedAt ?? startedAt;
  const elapsed = effectivePodiumStartedAt ? Math.max(0, Date.now() - effectivePodiumStartedAt) : 0;

  // Derive initial thanks phase only if roomState is FINISHED and ceremony duration has fully passed (> 13s)
  // or if no start time is available. Otherwise let the continuous ceremony reach thanks on schedule.
  const effectiveInitialPhase =
    initialPhase ??
    (roomState === 'FINISHED' && (!effectivePodiumStartedAt || elapsed >= 13000) ? 'thanks' : undefined);

  const handleNewGame = () => {
    hostSocket.disconnect();
    useGameStore.getState().resetStore();
    navigate('/host');
  };

  const handleExit = () => {
    hostSocket.disconnect();
    useGameStore.getState().resetStore();
    navigate('/');
  };

  return (
    <CollectiveCeremony
      mode="host"
      podium={podium}
      initialStep={initialStep}
      initialPhase={effectiveInitialPhase}
      phaseStartedAt={effectivePodiumStartedAt}
      roomState={roomState}
      onNewGame={handleNewGame}
      onExit={handleExit}
    />
  );
}

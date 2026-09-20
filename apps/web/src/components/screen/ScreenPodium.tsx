import type { RankingEntry } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';
import CollectiveCeremony, { type CeremonyPhase } from '../shared/CollectiveCeremony.js';

interface ScreenPodiumProps {
  podium: RankingEntry[];
  initialStep?: number;
  initialPhase?: CeremonyPhase;
  roomState?: string | null;
}

export default function ScreenPodium({ podium, initialStep, initialPhase, roomState }: ScreenPodiumProps) {
  const startedAt = useGameStore((s) => s.startedAt);
  const podiumStartedAt = useGameStore((s) => s.podiumStartedAt);

  const effectivePodiumStartedAt = podiumStartedAt ?? startedAt;
  const elapsed = effectivePodiumStartedAt ? Math.max(0, Date.now() - effectivePodiumStartedAt) : 0;

  // Derive initial thanks phase only if roomState is FINISHED and ceremony duration has fully passed (> 13s)
  // or if no start time is available. Otherwise let the continuous ceremony reach thanks on schedule.
  const effectiveInitialPhase =
    initialPhase ??
    (roomState === 'FINISHED' && (!effectivePodiumStartedAt || elapsed >= 13000) ? 'thanks' : undefined);

  return (
    <CollectiveCeremony
      mode="screen"
      podium={podium}
      initialStep={initialStep}
      initialPhase={effectiveInitialPhase}
      phaseStartedAt={effectivePodiumStartedAt}
      roomState={roomState}
    />
  );
}

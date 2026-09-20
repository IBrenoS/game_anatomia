import { useEffect, useState } from 'react';
import { DEFAULT_QUESTION_DURATION_MS } from '@batalha/protocol';

interface CountdownTimerProps {
  deadlineAt: number | null;
  startedAt?: number | null;
  paused?: boolean;
  remainingMs?: number | null;
}

export default function CountdownTimer({
  deadlineAt,
  startedAt,
  paused = false,
  remainingMs = null,
}: CountdownTimerProps) {
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [percent, setPercent] = useState<number>(100);

  useEffect(() => {
    if (paused) {
      const frozenMs = Math.max(0, remainingMs ?? 0);
      setRemainingSec(Math.ceil(frozenMs / 1000));
      const totalDuration = startedAt && deadlineAt ? Math.max(1, deadlineAt - startedAt) : DEFAULT_QUESTION_DURATION_MS;
      setPercent(Math.min(100, Math.max(0, (frozenMs / totalDuration) * 100)));
      return;
    }
    if (!deadlineAt) return;

    const totalDuration = startedAt ? Math.max(1, deadlineAt - startedAt) : DEFAULT_QUESTION_DURATION_MS;

    const update = () => {
      const now = Date.now();
      const leftMs = Math.max(0, deadlineAt - now);
      const leftSec = Math.ceil(leftMs / 1000);
      setRemainingSec(leftSec);
      setPercent(Math.min(100, Math.max(0, (leftMs / totalDuration) * 100)));
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [deadlineAt, paused, remainingMs, startedAt]);

  const isUrgent = remainingSec <= 10;

  return (
    <div className="w-full my-1 sm:my-1.5" aria-label={`Tempo restante: ${remainingSec} segundos`}>
      {/* Time remaining label - right-aligned over progress bar */}
      <div className="flex justify-between items-center text-xs font-bold mb-1">
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          {paused ? 'Pausado' : 'Tempo'}
        </span>
        <span
          className={`font-mono text-sm font-black transition-colors ${
            isUrgent ? 'text-[#DC2626] animate-pulse' : 'text-[#D05F36]'
          }`}
          aria-hidden="true"
        >
          {remainingSec}s
        </span>
      </div>

      {/* Deep green progress bar matching redesign */}
      <div className="w-full bg-[#E5E0D5] h-2 sm:h-2.5 rounded-full overflow-hidden p-0">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            isUrgent ? 'bg-[#DC2626]' : 'bg-[#123829]'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

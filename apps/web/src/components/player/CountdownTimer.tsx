import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  deadlineAt: number | null;
  startedAt?: number | null;
  paused?: boolean;
  remainingMs?: number | null;
}

export default function CountdownTimer({ deadlineAt, startedAt, paused = false, remainingMs = null }: CountdownTimerProps) {
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [percent, setPercent] = useState<number>(100);

  useEffect(() => {
    if (paused) {
      const frozenMs = Math.max(0, remainingMs ?? 0);
      setRemainingSec(Math.ceil(frozenMs / 1000));
      const totalDuration = startedAt && deadlineAt ? Math.max(1, deadlineAt - startedAt) : 60_000;
      setPercent(Math.min(100, Math.max(0, (frozenMs / totalDuration) * 100)));
      return;
    }
    if (!deadlineAt) return;

    const totalDuration = startedAt ? Math.max(1, deadlineAt - startedAt) : 60000;

    const update = () => {
      const now = Date.now();
      const leftMs = Math.max(0, deadlineAt - now);
      const leftSec = Math.ceil(leftMs / 1000);
      setRemainingSec(leftSec);
      setPercent(Math.min(100, Math.max(0, (leftMs / totalDuration) * 100)));
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [deadlineAt, paused, remainingMs, startedAt]);

  const isUrgent = remainingSec <= 10;

  return (
    <div className="w-full my-2" aria-label={`Tempo restante: ${remainingSec} segundos`}>
      <div className="flex justify-between items-center mb-1 text-xs font-bold text-blue-200">
        <span className="uppercase tracking-wider">{paused ? 'Tempo Pausado' : 'Tempo Restante'}</span>
        <span 
          className={`font-mono text-base font-black px-2 py-0.5 rounded-md ${
            isUrgent ? 'bg-red-500 text-white motion-safe:animate-pulse' : 'bg-black/30 text-yellow-300'
          }`}
          aria-hidden="true"
        >
          {remainingSec}s
        </span>
      </div>
      <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
        <div 
          className={`h-full rounded-full transition-all duration-200 ${
            isUrgent ? 'bg-red-500' : remainingSec <= 20 ? 'bg-yellow-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

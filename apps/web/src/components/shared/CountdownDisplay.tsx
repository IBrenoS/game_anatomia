import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore.js';
import { soundManager } from '../../lib/sound.js';

interface CountdownDisplayProps {
  mode?: 'player' | 'screen' | 'host';
  onComplete?: () => void;
}

export default function CountdownDisplay({ mode = 'player', onComplete }: CountdownDisplayProps) {
  const startedAt = useGameStore((s) => s.startedAt);
  const deadlineAt = useGameStore((s) => s.deadlineAt);
  const countdownStartedAt = useGameStore((s) => s.countdownStartedAt);
  const countdownKind = useGameStore((s) => s.countdownKind);

  // Effective start and end times
  const effectiveStart = countdownStartedAt || startedAt || Date.now();
  const effectiveDeadline = deadlineAt && deadlineAt > effectiveStart ? deadlineAt : effectiveStart + 3000;

  const [count, setCount] = useState<number>(3);
  const lastBeepRef = useRef<number | null>(null);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, effectiveDeadline - now);
      const currentCount = Math.min(3, Math.max(1, Math.ceil(remainingMs / 1000)));

      setCount(currentCount);

      // Play sound on each distinct tick if sound is enabled
      if (lastBeepRef.current !== currentCount && currentCount >= 1 && currentCount <= 3) {
        lastBeepRef.current = currentCount;
        soundManager.playCountdownBeep(currentCount);
      }

      if (remainingMs === 0) {
        soundManager.playCountdownGo();
        if (onComplete) onComplete();
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 100);
    return () => clearInterval(timer);
  }, [effectiveDeadline, onComplete]);

  if (mode === 'screen') {
    const isResume = countdownKind === 'RESUME';
    return (
      <div className="flex-1 flex flex-col items-center justify-center select-none text-center p-8">
        <span className="text-2xl md:text-3xl font-bold uppercase tracking-widest text-blue-300 bg-blue-950/60 px-8 py-2 rounded-full border border-blue-400/30 mb-8 animate-pulse">
          {isResume ? 'Retomando Partida!' : 'Prepare-se!'}
        </span>

        <div className="relative flex items-center justify-center my-6">
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border-8 border-yellow-400/40 bg-black/40 flex items-center justify-center shadow-[0_0_60px_rgba(250,204,21,0.5)]">
            <span
              key={count}
              className="text-9xl md:text-[14rem] font-black text-yellow-300 font-mono drop-shadow-[0_0_35px_rgba(250,204,21,0.9)] animate-[scaleIn_0.35s_ease-out] motion-reduce:animate-none"
            >
              {count}
            </span>
          </div>
        </div>

        <p className="text-3xl font-medium text-blue-200 mt-8">
          {isResume ? 'A rodada continuará de onde parou!' : 'A próxima questão vai começar!'}
        </p>
      </div>
    );
  }

  if (mode === 'host') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <span className="text-base font-bold uppercase tracking-widest text-blue-300 mb-4">
          Prepare-se!
        </span>
        <div className="w-36 h-36 rounded-full border-4 border-yellow-400 bg-black/40 flex items-center justify-center shadow-lg my-4">
          <span
            key={count}
            className="text-7xl font-black text-yellow-300 font-mono animate-[scaleIn_0.3s_ease-out] motion-reduce:animate-none"
          >
            {count}
          </span>
        </div>
        <p className="text-lg font-semibold text-white mt-2">
          Sincronizando clientes e preparando a pergunta...
        </p>
      </div>
    );
  }

  // Player mobile mode
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white text-center p-6 select-none">
      <div className="bg-black/35 p-8 rounded-3xl border border-white/15 backdrop-blur-md w-full max-w-sm flex flex-col items-center shadow-2xl">
        <h2 className="text-3xl font-black mb-2 text-yellow-300 tracking-tight">
          Prepare-se!
        </h2>
        <p className="text-sm text-blue-200 mb-6">
          A questão vai começar em instantes.
        </p>

        <div className="w-36 h-36 rounded-full border-4 border-yellow-400/60 bg-yellow-950/30 flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.4)] my-2">
          <span
            key={count}
            className="text-7xl font-mono font-black text-yellow-300 animate-[scaleIn_0.3s_ease-out] motion-reduce:animate-none"
          >
            {count}
          </span>
        </div>

        <p className="text-xs text-blue-300/80 mt-6 font-medium">
          Olhe para o telão
        </p>
      </div>
    </div>
  );
}

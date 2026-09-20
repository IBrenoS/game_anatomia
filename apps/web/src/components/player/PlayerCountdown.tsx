import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore.js';
import { soundManager } from '../../lib/sound.js';

export default function PlayerCountdown() {
  const startedAt = useGameStore((s) => s.startedAt);
  const deadlineAt = useGameStore((s) => s.deadlineAt);
  const countdownStartedAt = useGameStore((s) => s.countdownStartedAt);
  const countdownKind = useGameStore((s) => s.countdownKind);

  const effectiveStart = countdownStartedAt || startedAt || Date.now();
  const effectiveDeadline = deadlineAt && deadlineAt > effectiveStart ? deadlineAt : effectiveStart + 3000;

  const isResume = countdownKind === 'RESUME';
  const isInitial = countdownKind === 'INITIAL';
  const pillLabel = isResume ? 'RETOMANDO RODADA' : isInitial ? 'INÍCIO DA BATALHA' : 'PRÓXIMA QUESTÃO';
  const subtitle = isResume
    ? 'A rodada continuará do mesmo ponto. Olhos na pergunta.'
    : isInitial
    ? 'A batalha começa em instantes. Olhos na pergunta.'
    : 'A próxima rodada começa em instantes. Olhos na pergunta.';

  const [count, setCount] = useState<number>(3);
  const lastBeepRef = useRef<number | null>(null);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, effectiveDeadline - now);
      const currentCount = Math.min(3, Math.max(1, Math.ceil(remainingMs / 1000)));

      setCount(currentCount);

      if (lastBeepRef.current !== currentCount && currentCount >= 1 && currentCount <= 3) {
        lastBeepRef.current = currentCount;
        soundManager.playCountdownBeep(currentCount);
      }

      if (remainingMs === 0) {
        soundManager.playCountdownGo();
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 100);
    return () => clearInterval(timer);
  }, [effectiveDeadline]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 select-none w-full max-w-4xl mx-auto animate-scale-in relative">
      {/* Decorative ambient radial glow */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-b from-[#123829]/5 to-transparent rounded-full blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />

      {/* 2-column layout on md+, stacked on mobile */}
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-center">
        {/* Left Column (Desktop: Brand, Section Pill, Headline, Subtitle) */}
        <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left">
          {/* Brand Header */}
          <div className="flex flex-col mb-3 sm:mb-4">
            <span className="text-[11px] sm:text-xs font-black tracking-widest text-[#123829] uppercase">
              BATALHA ANATÔMICA
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#648B68] uppercase">
              BOVINO <span className="text-[#D05F36]">×</span> EQUINO
            </span>
          </div>

          {/* Section Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBEBE8] border border-[#D05F36]/30 text-[#D05F36] text-[11px] sm:text-xs font-black tracking-wider uppercase mb-3 sm:mb-4 shadow-xs">
            {pillLabel}
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl font-black text-[#122017] tracking-tight mb-2">
            Fique pronto.
          </h1>
          <p className="text-xs sm:text-sm text-[#555E57] font-medium max-w-sm">
            {subtitle}
          </p>
        </div>

        {/* Right Column (Desktop: Giant Circular Counter, Guidance) */}
        <div className="md:col-span-6 flex flex-col items-center text-center">
          {/* Giant Circular Countdown Counter with Deep Green Ring */}
          <div className="relative my-3 sm:my-4 flex items-center justify-center">
            <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full border-[6px] sm:border-[8px] border-[#123829] bg-white flex items-center justify-center shadow-xl shadow-[#123829]/15 relative">
              <span
                key={count}
                className="text-7xl sm:text-9xl font-black text-[#123829] font-mono animate-number-pulse select-none"
              >
                {count}
              </span>
            </div>
            {/* Subtle surrounding glow */}
            <div className="absolute inset-0 rounded-full bg-[#123829]/10 blur-2xl pointer-events-none" aria-hidden="true" />
          </div>

          {/* Guidance Subtitle */}
          <p className="text-xs sm:text-sm font-bold text-[#123829] tracking-wider uppercase mt-4 sm:mt-6 flex items-center gap-2">
            <span>Respire.</span>
            <span className="w-1 h-1 rounded-full bg-[#648B68]" />
            <span>Observe.</span>
            <span className="w-1 h-1 rounded-full bg-[#648B68]" />
            <span>Responda.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

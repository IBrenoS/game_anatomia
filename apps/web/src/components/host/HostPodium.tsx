import { useState, useEffect } from 'react';
import type { RankingEntry } from '@batalha/protocol';

interface HostPodiumProps {
  podium: RankingEntry[];
}

export default function HostPodium({ podium }: HostPodiumProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ceremonyStep, setCeremonyStep] = useState<number>(0);

  useEffect(() => {
    const isReduced = typeof window !== 'undefined' 
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(isReduced);

    if (isReduced) {
      setCeremonyStep(3);
      return;
    }

    if (podium.length === 1) {
      const t1 = setTimeout(() => setCeremonyStep(3), 1200);
      return () => clearTimeout(t1);
    }

    if (podium.length === 2) {
      const t1 = setTimeout(() => setCeremonyStep(2), 1200);
      const t2 = setTimeout(() => setCeremonyStep(3), 2800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    // 3+ players
    const t1 = setTimeout(() => setCeremonyStep(1), 1200);
    const t2 = setTimeout(() => setCeremonyStep(2), 2800);
    const t3 = setTimeout(() => setCeremonyStep(3), 4600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [podium.length]);

  if (!podium || podium.length === 0) return <div className="text-white text-center py-12">Aguardando definição do pódio...</div>;

  const first = podium.find(p => p.position === 1);
  const second = podium.find(p => p.position === 2);
  const third = podium.find(p => p.position === 3);

  const showThird = reducedMotion || ceremonyStep >= 1;
  const showSecond = reducedMotion || ceremonyStep >= 2;
  const showFirst = reducedMotion || ceremonyStep >= 3;

  return (
    <div className="flex flex-col h-full text-white items-center justify-center max-w-4xl mx-auto w-full select-none">
      <div className="text-center mb-8">
        <span className="text-sm font-bold uppercase tracking-widest text-yellow-300 bg-yellow-950/60 px-4 py-1.5 rounded-full border border-yellow-500/30">
          Cerimônia Final
        </span>
        <h2 className="text-3xl md:text-5xl font-black mt-2 text-yellow-400 drop-shadow-md">
          🏆 Pódio dos Campeões
        </h2>
      </div>

      {/* Adaptive Podium Layout */}
      {podium.length === 1 ? (
        <div className="flex items-end justify-center h-80 w-full max-w-sm mx-auto">
          <div className="flex flex-col items-center w-full z-20 min-h-[280px] justify-end">
            {first && showFirst ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.6s_ease-out]' : ''}`}>
                <div className="text-3xl mb-1">🏆</div>
                <div className="text-lg md:text-2xl font-black mb-1 text-yellow-300 truncate w-full text-center">{first.nickname}</div>
                <div className="text-sm md:text-base font-mono font-black mb-2 text-yellow-400 bg-yellow-950/50 px-4 py-1 rounded-full border border-yellow-500/40">{first.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 h-60 rounded-t-2xl flex items-start justify-center pt-4 shadow-2xl border-t-4 border-yellow-200 ring-2 ring-yellow-400/40">
                  <span className="text-5xl font-black text-yellow-950">1º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-60 rounded-t-2xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
                <span className="text-slate-600 font-bold">...</span>
              </div>
            )}
          </div>
        </div>
      ) : podium.length === 2 ? (
        <div className="flex items-end justify-center gap-6 h-80 w-full max-w-xl mx-auto">
          {/* Segundo Lugar (Silver) */}
          <div className="flex flex-col items-center w-1/2 z-10 min-h-[220px] justify-end">
            {second && showSecond ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.5s_ease-out]' : ''}`}>
                <div className="text-base md:text-lg font-bold mb-1 text-slate-300 truncate w-full text-center">{second.nickname}</div>
                <div className="text-xs md:text-sm font-mono font-bold mb-2 text-slate-300 bg-black/40 px-3 py-1 rounded-full">{second.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-slate-300 to-slate-500 h-44 rounded-t-2xl flex items-start justify-center pt-3 shadow-lg border-t-4 border-white">
                  <span className="text-4xl font-black text-slate-800">2º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-44 rounded-t-2xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
                <span className="text-slate-600 font-bold">...</span>
              </div>
            )}
          </div>

          {/* Primeiro Lugar (Gold Champion) */}
          <div className="flex flex-col items-center w-1/2 z-20 min-h-[280px] justify-end">
            {first && showFirst ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.6s_ease-out]' : ''}`}>
                <div className="text-3xl mb-1">🏆</div>
                <div className="text-lg md:text-2xl font-black mb-1 text-yellow-300 truncate w-full text-center">{first.nickname}</div>
                <div className="text-sm md:text-base font-mono font-black mb-2 text-yellow-400 bg-yellow-950/50 px-4 py-1 rounded-full border border-yellow-500/40">{first.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 h-60 rounded-t-2xl flex items-start justify-center pt-4 shadow-2xl border-t-4 border-yellow-200 ring-2 ring-yellow-400/40">
                  <span className="text-5xl font-black text-yellow-950">1º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-60 rounded-t-2xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
                <span className="text-slate-600 font-bold">...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-end justify-center gap-4 h-80 w-full max-w-3xl mx-auto">
          {/* Segundo Lugar (Silver) */}
          <div className="flex flex-col items-center w-1/3 z-10 min-h-[220px] justify-end">
            {second && showSecond ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.5s_ease-out]' : ''}`}>
                <div className="text-base md:text-lg font-bold mb-1 text-slate-300 truncate w-full text-center">{second.nickname}</div>
                <div className="text-xs md:text-sm font-mono font-bold mb-2 text-slate-300 bg-black/40 px-3 py-1 rounded-full">{second.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-slate-300 to-slate-500 h-44 rounded-t-2xl flex items-start justify-center pt-3 shadow-lg border-t-4 border-white">
                  <span className="text-4xl font-black text-slate-800">2º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-44 rounded-t-2xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
                <span className="text-slate-600 font-bold">...</span>
              </div>
            )}
          </div>

          {/* Primeiro Lugar (Gold Champion) */}
          <div className="flex flex-col items-center w-1/3 z-20 min-h-[280px] justify-end">
            {first && showFirst ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.6s_ease-out]' : ''}`}>
                <div className="text-3xl mb-1">🏆</div>
                <div className="text-lg md:text-2xl font-black mb-1 text-yellow-300 truncate w-full text-center">{first.nickname}</div>
                <div className="text-sm md:text-base font-mono font-black mb-2 text-yellow-400 bg-yellow-950/50 px-4 py-1 rounded-full border border-yellow-500/40">{first.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 h-60 rounded-t-2xl flex items-start justify-center pt-4 shadow-2xl border-t-4 border-yellow-200 ring-2 ring-yellow-400/40">
                  <span className="text-5xl font-black text-yellow-950">1º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-60 rounded-t-2xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
                <span className="text-slate-600 font-bold">...</span>
              </div>
            )}
          </div>

          {/* Terceiro Lugar (Bronze) */}
          <div className="flex flex-col items-center w-1/3 z-0 min-h-[180px] justify-end">
            {third && showThird ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.5s_ease-out]' : ''}`}>
                <div className="text-sm md:text-base font-bold mb-1 text-amber-500 truncate w-full text-center">{third.nickname}</div>
                <div className="text-xs font-mono font-bold mb-2 text-amber-400 bg-black/40 px-3 py-1 rounded-full">{third.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-amber-600 to-amber-800 h-32 rounded-t-2xl flex items-start justify-center pt-3 shadow border-t-4 border-amber-400">
                  <span className="text-3xl font-black text-amber-950">3º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-32 rounded-t-2xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
                <span className="text-slate-600 font-bold">...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

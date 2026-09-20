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

  if (!podium || podium.length === 0) return <div className="text-[#555E57] text-center py-12">Aguardando definição do pódio...</div>;

  const first = podium.find(p => p.position === 1);
  const second = podium.find(p => p.position === 2);
  const third = podium.find(p => p.position === 3);

  const showThird = reducedMotion || ceremonyStep >= 1;
  const showSecond = reducedMotion || ceremonyStep >= 2;
  const showFirst = reducedMotion || ceremonyStep >= 3;

  return (
    <div className="flex flex-col h-full text-[#122017] items-center justify-center max-w-4xl mx-auto w-full select-none p-4 sm:p-6">
      <div className="text-center mb-6 sm:mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-[#B45309] bg-[#FEF9EE] px-3.5 py-1 rounded-full border border-[#F59E0B]/40 shadow-xs">
          Cerimônia Final
        </span>
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mt-2 text-[#122017] tracking-tight">
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
                <div className="text-base sm:text-xl font-black mb-1 text-[#122017] truncate w-full text-center">{first.nickname}</div>
                <div className="text-xs sm:text-sm font-mono font-black mb-2 text-[#B45309] bg-[#FEF9EE] px-3.5 py-0.5 rounded-full border border-[#F59E0B]/40 shadow-xs">{first.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-[#FEF9EE] to-[#FDE68A] h-60 rounded-t-2xl flex items-start justify-center pt-4 shadow-lg border-t-4 border-[#F59E0B] ring-2 ring-[#F59E0B]/20">
                  <span className="text-5xl font-black text-[#B45309]">1º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-60 rounded-t-2xl bg-white/60 border-t-2 border-[#E2DDD2] flex items-center justify-center">
                <span className="text-[#94A3B8] font-bold">...</span>
              </div>
            )}
          </div>
        </div>
      ) : podium.length === 2 ? (
        <div className="flex items-end justify-center gap-4 sm:gap-6 h-80 w-full max-w-xl mx-auto">
          {/* Segundo Lugar (Silver) */}
          <div className="flex flex-col items-center w-1/2 z-10 min-h-[220px] justify-end">
            {second && showSecond ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.5s_ease-out]' : ''}`}>
                <div className="text-sm sm:text-base font-bold mb-1 text-[#122017] truncate w-full text-center">{second.nickname}</div>
                <div className="text-xs font-mono font-bold mb-2 text-[#555E57] bg-white border border-[#E2DDD2] px-3 py-0.5 rounded-full shadow-xs">{second.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-white to-[#E2DDD2] h-44 rounded-t-2xl flex items-start justify-center pt-3 shadow-md border-t-4 border-[#94A3B8]">
                  <span className="text-4xl font-black text-[#475569]">2º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-44 rounded-t-2xl bg-white/60 border-t-2 border-[#E2DDD2] flex items-center justify-center">
                <span className="text-[#94A3B8] font-bold">...</span>
              </div>
            )}
          </div>

          {/* Primeiro Lugar (Gold Champion) */}
          <div className="flex flex-col items-center w-1/2 z-20 min-h-[280px] justify-end">
            {first && showFirst ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.6s_ease-out]' : ''}`}>
                <div className="text-3xl mb-1">🏆</div>
                <div className="text-base sm:text-xl font-black mb-1 text-[#122017] truncate w-full text-center">{first.nickname}</div>
                <div className="text-xs sm:text-sm font-mono font-black mb-2 text-[#B45309] bg-[#FEF9EE] px-3.5 py-0.5 rounded-full border border-[#F59E0B]/40 shadow-xs">{first.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-[#FEF9EE] to-[#FDE68A] h-60 rounded-t-2xl flex items-start justify-center pt-4 shadow-lg border-t-4 border-[#F59E0B] ring-2 ring-[#F59E0B]/20">
                  <span className="text-5xl font-black text-[#B45309]">1º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-60 rounded-t-2xl bg-white/60 border-t-2 border-[#E2DDD2] flex items-center justify-center">
                <span className="text-[#94A3B8] font-bold">...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-end justify-center gap-3 sm:gap-4 h-80 w-full max-w-3xl mx-auto">
          {/* Segundo Lugar (Silver) */}
          <div className="flex flex-col items-center w-1/3 z-10 min-h-[220px] justify-end">
            {second && showSecond ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.5s_ease-out]' : ''}`}>
                <div className="text-sm sm:text-base font-bold mb-1 text-[#122017] truncate w-full text-center">{second.nickname}</div>
                <div className="text-xs font-mono font-bold mb-2 text-[#555E57] bg-white border border-[#E2DDD2] px-3 py-0.5 rounded-full shadow-xs">{second.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-white to-[#E2DDD2] h-44 rounded-t-2xl flex items-start justify-center pt-3 shadow-md border-t-4 border-[#94A3B8]">
                  <span className="text-3xl sm:text-4xl font-black text-[#475569]">2º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-44 rounded-t-2xl bg-white/60 border-t-2 border-[#E2DDD2] flex items-center justify-center">
                <span className="text-[#94A3B8] font-bold">...</span>
              </div>
            )}
          </div>

          {/* Primeiro Lugar (Gold Champion) */}
          <div className="flex flex-col items-center w-1/3 z-20 min-h-[280px] justify-end">
            {first && showFirst ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.6s_ease-out]' : ''}`}>
                <div className="text-3xl mb-1">🏆</div>
                <div className="text-base sm:text-xl font-black mb-1 text-[#122017] truncate w-full text-center">{first.nickname}</div>
                <div className="text-xs sm:text-sm font-mono font-black mb-2 text-[#B45309] bg-[#FEF9EE] px-3.5 py-0.5 rounded-full border border-[#F59E0B]/40 shadow-xs">{first.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-[#FEF9EE] to-[#FDE68A] h-60 rounded-t-2xl flex items-start justify-center pt-4 shadow-lg border-t-4 border-[#F59E0B] ring-2 ring-[#F59E0B]/20">
                  <span className="text-4xl sm:text-5xl font-black text-[#B45309]">1º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-60 rounded-t-2xl bg-white/60 border-t-2 border-[#E2DDD2] flex items-center justify-center">
                <span className="text-[#94A3B8] font-bold">...</span>
              </div>
            )}
          </div>

          {/* Terceiro Lugar (Bronze) */}
          <div className="flex flex-col items-center w-1/3 z-0 min-h-[180px] justify-end">
            {third && showThird ? (
              <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[fadeIn_0.5s_ease-out]' : ''}`}>
                <div className="text-xs sm:text-sm font-bold mb-1 text-[#122017] truncate w-full text-center">{third.nickname}</div>
                <div className="text-xs font-mono font-bold mb-2 text-[#C95A34] bg-[#FDF6F0] border border-[#D05F36]/30 px-3 py-0.5 rounded-full shadow-xs">{third.totalPoints} pts</div>
                <div className="w-full bg-gradient-to-b from-[#FDF6F0] to-[#FED7AA] h-32 rounded-t-2xl flex items-start justify-center pt-3 shadow border-t-4 border-[#D05F36]">
                  <span className="text-2xl sm:text-3xl font-black text-[#9A3412]">3º</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-32 rounded-t-2xl bg-white/60 border-t-2 border-[#E2DDD2] flex items-center justify-center">
                <span className="text-[#94A3B8] font-bold">...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

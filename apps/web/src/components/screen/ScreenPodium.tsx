import { useState, useEffect } from 'react';
import type { RankingEntry } from '@batalha/protocol';
import { soundManager } from '../../lib/sound.js';

interface ScreenPodiumProps {
  podium: RankingEntry[];
  initialStep?: number;
}

export default function ScreenPodium({ podium, initialStep }: ScreenPodiumProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ceremonyStep, setCeremonyStep] = useState<number>(initialStep ?? 0);

  useEffect(() => {
    if (initialStep !== undefined) return;
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(isReduced);

    if (isReduced) {
      setCeremonyStep(3);
      return;
    }

    if (podium.length === 1) {
      const t1 = setTimeout(() => {
        setCeremonyStep(3);
        soundManager.playFanfare();
      }, 1200);
      return () => clearTimeout(t1);
    }

    if (podium.length === 2) {
      const t1 = setTimeout(() => {
        setCeremonyStep(2);
        soundManager.playRevealChime(true);
      }, 1200);
      const t2 = setTimeout(() => {
        setCeremonyStep(3);
        soundManager.playFanfare();
      }, 2800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    // 3+ players: Sequential podium reveals (3rd -> 2nd -> 1st)
    const t1 = setTimeout(() => {
      setCeremonyStep(1);
      soundManager.playRevealChime(true);
    }, 1200);

    const t2 = setTimeout(() => {
      setCeremonyStep(2);
      soundManager.playRevealChime(true);
    }, 2800);

    const t3 = setTimeout(() => {
      setCeremonyStep(3);
      soundManager.playFanfare();
    }, 4600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [podium.length]);

  if (!podium || podium.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
        <div className="w-12 h-12 border-4 border-[#D48B28] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-3xl font-black text-[#122017]">Preparando cerimônia do pódio...</h2>
      </div>
    );
  }

  const first = podium.find((p) => p.position === 1) || podium[0];
  const second = podium.find((p) => p.position === 2) || podium[1];
  const third = podium.find((p) => p.position === 3) || podium[2];

  const showThird = reducedMotion || ceremonyStep >= 1;
  const showSecond = reducedMotion || ceremonyStep >= 2;
  const showFirst = reducedMotion || ceremonyStep >= 3;

  return (
    <div className="relative flex flex-col h-full text-[#122017] p-6 md:p-10 lg:p-12 max-w-7xl 2xl:max-w-[1760px] mx-auto w-full justify-between select-none overflow-hidden animate-fade-in-scale">
      <style>{`
        @keyframes podiumSlideUp {
          from {
            opacity: 0;
            transform: translateY(80px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes confettiDrop {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(600px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Celebratory confetti when 1st place is revealed */}
      {showFirst && !reducedMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30" aria-hidden="true">
          {[...Array(28)].map((_, i) => {
            const colors = ['#D48B28', '#1FD4A7', '#D05F36', '#2D8058', '#F59E0B', '#94A3B8'];
            const color = colors[i % colors.length];
            const left = `${i * 3.6 + 1}%`;
            const animDuration = `${1.8 + (i % 5) * 0.4}s`;
            const animDelay = `${(i % 6) * 0.15}s`;
            const size = `${8 + (i % 6) * 3}px`;

            return (
              <div
                key={i}
                className="absolute rounded-xs shadow-xs"
                style={{
                  left,
                  top: '-10px',
                  width: size,
                  height: size,
                  backgroundColor: color,
                  animation: `confettiDrop ${animDuration} ease-out ${animDelay} infinite`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Header */}
      <header className="text-center mb-4 lg:mb-6 z-10 shrink-0">
        <span className="text-sm sm:text-base lg:text-lg font-black uppercase tracking-widest text-[#B45309] bg-[#FEF9EE] px-8 py-2 rounded-full border border-[#F59E0B]/50 shadow-xs">
          Cerimônia Oficial de Encerramento
        </span>
        <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black mt-3 text-[#122017] tracking-tight">
          🏆 PÓDIO DOS CAMPEÕES
        </h2>
      </header>

      {/* Adaptive Podium Structure */}
      <main className="flex-1 flex items-end justify-center my-auto z-10 w-full min-h-0">
        {podium.length === 1 ? (
          /* Solo Champion Podium */
          <div className="flex items-end justify-center h-[420px] sm:h-[480px] lg:h-[520px] w-full max-w-md 2xl:max-w-lg mx-auto">
            <div className="flex flex-col items-center w-full z-20 min-h-[380px] justify-end">
              {first && showFirst ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.8s_ease-out_both]' : ''}`}>
                  <div className="text-5xl sm:text-6xl mb-1 animate-bounce motion-reduce:animate-none">
                    🏆
                  </div>
                  <div className="text-3xl sm:text-5xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {first.nickname}
                  </div>
                  <div className="text-xl sm:text-3xl font-mono font-black mb-3 bg-[#FEF9EE] px-6 py-2 rounded-full border-2 border-[#F59E0B] shadow-xs text-[#B45309]">
                    {`${first.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#F59E0B] via-[#D48B28] to-[#92400E] h-72 sm:h-80 lg:h-96 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-[0_0_50px_rgba(212,139,40,0.35)] border-t-8 border-[#FEF3C7] ring-4 ring-[#F59E0B]/30">
                    <span className="text-7xl sm:text-9xl font-black text-amber-950/85 leading-none">1º</span>
                    <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-950 bg-[#FEF3C7] px-4 py-1 rounded-full mt-3 shadow-xs">
                      Campeão
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-72 sm:h-80 lg:h-96 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-2xl">...</span>
                </div>
              )}
            </div>
          </div>
        ) : podium.length === 2 ? (
          /* 2 Players Podium */
          <div className="flex items-end justify-center gap-6 sm:gap-8 h-[420px] sm:h-[480px] lg:h-[520px] w-full max-w-3xl 2xl:max-w-4xl mx-auto">
            {/* 2nd Place (Silver) */}
            <div className="flex flex-col items-center w-1/2 z-10 min-h-[320px] justify-end">
              {second && showSecond ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.7s_ease-out_both]' : ''}`}>
                  <div className="text-2xl sm:text-4xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {second.nickname}
                  </div>
                  <div className="text-lg sm:text-2xl font-mono font-bold mb-3 bg-white px-5 py-1.5 rounded-full border border-slate-300 text-[#122017] shadow-xs">
                    {`${second.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 h-52 sm:h-60 lg:h-64 rounded-t-3xl flex items-start justify-center pt-6 shadow-md border-t-8 border-white">
                    <span className="text-5xl sm:text-7xl font-black text-slate-800">2º</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-52 sm:h-60 lg:h-64 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-xl">...</span>
                </div>
              )}
            </div>

            {/* 1st Place (Gold Champion) */}
            <div className="flex flex-col items-center w-1/2 z-20 min-h-[380px] justify-end">
              {first && showFirst ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.8s_ease-out_both]' : ''}`}>
                  <div className="text-5xl sm:text-6xl mb-1 animate-bounce motion-reduce:animate-none">
                    🏆
                  </div>
                  <div className="text-3xl sm:text-5xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {first.nickname}
                  </div>
                  <div className="text-xl sm:text-3xl font-mono font-black mb-3 bg-[#FEF9EE] px-6 py-2 rounded-full border-2 border-[#F59E0B] shadow-xs text-[#B45309]">
                    {`${first.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#F59E0B] via-[#D48B28] to-[#92400E] h-72 sm:h-80 lg:h-96 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-[0_0_50px_rgba(212,139,40,0.35)] border-t-8 border-[#FEF3C7] ring-4 ring-[#F59E0B]/30">
                    <span className="text-7xl sm:text-9xl font-black text-amber-950/85 leading-none">1º</span>
                    <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-950 bg-[#FEF3C7] px-4 py-1 rounded-full mt-3 shadow-xs">
                      Campeão
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-72 sm:h-80 lg:h-96 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-2xl">...</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 3+ Players Full Podium (2nd - 1st - 3rd) */
          <div className="flex items-end justify-center gap-5 sm:gap-6 lg:gap-8 h-[420px] sm:h-[480px] lg:h-[520px] w-full max-w-5xl 2xl:max-w-6xl mx-auto">
            {/* 2nd Place (Silver) */}
            <div className="flex flex-col items-center w-1/3 z-10 min-h-[320px] justify-end">
              {second && showSecond ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.7s_ease-out_both]' : ''}`}>
                  <div className="text-xl sm:text-3xl lg:text-4xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {second.nickname}
                  </div>
                  <div className="text-base sm:text-xl lg:text-2xl font-mono font-bold mb-3 bg-white px-5 py-1.5 rounded-full border border-slate-300 text-[#122017] shadow-xs">
                    {`${second.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 h-52 sm:h-60 lg:h-64 rounded-t-3xl flex items-start justify-center pt-6 shadow-md border-t-8 border-white">
                    <span className="text-5xl sm:text-7xl font-black text-slate-800">2º</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-52 sm:h-60 lg:h-64 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-xl">...</span>
                </div>
              )}
            </div>

            {/* 1st Place (Gold Champion) */}
            <div className="flex flex-col items-center w-1/3 z-20 min-h-[380px] justify-end">
              {first && showFirst ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.8s_ease-out_both]' : ''}`}>
                  <div className="text-5xl sm:text-6xl mb-1 animate-bounce motion-reduce:animate-none">
                    🏆
                  </div>
                  <div className="text-2xl sm:text-4xl lg:text-5xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {first.nickname}
                  </div>
                  <div className="text-lg sm:text-2xl lg:text-3xl font-mono font-black mb-3 bg-[#FEF9EE] px-6 py-2 rounded-full border-2 border-[#F59E0B] shadow-xs text-[#B45309]">
                    {`${first.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#F59E0B] via-[#D48B28] to-[#92400E] h-72 sm:h-80 lg:h-96 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-[0_0_50px_rgba(212,139,40,0.35)] border-t-8 border-[#FEF3C7] ring-4 ring-[#F59E0B]/30">
                    <span className="text-7xl sm:text-9xl font-black text-amber-950/85 leading-none">1º</span>
                    <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-950 bg-[#FEF3C7] px-4 py-1 rounded-full mt-3 shadow-xs">
                      Campeão
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-72 sm:h-80 lg:h-96 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-2xl">...</span>
                </div>
              )}
            </div>

            {/* 3rd Place (Bronze / Terracotta) */}
            <div className="flex flex-col items-center w-1/3 z-0 min-h-[260px] justify-end">
              {third && showThird ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.6s_ease-out_both]' : ''}`}>
                  <div className="text-lg sm:text-2xl lg:text-3xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {third.nickname}
                  </div>
                  <div className="text-sm sm:text-lg lg:text-xl font-mono font-bold mb-3 bg-white px-4 py-1.5 rounded-full border border-[#D05F36]/40 text-[#D05F36] shadow-xs">
                    {`${third.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#E8A588] via-[#D05F36] to-[#A8382B] h-36 sm:h-44 lg:h-48 rounded-t-3xl flex items-start justify-center pt-5 shadow-md border-t-8 border-[#F5C2AF]">
                    <span className="text-4xl sm:text-6xl font-black text-amber-950/85">3º</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-36 sm:h-44 lg:h-48 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-lg">...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[#526B59] text-base sm:text-lg lg:text-xl font-bold mt-4 z-10 shrink-0">
        Parabéns a todos os participantes da Batalha Anatômica!
      </footer>
    </div>
  );
}

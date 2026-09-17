import { useState, useEffect } from 'react';
import type { RankingEntry } from '@batalha/protocol';
import { soundManager } from '../../lib/sound.js';

interface ScreenPodiumProps {
  podium: RankingEntry[];
}

export default function ScreenPodium({ podium }: ScreenPodiumProps) {
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

    // Sequential podium reveals:
    // Step 1 (1.2s): Reveal 3rd place (Bronze)
    const t1 = setTimeout(() => {
      setCeremonyStep(1);
      soundManager.playRevealChime(true);
    }, 1200);

    // Step 2 (2.8s): Reveal 2nd place (Silver)
    const t2 = setTimeout(() => {
      setCeremonyStep(2);
      soundManager.playRevealChime(true);
    }, 2800);

    // Step 3 (4.6s): Reveal 1st place (Gold Champion!) + Fanfare
    const t3 = setTimeout(() => {
      setCeremonyStep(3);
      soundManager.playFanfare();
    }, 4600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (!podium || podium.length === 0) return null;

  const first = podium.find(p => p.position === 1);
  const second = podium.find(p => p.position === 2);
  const third = podium.find(p => p.position === 3);

  const showThird = reducedMotion || ceremonyStep >= 1;
  const showSecond = reducedMotion || ceremonyStep >= 2;
  const showFirst = reducedMotion || ceremonyStep >= 3;

  return (
    <div className="relative flex flex-col h-full text-white p-8 md:p-12 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-[#1e3a5f] to-black justify-between select-none overflow-hidden">
      <style>{`
        @keyframes podiumSlideUp {
          from {
            opacity: 0;
            transform: translateY(120px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes confettiDrop {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Celebratory confetti elements when 1st place is revealed (disabled on motion-reduce) */}
      {showFirst && !reducedMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30" aria-hidden="true">
          {[...Array(24)].map((_, i) => {
            const colors = ['#facc15', '#38bdf8', '#4ade80', '#f43f5e', '#a855f7', '#fb923c'];
            const color = colors[i % colors.length];
            const left = `${(i * 4.2) + 2}%`;
            const animDuration = `${1.8 + (i % 5) * 0.4}s`;
            const animDelay = `${(i % 6) * 0.15}s`;
            const size = `${8 + (i % 6) * 3}px`;

            return (
              <div
                key={i}
                className="absolute rounded-sm"
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
      <div className="text-center mb-6 z-10">
        <span className="text-lg md:text-xl font-bold uppercase tracking-widest text-yellow-300 bg-yellow-950/70 px-8 py-2 rounded-full border border-yellow-500/40 shadow-lg">
          Cerimônia Oficial de Encerramento
        </span>
        <h2 className="text-5xl md:text-7xl font-black mt-4 text-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,0.8)]">
          🏆 PÓDIO DOS CAMPEÕES
        </h2>
      </div>

      {/* Podium Structure */}
      <div className="flex items-end justify-center gap-6 md:gap-8 h-[480px] md:h-[520px] w-full max-w-6xl mx-auto my-auto z-10">
        
        {/* Segundo Lugar (Silver) - Revealed at Step 2 */}
        <div className="flex flex-col items-center w-1/3 z-10 min-h-[360px] justify-end">
          {second && showSecond ? (
            <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.7s_ease-out_both]' : ''}`}>
              <div className="text-2xl md:text-4xl font-black mb-2 text-slate-200 truncate w-full text-center drop-shadow-md">
                {second.nickname}
              </div>
              <div className="text-xl md:text-2xl font-mono font-bold mb-3 bg-black/50 px-5 py-1.5 rounded-full border border-slate-300/30 text-slate-200">
                {second.totalPoints} pts
              </div>
              <div className="w-full bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600 h-60 md:h-64 rounded-t-3xl flex items-start justify-center pt-6 shadow-[0_0_30px_rgba(156,163,175,0.4)] border-t-8 border-white">
                <span className="text-6xl md:text-7xl font-black text-slate-900 drop-shadow-sm">2º</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-60 md:h-64 rounded-t-3xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
              <span className="text-slate-600 font-bold text-lg">...</span>
            </div>
          )}
        </div>

        {/* Primeiro Lugar (Gold Champion) - Revealed at Step 3 */}
        <div className="flex flex-col items-center w-1/3 z-20 min-h-[440px] justify-end">
          {first && showFirst ? (
            <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.8s_ease-out_both]' : ''}`}>
              <div className="text-5xl md:text-6xl mb-1 animate-bounce motion-reduce:animate-none">
                🏆
              </div>
              <div className="text-3xl md:text-5xl font-black mb-2 text-yellow-300 truncate w-full text-center drop-shadow-[0_0_20px_rgba(250,204,21,0.7)]">
                {first.nickname}
              </div>
              <div className="text-2xl md:text-3xl font-mono font-black mb-3 bg-yellow-500/25 px-6 py-2 rounded-full border-2 border-yellow-400/60 shadow-[0_0_25px_rgba(250,204,21,0.5)] text-yellow-300">
                {first.totalPoints} pts
              </div>
              <div className="w-full bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-600 h-80 md:h-96 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-[0_0_60px_rgba(250,204,21,0.7)] border-t-8 border-yellow-100 ring-4 ring-yellow-400/30">
                <span className="text-7xl md:text-9xl font-black text-yellow-950 drop-shadow-sm leading-none">1º</span>
                <span className="text-xs md:text-sm font-black tracking-widest uppercase text-yellow-950/80 bg-yellow-400/60 px-3 py-0.5 rounded-full mt-2">
                  Campeão
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-80 md:h-96 rounded-t-3xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
              <span className="text-slate-600 font-bold text-xl">...</span>
            </div>
          )}
        </div>

        {/* Terceiro Lugar (Bronze) - Revealed at Step 1 */}
        <div className="flex flex-col items-center w-1/3 z-0 min-h-[300px] justify-end">
          {third && showThird ? (
            <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.6s_ease-out_both]' : ''}`}>
              <div className="text-xl md:text-3xl font-black mb-2 text-amber-400 truncate w-full text-center drop-shadow-md">
                {third.nickname}
              </div>
              <div className="text-lg md:text-xl font-mono font-bold mb-3 bg-black/50 px-4 py-1 rounded-full border border-amber-500/30 text-amber-200">
                {third.totalPoints} pts
              </div>
              <div className="w-full bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 h-44 md:h-48 rounded-t-3xl flex items-start justify-center pt-5 shadow-[0_0_20px_rgba(217,119,6,0.4)] border-t-8 border-amber-400">
                <span className="text-5xl md:text-6xl font-black text-amber-950 drop-shadow-sm">3º</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-44 md:h-48 rounded-t-3xl bg-black/20 border-t-2 border-white/5 flex items-center justify-center">
              <span className="text-slate-600 font-bold text-base">...</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-blue-200 text-lg md:text-xl font-medium mt-4 z-10">
        Parabéns a todos os participantes da Batalha Anatômica!
      </div>
    </div>
  );
}

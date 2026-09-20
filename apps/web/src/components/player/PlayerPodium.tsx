import { useEffect, useRef, useState } from 'react';
import type { RankingEntry } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';
import { soundManager } from '../../lib/sound.js';

interface PlayerPodiumProps {
  podium: RankingEntry[];
  playerId: string | null;
}

export default function PlayerPodium({ podium, playerId }: PlayerPodiumProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const audioPlayedRef = useRef(false);

  const rankings = useGameStore((s) => s.rankings);
  const personalScore = useGameStore((s) => s.personalScore);

  const myEntry =
    podium.find((p) => p.playerId === playerId) ||
    rankings.find((p) => p.playerId === playerId);
  const position = myEntry?.position ?? personalScore.position;
  const isTop3 = Boolean(position && position >= 1 && position <= 3);
  const totalPoints = myEntry?.totalPoints ?? personalScore.totalPoints ?? 0;

  useEffect(() => {
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(isReduced);

    if (!audioPlayedRef.current && isTop3) {
      audioPlayedRef.current = true;
      if (position === 1) {
        soundManager.playGoldCue();
      } else if (position === 2) {
        soundManager.playSilverCue();
      } else if (position === 3) {
        soundManager.playBronzeCue();
      }
    }
  }, [isTop3, position]);

  // Confetti setup for individual celebration
  const confettiCount =
    reducedMotion || !isTop3 ? 0 : position === 1 ? 16 : 8;

  const confettiColors =
    position === 1
      ? ['#D48B28', '#F59E0B', '#2D8058', '#FEF3C7']
      : position === 2
      ? ['#94A3B8', '#CBD5E1', '#E2E8F0', '#64748B']
      : ['#D05F36', '#E8A588', '#FED7AA', '#9A3412'];

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-8 select-none w-full max-w-2xl mx-auto text-center animate-scale-in overflow-hidden">
      <style>{`
        @keyframes playerConfettiDrop {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(500px) rotate(540deg); opacity: 0; }
        }
      `}</style>

      {/* Controlled individual confetti burst */}
      {confettiCount > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20" aria-hidden="true">
          {Array.from({ length: confettiCount }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-xs shadow-xs"
              style={{
                left: `${(i * (100 / confettiCount) + (i % 2) * 2).toFixed(1)}%`,
                top: '-10px',
                width: `${7 + (i % 3) * 2}px`,
                height: `${7 + (i % 3) * 2}px`,
                backgroundColor: confettiColors[i % confettiColors.length],
                animation: `playerConfettiDrop ${1.8 + (i % 3) * 0.3}s ease-out ${(i % 4) * 0.12}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Brand Header */}
      <div className="flex flex-col items-center mb-4 z-10">
        <span className="text-[11px] sm:text-xs font-black tracking-widest text-[#123829] uppercase">
          BATALHA ANATÔMICA
        </span>
        <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#648B68] uppercase">
          BOVINO <span className="text-[#D05F36]">×</span> EQUINO
        </span>
      </div>

      {/* Section Pill */}
      <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-[#E2DDD2] text-[#123829] text-[11px] sm:text-xs font-black tracking-wider uppercase mb-5 shadow-xs z-10">
        CERIMÔNIA FINAL
      </div>

      {isTop3 ? (
        /* Top 3: Individual celebration by position */
        <div className="flex flex-col items-center z-10">
          {/* Specific icon per place: 1st Trophy, 2nd Silver Medal, 3rd Bronze Medal */}
          {position === 1 ? (
            <div className="text-6xl sm:text-7xl mb-3 select-none filter drop-shadow-[0_6px_16px_rgba(212,139,40,0.35)] animate-bounce motion-reduce:animate-none">
              🏆
            </div>
          ) : position === 2 ? (
            <div className="text-6xl sm:text-7xl mb-3 select-none filter drop-shadow-[0_4px_12px_rgba(148,163,184,0.35)]">
              🥈
            </div>
          ) : (
            <div className="text-6xl sm:text-7xl mb-3 select-none filter drop-shadow-[0_4px_12px_rgba(208,95,54,0.3)]">
              🥉
            </div>
          )}

          {/* Title & Subtitle */}
          <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-1">
            Você está no pódio.
          </h1>
          <p
            className={`text-base sm:text-xl font-black mb-1 ${
              position === 1
                ? 'text-[#D48B28]'
                : position === 2
                ? 'text-slate-600'
                : 'text-[#C95A34]'
            }`}
          >
            {`${position}º lugar · ${totalPoints} pontos`}
          </p>
          <p className="text-xs sm:text-sm font-bold text-[#2D8058] mb-3">
            Parabéns, você subiu ao pódio!
          </p>
          <p className="text-xs sm:text-sm text-[#555E57] font-medium max-w-md mb-6">
            A revelação final acontece no telão — sua conquista já está garantida.
          </p>

          {/* Preparation Callout Card */}
          <div
            className={`w-full max-w-md rounded-2xl p-4 shadow-xs mt-2 border ${
              position === 1
                ? 'bg-[#FEF9EE] border-[#F59E0B]/50 text-[#78350F]'
                : position === 2
                ? 'bg-[#F8FAFC] border-slate-300 text-slate-700'
                : 'bg-[#FDF6F0] border-[#D05F36]/30 text-[#9A3412]'
            }`}
          >
            <span
              className={`text-[11px] uppercase font-black tracking-wider block mb-1 ${
                position === 1
                  ? 'text-[#B45309]'
                  : position === 2
                  ? 'text-slate-700'
                  : 'text-[#C95A34]'
              }`}
            >
              PREPARE-SE PARA A CELEBRAÇÃO
            </span>
            <p className="text-xs font-semibold">
              {position === 1
                ? 'A celebração final vem a seguir. Sua conquista de 1º lugar fica registrada aqui.'
                : position === 2
                ? 'A celebração final vem a seguir. Sua conquista de prata fica registrada aqui.'
                : 'A celebração final vem a seguir. Sua conquista de bronze fica registrada aqui.'}
            </p>
          </div>
        </div>
      ) : (
        /* Outside Top 3: Positive Participation State */
        <div className="flex flex-col items-center z-10">
          <div className="text-5xl sm:text-6xl mb-4 select-none">
            👏
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-2">
            Excelente Participação!
          </h1>
          <p className="text-xs sm:text-sm text-[#555E57] font-medium max-w-md mb-6">
            A Batalha Anatômica foi concluída. Acompanhe os grandes campeões no telão da sala.
          </p>
          <div className="w-full max-w-md bg-white border border-[#E2DDD2] rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-bold text-[#64748B]">
              A revelação dos 3 primeiros colocados está acontecendo agora no telão.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

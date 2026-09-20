import type { RankingEntry } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';

interface PlayerRankingProps {
  ranking?: RankingEntry;
  isFinal: boolean;
  previousRankings?: RankingEntry[];
}

export default function PlayerRanking({
  ranking,
  isFinal,
  previousRankings: propPreviousRankings,
}: PlayerRankingProps) {
  const storePreviousRankings = useGameStore((s) => s.previousRankings);
  const previousRankings = propPreviousRankings ?? storePreviousRankings;
  const personalScore = useGameStore((s) => s.personalScore);

  if (!ranking) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 select-none w-full max-w-2xl mx-auto text-center animate-scale-in">
        <div className="w-10 h-10 border-3 border-[#123829] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl sm:text-2xl font-black text-[#122017] mb-2">
          Acompanhe a classificação no telão
        </h2>
        <p className="text-xs sm:text-sm text-[#555E57]">
          Sua pontuação será consolidada em breve.
        </p>
      </div>
    );
  }

  const isLeading = ranking.position === 1;
  const prevEntry = previousRankings.find((p) => p.playerId === ranking.playerId);
  const delta = prevEntry ? prevEntry.position - ranking.position : 0;
  const totalPoints = ranking.totalPoints ?? personalScore.totalPoints;
  const correctCount = ranking.correctCount ?? personalScore.correctCount;
  const distance = ranking.distanceToPrevious || 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 select-none w-full max-w-2xl mx-auto text-center animate-scale-in">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-4">
          <span className="text-[11px] sm:text-xs font-black tracking-widest text-[#123829] uppercase">
            BATALHA ANATÔMICA
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#648B68] uppercase">
            BOVINO <span className="text-[#D05F36]">×</span> EQUINO
          </span>
        </div>

        {/* Section Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E2DDD2] text-[#123829] text-[11px] sm:text-xs font-black tracking-wider uppercase mb-5 shadow-xs">
          {isFinal ? 'CLASSIFICAÇÃO GERAL' : 'CLASSIFICAÇÃO DA RODADA'}
        </div>

        {/* Position Section */}
        <div className="flex flex-col items-center my-2">
          <span className="text-[11px] uppercase font-black tracking-widest text-[#64748B] mb-1">
            SUA POSIÇÃO
          </span>

          {/* Huge Position Display */}
          <div
            className={`text-6xl sm:text-8xl font-black font-mono tracking-tight my-1 ${
              isLeading ? 'text-[#D48B28] animate-gold-glow' : 'text-[#122017]'
            }`}
          >
            {`#${ranking.position}`}
          </div>

          {/* Rank Movement Pill Indicator */}
          <div className="mt-2 mb-3">
            {isLeading ? (
              <div className="bg-[#EAF5EC] text-[#2D8058] border border-[#2D8058]/30 text-xs font-black px-3.5 py-1 rounded-full shadow-xs flex items-center gap-1.5 animate-scale-in">
                <span>↑</span>
                <span>Assumiu a liderança</span>
              </div>
            ) : prevEntry && delta > 0 ? (
              <div className="bg-[#EAF5EC] text-[#2D8058] border border-[#2D8058]/30 text-xs font-black px-3.5 py-1 rounded-full shadow-xs flex items-center gap-1.5 animate-scale-in">
                <span>↑</span>
                <span>{`Subiu ${delta} ${delta === 1 ? 'posição' : 'posições'}`}</span>
              </div>
            ) : prevEntry && delta < 0 ? (
              <div className="bg-[#FBEBE8] text-[#C95A34] border border-[#C95A34]/30 text-xs font-black px-3.5 py-1 rounded-full shadow-xs flex items-center gap-1.5 animate-scale-in">
                <span>↓</span>
                <span>{`Caiu ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'posição' : 'posições'}`}</span>
              </div>
            ) : (
              <div className="bg-[#EFEFEA] text-[#555E57] border border-[#D5DDD0] text-xs font-black px-3.5 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <span>—</span>
                <span>Manteve a posição</span>
              </div>
            )}
          </div>

          {/* Distance Callout or Leading Badge */}
          {isLeading ? (
            <div className="bg-[#FEF9EE] border border-[#F59E0B]/50 text-[#B45309] text-xs sm:text-sm font-black py-2 px-5 rounded-2xl shadow-xs mt-1 mb-2 animate-gold-glow">
              🏆 Você está liderando a batalha
            </div>
          ) : distance > 0 ? (
            <div className="text-xs sm:text-sm font-semibold text-[#64748B] mt-1 mb-2">
              {delta < 0 ? (
                <>Próxima posição a <strong className="text-[#122017] font-black">{`${distance} pts`}</strong></>
              ) : (
                <>A <strong className="text-[#122017] font-black">{`${distance} pts`}</strong> {`do #${ranking.position - 1}`}</>
              )}
            </div>
          ) : null}
        </div>

        {/* Total Points Card */}
        <div className="w-full max-w-md bg-white border border-[#E2DDD2] rounded-2xl p-4 sm:p-5 mt-4 shadow-xs flex flex-col items-center">
          <span className="text-[11px] uppercase font-black tracking-wider text-[#64748B] mb-1">
            TOTAL DE PONTOS
          </span>
          <div className="text-4xl sm:text-5xl font-mono font-black text-[#122017]">
            {totalPoints}
          </div>
          <span className="text-xs text-[#526B59] font-bold mt-1">
            {`${correctCount} ${correctCount === 1 ? 'questão correta' : 'questões corretas'}`}
          </span>
        </div>

        {/* Celebratory footer for leadership */}
        {isLeading && (
          <p className="text-sm font-black text-[#123829] mt-6 animate-scale-in">
            Você virou o jogo.
          </p>
        )}
      </div>
    );
  }

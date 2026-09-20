import type { RankingEntry } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';

interface ScreenRankingProps {
  rankings: RankingEntry[];
  isFinal: boolean;
}

export default function ScreenRanking({ rankings, isFinal }: ScreenRankingProps) {
  const displayRankings = rankings.slice(0, 5); // Top 5 no telão
  const previousRankings = useGameStore((s) => s.previousRankings);

  return (
    <div className="flex flex-col h-full text-[#122017] p-6 md:p-10 lg:p-12 max-w-7xl 2xl:max-w-[1760px] mx-auto w-full select-none justify-between relative z-10 animate-fade-in-scale">
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {/* Header */}
      <header className="text-center mb-4 lg:mb-6 shrink-0">
        <span className="text-xs sm:text-sm lg:text-base font-black uppercase tracking-widest text-[#B45309] bg-[#FEF9EE] px-6 py-1.5 rounded-full border border-[#F59E0B]/40 shadow-xs">
          {isFinal ? 'Resultado Geral' : 'Classificação da Rodada'}
        </span>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mt-3 text-[#122017] tracking-tight">
          {isFinal ? '🏆 Classificação Final' : 'Top 5 da Batalha'}
        </h2>
      </header>

      {/* Roster Cards */}
      <main className="flex-1 flex flex-col justify-center max-w-5xl 2xl:max-w-6xl mx-auto w-full gap-3.5 lg:gap-4 my-auto">
        {displayRankings.map((player, index) => {
          const prevEntry = previousRankings.find((p) => p.playerId === player.playerId);
          const delta = prevEntry ? prevEntry.position - player.position : 0;

          return (
            <div
              key={player.playerId}
              className={`flex items-center p-4 sm:p-5 lg:p-6 rounded-3xl shadow-md border-2 transition-all ${
                player.position === 1
                  ? 'bg-[#FEF9EE] border-[#F59E0B] ring-2 ring-[#F59E0B]/25 scale-[1.02]'
                  : player.position === 2
                  ? 'bg-white border-slate-300'
                  : player.position === 3
                  ? 'bg-white border-[#D05F36]/40'
                  : 'bg-white border-[#E2DDD2]'
              }`}
              style={{ animation: `slideIn 0.35s ease-out ${index * 0.08}s both` }}
            >
              {/* Position Badge */}
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 flex flex-col items-center justify-center rounded-2xl font-black mr-4 lg:mr-6 shrink-0 shadow-xs ${
                  player.position === 1
                    ? 'bg-gradient-to-br from-[#F59E0B] to-[#D48B28] text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                    : player.position === 2
                    ? 'bg-gradient-to-br from-slate-400 to-slate-600 text-white'
                    : player.position === 3
                    ? 'bg-gradient-to-br from-[#D05F36] to-[#A8382B] text-white'
                    : 'bg-[#151F2E] text-white'
                }`}
              >
                <span className="text-2xl sm:text-3xl lg:text-4xl">{`#${player.position}`}</span>
              </div>

              {/* Nickname & Delta Indicator */}
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-3">
                  <span className="font-black text-2xl sm:text-3xl lg:text-4xl truncate text-[#122017]">
                    {player.nickname}
                  </span>

                  {/* Movement indicator */}
                  {prevEntry && delta > 0 ? (
                    <span className="text-xs sm:text-sm font-black text-[#2D8058] bg-[#EAF5EC] border border-[#2D8058]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      {`🔺 +${delta}`}
                    </span>
                  ) : prevEntry && delta < 0 ? (
                    <span className="text-xs sm:text-sm font-black text-[#D05F36] bg-[#FBEBE8] border border-[#D05F36]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      {`🔻 ${delta}`}
                    </span>
                  ) : (
                    <span className="text-xs sm:text-sm font-bold text-[#555E57] bg-[#FAF8F3] border border-[#E2DDD2] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      ➖
                    </span>
                  )}
                </div>

                <div className="text-sm sm:text-base lg:text-lg text-[#526B59] mt-0.5 font-semibold">
                  {`${player.correctCount} acerto${player.correctCount !== 1 ? 's' : ''}`}
                </div>
              </div>

              {/* Points */}
              <div className="text-right shrink-0">
                <div
                  className={`font-mono text-3xl sm:text-4xl lg:text-5xl font-black ${
                    player.position === 1 ? 'text-[#B45309]' : 'text-[#122017]'
                  }`}
                >
                  {`${player.totalPoints} pts`}
                </div>
                {player.distanceToPrevious > 0 && player.position > 1 && (
                  <div className="text-xs sm:text-sm text-[#D05F36] font-bold mt-0.5">
                    {`-${player.distanceToPrevious} pts do #${player.position - 1}`}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {rankings.length === 0 && (
          <div className="text-center text-2xl text-[#555E57] p-12">
            Aguardando consolidação das pontuações...
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="text-center mt-2 shrink-0">
        <span className="text-xs lg:text-sm font-bold text-[#648B68] uppercase tracking-wider">
          Batalha Anatômica • Classificação Geral
        </span>
      </footer>
    </div>
  );
}

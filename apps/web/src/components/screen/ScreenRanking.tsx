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
    <div className="flex flex-col h-full text-white p-8 md:p-12 max-w-7xl mx-auto w-full select-none justify-between">
      <div className="text-center mb-6">
        <span className="text-base font-bold uppercase tracking-widest text-yellow-300 bg-yellow-950/60 px-6 py-1.5 rounded-full border border-yellow-500/30">
          {isFinal ? 'Resultado Geral' : 'Classificação da Rodada'}
        </span>
        <h2 className="text-5xl md:text-6xl font-black mt-3 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]">
          {isFinal ? '🏆 Classificação Final' : 'Top 5 da Batalha'}
        </h2>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full gap-3.5 my-auto">
        {displayRankings.map((player, index) => {
          const prevEntry = previousRankings.find(p => p.playerId === player.playerId);
          const delta = prevEntry ? prevEntry.position - player.position : 0;

          return (
            <div 
              key={player.playerId}
              className={`flex items-center p-5 md:p-6 rounded-3xl shadow-2xl border-2 transition-all motion-reduce:transition-none ${
                player.position === 1
                  ? 'bg-yellow-500/20 border-yellow-400/60 ring-2 ring-yellow-400/30 scale-[1.02]'
                  : player.position === 2
                  ? 'bg-slate-300/15 border-slate-300/40'
                  : player.position === 3
                  ? 'bg-amber-700/20 border-amber-600/40'
                  : 'bg-black/30 border-white/10'
              }`}
              style={{ animation: `slideIn 0.4s ease-out ${index * 0.08}s both` }}
            >
              {/* Position badge */}
              <div className={`w-16 h-16 md:w-20 md:h-20 flex flex-col items-center justify-center rounded-2xl font-black mr-5 shrink-0 shadow-inner ${
                player.position === 1
                  ? 'bg-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.6)]'
                  : player.position === 2
                  ? 'bg-slate-300 text-slate-950'
                  : player.position === 3
                  ? 'bg-amber-600 text-white'
                  : 'bg-black/40 text-white border border-white/20'
              }`}>
                <span className="text-3xl md:text-4xl">#{player.position}</span>
              </div>
              
              {/* Nickname & movement */}
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-3">
                  <span className="font-black text-3xl md:text-4xl truncate drop-shadow-sm">
                    {player.nickname}
                  </span>
                  
                  {/* Delta indicator */}
                  {prevEntry && delta > 0 ? (
                    <span className="text-xs md:text-sm font-black text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      🔺 +{delta}
                    </span>
                  ) : prevEntry && delta < 0 ? (
                    <span className="text-xs md:text-sm font-black text-rose-300 bg-rose-950/60 border border-rose-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      🔻 {delta}
                    </span>
                  ) : (
                    <span className="text-xs md:text-sm font-bold text-slate-400 bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      ➖
                    </span>
                  )}
                </div>

                <div className="text-lg md:text-xl text-blue-200 mt-1 font-semibold">
                  {player.correctCount} acerto{player.correctCount !== 1 ? 's' : ''}
                </div>
              </div>
              
              {/* Points */}
              <div className="text-right shrink-0">
                <div className="font-mono text-4xl md:text-5xl font-black text-yellow-300 drop-shadow-md">
                  {player.totalPoints} pts
                </div>
                {player.distanceToPrevious > 0 && player.position > 1 && (
                  <div className="text-sm md:text-base text-red-300 font-bold mt-0.5">
                    -{player.distanceToPrevious} pts do #{player.position - 1}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {rankings.length === 0 && (
          <div className="text-center text-3xl text-blue-200/60 p-12">
            Aguardando consolidação das pontuações...
          </div>
        )}
      </div>
    </div>
  );
}

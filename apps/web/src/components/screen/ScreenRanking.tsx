import type { RankingEntry } from '@batalha/protocol';

interface ScreenRankingProps {
  rankings: RankingEntry[];
  isFinal: boolean;
}

export default function ScreenRanking({ rankings, isFinal }: ScreenRankingProps) {
  const displayRankings = rankings.slice(0, 5); // Exibe os 5 primeiros no telão

  return (
    <div className="flex flex-col h-full text-white p-12 max-w-7xl mx-auto w-full select-none justify-between">
      <div className="text-center mb-8">
        <span className="text-base font-bold uppercase tracking-widest text-yellow-300 bg-yellow-950/60 px-6 py-2 rounded-full border border-yellow-500/30">
          {isFinal ? 'Resultado Geral' : 'Classificação da Rodada'}
        </span>
        <h2 className="text-6xl font-black mt-3 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]">
          {isFinal ? '🏆 Classificação Final' : 'Top 5 da Batalha'}
        </h2>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full gap-4 my-auto">
        {displayRankings.map((player, index) => (
          <div 
            key={player.playerId}
            className={`flex items-center p-6 rounded-3xl shadow-2xl border-2 transition-all ${
              player.position === 1
                ? 'bg-yellow-500/20 border-yellow-400/60 ring-2 ring-yellow-400/30 scale-[1.02]'
                : player.position === 2
                ? 'bg-slate-300/15 border-slate-300/40'
                : player.position === 3
                ? 'bg-amber-700/20 border-amber-600/40'
                : 'bg-black/30 border-white/10'
            }`}
            style={{ animation: `slideIn 0.5s ease-out ${index * 0.1}s both` }}
          >
            <div className={`w-20 h-20 flex items-center justify-center rounded-2xl text-4xl font-black mr-6 shadow-inner ${
              player.position === 1
                ? 'bg-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.6)]'
                : player.position === 2
                ? 'bg-slate-300 text-slate-950'
                : player.position === 3
                ? 'bg-amber-600 text-white'
                : 'bg-black/40 text-white border border-white/20'
            }`}>
              #{player.position}
            </div>
            
            <div className="flex-1 min-w-0 mr-6">
              <div className="font-black text-4xl truncate drop-shadow-sm">{player.nickname}</div>
              <div className="text-xl text-blue-200 mt-1 font-semibold">
                {player.correctCount} acerto{player.correctCount !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="text-right shrink-0">
              <div className="font-mono text-5xl font-black text-yellow-300 drop-shadow-md">
                {player.totalPoints} pts
              </div>
              {player.distanceToPrevious > 0 && player.position > 1 && (
                <div className="text-lg text-red-300 font-bold mt-1">
                  -{player.distanceToPrevious} pts do #{player.position - 1}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {rankings.length === 0 && (
          <div className="text-center text-4xl text-blue-200/60 p-12">
            Aguardando consolidação das pontuações...
          </div>
        )}
      </div>
    </div>
  );
}

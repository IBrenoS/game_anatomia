import type { RankingEntry } from '@batalha/protocol';

interface HostRankingProps {
  rankings: RankingEntry[];
  isFinal: boolean;
}

export default function HostRanking({ rankings, isFinal }: HostRankingProps) {
  const displayRankings = rankings.slice(0, 10);

  return (
    <div className="flex flex-col h-full text-white max-w-4xl mx-auto w-full">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black mb-1">
          {isFinal ? '🏆 Classificação Final' : '📊 Classificação da Rodada'}
        </h2>
        <p className="text-sm text-blue-200">
          {isFinal ? 'Resultado oficial da partida' : 'Top 10 participantes'}
        </p>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full space-y-3 overflow-y-auto pr-1">
        {displayRankings.map((player) => (
          <div 
            key={player.playerId}
            className={`flex items-center p-4 rounded-2xl shadow-sm border transition-all ${
              player.position === 1
                ? 'bg-yellow-500/20 border-yellow-400/40'
                : player.position === 2
                ? 'bg-slate-300/15 border-slate-300/30'
                : player.position === 3
                ? 'bg-amber-700/20 border-amber-600/30'
                : 'bg-white/10 border-white/5'
            }`}
          >
            <div className={`w-11 h-11 flex items-center justify-center rounded-xl font-black text-lg mr-4 ${
              player.position === 1
                ? 'bg-yellow-400 text-slate-950 shadow-md'
                : player.position === 2
                ? 'bg-slate-300 text-slate-950'
                : player.position === 3
                ? 'bg-amber-600 text-white'
                : 'bg-black/30 text-white'
            }`}>
              #{player.position}
            </div>
            
            <div className="flex-1 min-w-0 mr-4">
              <div className="font-bold text-lg truncate">{player.nickname}</div>
              <div className="text-xs text-blue-200">
                {player.correctCount} acerto{player.correctCount !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="text-right shrink-0">
              <div className="font-mono text-2xl font-black text-yellow-300">
                {player.totalPoints} pts
              </div>
              {player.distanceToPrevious > 0 && player.position > 1 && (
                <div className="text-xs text-red-300 font-medium">
                  -{player.distanceToPrevious} pts do #{player.position - 1}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {rankings.length === 0 && (
          <div className="text-center text-blue-200 p-8">
            Nenhuma pontuação registrada ainda.
          </div>
        )}
      </div>
    </div>
  );
}

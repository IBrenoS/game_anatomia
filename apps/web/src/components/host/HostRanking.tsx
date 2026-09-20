import type { RankingEntry } from '@batalha/protocol';

interface HostRankingProps {
  rankings: RankingEntry[];
  isFinal: boolean;
}

export default function HostRanking({ rankings, isFinal }: HostRankingProps) {
  const displayRankings = rankings.slice(0, 10);

  return (
    <div className="flex flex-col h-full text-[#122017] max-w-4xl mx-auto w-full p-4 sm:p-6 select-none">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-black mb-1 text-[#122017]">
          {isFinal ? '🏆 Classificação Final' : '📊 Classificação da Rodada'}
        </h2>
        <p className="text-xs sm:text-sm text-[#555E57]">
          {isFinal ? 'Resultado oficial da partida' : 'Top 10 participantes'}
        </p>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full space-y-2.5 overflow-y-auto pr-1">
        {displayRankings.map((player) => (
          <div 
            key={player.playerId}
            className={`flex items-center p-3.5 sm:p-4 rounded-2xl shadow-xs border transition-all ${
              player.position === 1
                ? 'bg-[#FEF9EE] border-[#F59E0B]/50'
                : player.position === 2
                ? 'bg-white border-[#CBD5E1]'
                : player.position === 3
                ? 'bg-[#FDF6F0] border-[#D05F36]/30'
                : 'bg-white border-[#E2DDD2]'
            }`}
          >
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-base mr-3 sm:mr-4 shrink-0 ${
              player.position === 1
                ? 'bg-[#D48B28] text-white shadow-xs'
                : player.position === 2
                ? 'bg-[#648B68] text-white'
                : player.position === 3
                ? 'bg-[#C95A34] text-white'
                : 'bg-[#E2DDD2] text-[#122017]'
            }`}>
              #{player.position}
            </div>
            
            <div className="flex-1 min-w-0 mr-3 sm:mr-4">
              <div className="font-bold text-base sm:text-lg text-[#122017] truncate">{player.nickname}</div>
              <div className="text-xs text-[#555E57]">
                {player.correctCount} acerto{player.correctCount !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="text-right shrink-0">
              <div className="font-mono text-xl sm:text-2xl font-black text-[#122017]">
                {player.totalPoints} pts
              </div>
              {player.distanceToPrevious > 0 && player.position > 1 && (
                <div className="text-xs text-[#C95A34] font-medium">
                  -{player.distanceToPrevious} pts do #{player.position - 1}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {rankings.length === 0 && (
          <div className="text-center text-[#555E57] p-8">
            Nenhuma pontuação registrada ainda.
          </div>
        )}
      </div>
    </div>
  );
}

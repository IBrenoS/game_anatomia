import type { RankingEntry } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';

interface PlayerRankingProps {
  ranking?: RankingEntry;
  isFinal: boolean;
}

export default function PlayerRanking({ ranking, isFinal }: PlayerRankingProps) {
  const previousRankings = useGameStore((s) => s.previousRankings);

  if (!ranking) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center select-none">
        <h2 className="text-xl font-bold mb-2">Acompanhe a classificação no telão</h2>
        <p className="text-sm text-blue-200">Sua pontuação será consolidada em breve.</p>
      </div>
    );
  }

  const isLeading = ranking.position === 1;
  const prevEntry = previousRankings.find(p => p.playerId === ranking.playerId);
  const delta = prevEntry ? prevEntry.position - ranking.position : 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white max-w-sm mx-auto w-full p-4 text-center select-none">
      <span className="text-xs font-bold uppercase tracking-widest text-blue-300 bg-blue-950/70 px-4 py-1.5 rounded-full border border-blue-400/30 mb-4">
        {isFinal ? 'Resultado Geral' : 'Classificação da Rodada'}
      </span>

      <div className="w-full bg-black/35 p-8 rounded-3xl flex flex-col items-center border border-white/15 shadow-2xl backdrop-blur-md">
        <span className="text-xs uppercase font-bold tracking-widest text-blue-300 mb-1">
          Sua Posição
        </span>
        <div className={`text-8xl font-black mb-2 font-mono ${isLeading ? 'text-yellow-300 drop-shadow-[0_0_20px_rgba(253,224,71,0.6)]' : 'text-white'}`}>
          #{ranking.position}
        </div>

        {/* Rank movement indicator */}
        <div className="mb-4">
          {prevEntry && delta > 0 ? (
            <div className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1">
              <span>🔺</span> Subiu {delta} {delta === 1 ? 'posição' : 'posições'}
            </div>
          ) : prevEntry && delta < 0 ? (
            <div className="bg-rose-500/20 text-rose-300 text-xs font-bold px-3 py-1 rounded-full border border-rose-500/40 flex items-center gap-1">
              <span>🔻</span> Caiu {Math.abs(delta)} {Math.abs(delta) === 1 ? 'posição' : 'posições'}
            </div>
          ) : (
            <div className="bg-slate-700/50 text-slate-300 text-xs font-semibold px-3 py-1 rounded-full border border-slate-600/40 flex items-center gap-1">
              <span>➖</span> Manteve a posição
            </div>
          )}
        </div>

        {/* Distance to previous or leading callout */}
        <div className="w-full mb-6">
          {isLeading ? (
            <div className="bg-yellow-500/20 text-yellow-300 text-sm font-bold py-2 px-3 rounded-xl border border-yellow-500/40">
              🏆 Você está liderando a partida!
            </div>
          ) : (
            <div className="bg-blue-900/40 text-blue-200 text-sm font-semibold py-2 px-3 rounded-xl border border-blue-400/20">
              A <strong className="text-yellow-300 font-bold">{ranking.distanceToPrevious} pts</strong> do #{ranking.position - 1}
            </div>
          )}
        </div>
        
        <div className="w-full h-px bg-white/10 mb-6" />
        
        <span className="text-xs uppercase font-bold tracking-widest text-blue-300 mb-1">
          Total de Pontos
        </span>
        <div className="text-5xl font-mono font-black text-yellow-300">
          {ranking.totalPoints} <span className="text-lg font-sans text-white/80">pts</span>
        </div>

        <div className="text-xs text-blue-300 mt-2">
          {ranking.correctCount} questão{ranking.correctCount !== 1 ? 'ões' : ''} correta{ranking.correctCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

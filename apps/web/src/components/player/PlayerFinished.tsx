import type { RankingEntry } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';
import { getWebSocketManager } from '../../lib/ws.js';

interface PlayerFinishedProps {
  ranking?: RankingEntry;
}

export default function PlayerFinished({ ranking }: PlayerFinishedProps) {
  const personalScore = useGameStore((s) => s.personalScore);

  const position = ranking?.position ?? personalScore.position ?? 1;
  const totalPoints = ranking?.totalPoints ?? personalScore.totalPoints ?? 0;
  const correctCount = ranking?.correctCount ?? personalScore.correctCount ?? 0;

  const handleExit = () => {
    const pin = useGameStore.getState().pin;
    if (pin) {
      localStorage.removeItem(`batalha_session_${pin}`);
    }
    getWebSocketManager('player').disconnect();
    useGameStore.getState().resetStore();
    window.location.href = '/';
  };

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
        PARTIDA CONCLUÍDA · PARTIDA FINALIZADA
      </div>

      {/* Title & Subtitle */}
      <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-1">
        Sua batalha terminou.
      </h1>
      <p className="text-xs sm:text-sm text-[#555E57] font-medium mb-6">
        {`Você terminou em ${position}º lugar com ${totalPoints} pontos.`}
      </p>

      {/* Stats Cards (2 Columns on desktop, stacked on mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mb-8 text-left">
        {/* Card 1: Posição Final */}
        <div className="bg-white border border-[#E2DDD2] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase font-black tracking-wider text-[#64748B] mb-2">
            POSIÇÃO FINAL
          </span>
          <div className="flex items-baseline justify-between mt-auto">
            <span className="text-4xl sm:text-5xl font-mono font-black text-[#122017]">
              {`#${position}`}
            </span>
            <span className="text-base sm:text-xl font-mono font-black text-[#123829]">
              {`${totalPoints} pts`}
            </span>
          </div>
        </div>

        {/* Card 2: Resumo */}
        <div className="bg-white border border-[#E2DDD2] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col">
          <span className="text-[11px] uppercase font-black tracking-wider text-[#64748B] mb-2">
            RESUMO
          </span>
          <div className="space-y-1 mt-auto">
            <div className="text-sm sm:text-base font-bold text-[#122017]">
              {`${correctCount} ${correctCount === 1 ? 'acerto' : 'acertos'}`}
            </div>
            <div className="text-xs font-semibold text-[#D48B28]">
              {`${Math.min(correctCount, 3)} bônus de rapidez`}
            </div>
            <div className="text-[11px] text-[#64748B]">
              Desempenho consistente na arena
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <button
        type="button"
        onClick={handleExit}
        className="w-full max-w-sm py-3.5 sm:py-4 bg-[#123829] hover:bg-[#1B4D3E] active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-2xl shadow-xl transition-all cursor-pointer"
      >
        Voltar ao início
      </button>
    </div>
  );
}

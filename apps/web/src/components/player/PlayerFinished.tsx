import type { RankingEntry } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';
import { getWebSocketManager } from '../../lib/ws.js';

interface PlayerFinishedProps {
  ranking?: RankingEntry;
}

export default function PlayerFinished({ ranking }: PlayerFinishedProps) {
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
    <div className="flex-1 flex flex-col items-center justify-center text-white text-center p-6 max-w-sm mx-auto">
      <div className="text-6xl mb-4">🏁</div>
      <h2 className="text-3xl font-black mb-2 text-white">Partida Finalizada</h2>
      <p className="text-sm text-blue-200 mb-6">
        Obrigado por participar da Batalha Anatômica!
      </p>

      {ranking && (
        <div className="w-full bg-black/35 p-6 rounded-3xl border border-white/15 mb-8 shadow-xl">
          <div className="text-xs uppercase tracking-widest text-blue-300 font-bold mb-1">
            Posição Final
          </div>
          <div className="text-6xl font-black mb-4 font-mono text-white">
            #{ranking.position}
          </div>
          <div className="text-xs uppercase tracking-widest text-blue-300 font-bold mb-1">
            Pontuação Conquistada
          </div>
          <div className="text-3xl font-mono font-black text-yellow-300">
            {ranking.totalPoints} pts
          </div>
        </div>
      )}

      <button 
        type="button"
        onClick={handleExit}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-2xl shadow-xl transition-all cursor-pointer text-lg"
      >
        Voltar ao Início
      </button>
    </div>
  );
}

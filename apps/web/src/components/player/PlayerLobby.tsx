import { useGameStore } from '../../stores/gameStore.js';

interface PlayerLobbyProps {
  nickname: string | null;
}

export default function PlayerLobby({ nickname }: PlayerLobbyProps) {
  const players = useGameStore((s) => s.players);
  const playerCount = players.length || 1;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white text-center select-none p-4">
      <div className="bg-black/35 p-8 rounded-3xl border border-white/15 w-full max-w-sm shadow-2xl backdrop-blur-md flex flex-col items-center animate-[fadeIn_0.3s_ease-out]">
        <span className="text-xs uppercase tracking-widest text-emerald-300 font-bold bg-emerald-950/60 px-4 py-1.5 rounded-full border border-emerald-500/30 mb-3 flex items-center gap-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ✓ Você entrou!
        </span>
        <div className="text-3xl font-black text-yellow-300 mb-3 truncate max-w-full drop-shadow-md font-sans">
          {nickname}
        </div>

        <div className="text-xs font-semibold text-blue-200/90 bg-blue-950/50 px-3 py-1 rounded-full border border-blue-400/20 mb-6">
          👥 {playerCount} {playerCount === 1 ? 'participante' : 'participantes'} na arena
        </div>
        
        <div className="flex justify-center mb-6 relative">
          <div className="w-14 h-14 border-4 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
        
        <p className="text-sm font-semibold text-blue-100">
          Aguardando outros participantes...
        </p>
        <p className="text-xs text-blue-200/80 mt-1">
          Aguardando o apresentador iniciar a partida
        </p>
        <p className="text-xs text-blue-300/60 mt-4 font-medium">
          Acompanhe no telão principal
        </p>
      </div>
    </div>
  );
}

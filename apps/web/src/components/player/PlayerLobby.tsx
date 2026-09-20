import React from 'react';
import { useGameStore } from '../../stores/gameStore.js';

interface PlayerLobbyProps {
  nickname: string | null;
}

export const PlayerLobby: React.FC<PlayerLobbyProps> = ({ nickname }) => {
  const authoritativeTotal = useGameStore((s) => s.totalPlayers);
  const playerCount = authoritativeTotal || 1;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-[#FAF7F2] text-center select-none p-4 animate-[fadeInScale_0.3s_ease-out]">
      <div className="w-full max-w-sm bg-[#0E1522] p-8 rounded-3xl border border-white/15 shadow-2xl backdrop-blur-md flex flex-col items-center">
        {/* Success badge */}
        <span className="text-xs uppercase tracking-wider text-[#1FD4A7] font-bold bg-[#123829] px-4 py-1.5 rounded-full border border-[#1FD4A7]/30 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1FD4A7] animate-pulse" aria-hidden="true" />
          <span>Você está na sala!</span>
        </span>

        {/* Player Name */}
        <div className="text-3xl sm:text-4xl font-black text-white mb-2 truncate max-w-full drop-shadow-md">
          {nickname}
        </div>

        {/* Player count pill */}
        <div className="text-xs font-semibold text-slate-300 bg-white/5 px-3 py-1 rounded-full border border-white/10 mb-8">
          <span>{playerCount} jogador{playerCount === 1 ? '' : 'es'} na sala</span>
        </div>
        
        {/* Subtle teal spinner */}
        <div className="flex justify-center mb-6 relative">
          <div className="w-12 h-12 border-3 border-[#1FD4A7]/20 border-t-[#1FD4A7] rounded-full animate-spin motion-reduce:animate-none" />
        </div>
        
        <p className="text-sm font-bold text-white">
          Aguardando outros participantes...
        </p>
        <p className="text-xs text-slate-400 mt-1">
          O organizador iniciará a partida em breve.
        </p>
        <p className="text-[11px] text-slate-500 mt-4">
          Acompanhe no telão da sala ou pelo seu dispositivo.
        </p>
      </div>
    </div>
  );
};

export default PlayerLobby;

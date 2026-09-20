import React from 'react';
import { useGameStore } from '../../stores/gameStore.js';

interface PlayerLobbyProps {
  nickname: string | null;
  totalPlayers?: number;
}

export const PlayerLobby: React.FC<PlayerLobbyProps> = ({
  nickname,
  totalPlayers: propTotalPlayers,
}) => {
  const authoritativeTotal = useGameStore((s) => s.totalPlayers);
  const playerCount = propTotalPlayers ?? (authoritativeTotal || 1);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 select-none w-full max-w-4xl mx-auto">
      {/* Main Clínica Natural stage surface with Dark Arena ambient surroundings */}
      <div className="w-full bg-[#FAF8F3] border border-[#E2DDD2] rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center text-center relative overflow-hidden animate-scale-in">
        {/* Subtle decorative radial background */}
        <div 
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-b from-[#123829]/10 to-transparent rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-5">
          <span className="text-[11px] sm:text-xs font-black tracking-widest text-[#123829] uppercase">
            BATALHA ANATÔMICA
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#648B68] uppercase">
            BOVINO <span className="text-[#D05F36]">×</span> EQUINO
          </span>
        </div>

        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-[#E2DDD2] text-[#123829] text-xs font-bold tracking-wider uppercase mb-5 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#1FD4A7] animate-pulse" aria-hidden="true" />
          <span>VOCÊ ESTÁ NA ARENA</span>
        </div>

        {/* Player Headline */}
        <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-2 leading-tight">
          {`${nickname || 'Jogador'}, sua vaga está garantida.`}
        </h1>
        <p className="text-xs sm:text-sm text-[#555E57] font-medium max-w-md mb-8">
          A partida começa assim que o organizador der o sinal.
        </p>

        {/* Central Graphic: Dark Green Badge with Glowing Aura */}
        <div className="relative flex flex-col items-center my-2 sm:my-4">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#123829] text-white flex items-center justify-center text-3xl sm:text-4xl shadow-xl shadow-[#123829]/30 animate-pulse-glow z-10 relative">
              <span className="animate-check-pop">✓</span>
            </div>
            {/* Ambient pulse halo */}
            <div className="absolute inset-0 rounded-full bg-[#1FD4A7]/20 blur-xl animate-pulse" aria-hidden="true" />
          </div>

          <h2 className="text-lg sm:text-xl font-black text-[#123829] mt-4 mb-0.5">
            Pronto para a batalha
          </h2>
          <p className="text-xs sm:text-sm text-[#555E57] max-w-xs">
            Você não precisa fazer nada agora. O organizador inicia quando todos estiverem prontos.
          </p>
        </div>

        {/* Roster & Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mt-8 text-left">
          <div className="bg-white border border-[#E2DDD2] rounded-2xl p-4 shadow-xs flex flex-col">
            <span className="text-sm sm:text-base font-black text-[#122017]">
              {`${playerCount} ${playerCount === 1 ? 'jogador conectado' : 'jogadores conectados'}`}
            </span>
            <span className="text-[11px] sm:text-xs text-[#64748B] mt-0.5">
              A sala está crescendo em tempo real.
            </span>
          </div>

          <div className="bg-white border border-[#E2DDD2] rounded-2xl p-4 shadow-xs flex flex-col">
            <span className="text-xs sm:text-sm font-bold text-[#123829]">
              Sua entrada foi confirmada
            </span>
            <span className="text-[11px] sm:text-xs text-[#64748B] mt-0.5">
              Fique por aqui — a arena já está ativa.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerLobby;

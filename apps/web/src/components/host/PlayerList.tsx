import React from 'react';
import { useGameStore } from '../../stores/gameStore.js';

interface PlayerListProps {
  players: Array<{ playerId: string; nickname: string }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  onRemovePlayer?: (playerId: string, nickname: string) => void;
  isHostPlaying?: boolean;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  presences,
  onRemovePlayer,
  isHostPlaying = false,
}) => {
  const currentLocalPlayerId = useGameStore((state) => state.playerId);

  return (
    <div className="w-full flex flex-col space-y-2 select-none">
      <div className="space-y-1.5 sm:space-y-2 max-h-36 sm:max-h-48 md:max-h-72 overflow-y-auto pr-1">
        {players.map((player) => {
          const presence = presences.find((p) => p.playerId === player.playerId);
          const isConnected = presence ? presence.connected : false;
          const isThisHostPlayer = isHostPlaying && player.playerId === currentLocalPlayerId;

          return (
            <div
              key={player.playerId}
              className={`flex items-center justify-between py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-xl transition-all duration-200 group animate-slide-fade-in ${
                isConnected
                  ? 'bg-white/5 hover:bg-white/10 text-white'
                  : 'bg-white/[0.02] text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-2.5 truncate">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
                    isConnected
                      ? 'bg-[#1FD4A7] shadow-[0_0_8px_rgba(31,212,167,0.7)] animate-pulse motion-reduce:animate-none'
                      : 'bg-amber-400/70'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-semibold text-xs sm:text-sm md:text-base text-white truncate">
                  {player.nickname}
                </span>

                {isThisHostPlayer && (
                  <span className="text-[10px] sm:text-[11px] font-medium text-[#1FD4A7] bg-[#123829] px-2 py-0.5 rounded-full border border-[#1FD4A7]/30 shrink-0">
                    você também joga
                  </span>
                )}

                {!isConnected && (
                  <span className="text-[10px] text-amber-300 font-normal bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                    reconectando
                  </span>
                )}
              </div>

              {onRemovePlayer && (
                <button
                  type="button"
                  onClick={() => onRemovePlayer(player.playerId, player.nickname)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10px] sm:text-[11px] text-rose-400 hover:text-white hover:bg-rose-900/50 px-2 py-0.5 rounded transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
                  title={`Remover ${player.nickname}`}
                  aria-label={`Remover participante ${player.nickname}`}
                >
                  Remover
                </button>
              )}
            </div>
          );
        })}

        {players.length === 0 && (
          <p className="text-xs sm:text-sm text-slate-400 py-3 italic">
            Esperando jogadores entrarem...
          </p>
        )}
      </div>
    </div>
  );
};

export default PlayerList;

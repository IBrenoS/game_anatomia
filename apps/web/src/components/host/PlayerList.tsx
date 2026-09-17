interface PlayerListProps {
  players: Array<{ playerId: string; nickname: string }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  onRemovePlayer?: (playerId: string, nickname: string) => void;
}

export default function PlayerList({ players, presences, onRemovePlayer }: PlayerListProps) {
  return (
    <div className="bg-black/20 rounded-xl p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold text-white">
          Participantes ({players.length}/50)
        </h3>
        <span className="text-xs text-blue-200">Em tempo real</span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {players.map(player => {
          const presence = presences.find(p => p.playerId === player.playerId);
          const isConnected = presence ? presence.connected : false;
          
          return (
            <div 
              key={player.playerId} 
              className="flex items-center justify-between p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all duration-200 border border-white/5 motion-reduce:transition-none"
            >
              <div className="flex items-center gap-2.5 truncate">
                <span 
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isConnected 
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse motion-reduce:animate-none' 
                      : 'bg-slate-500'
                  }`} 
                  title={isConnected ? 'Conectado' : 'Desconectado'} 
                />
                <span className="truncate font-medium text-sm">{player.nickname}</span>
              </div>
              {onRemovePlayer && (
                <button
                  type="button"
                  onClick={() => onRemovePlayer(player.playerId, player.nickname)}
                  className="text-xs text-red-300 hover:text-white hover:bg-red-900/60 px-2.5 py-1 rounded-lg transition-colors shrink-0 font-medium cursor-pointer"
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
          <p className="text-sm text-blue-200/70 text-center py-6">
            Nenhum participante conectado ainda.
          </p>
        )}
      </div>
    </div>
  );
}

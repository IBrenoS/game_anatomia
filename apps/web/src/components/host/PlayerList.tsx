interface PlayerListProps {
  players: Array<{ playerId: string; nickname: string }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  onRemovePlayer?: (playerId: string, nickname: string) => void;
}

export default function PlayerList({ players, presences, onRemovePlayer }: PlayerListProps) {
  return (
    <div className="bg-black/20 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-3">Participantes ({players.length}/50)</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {players.map(player => {
          const presence = presences.find(p => p.playerId === player.playerId);
          const isConnected = presence ? presence.connected : false;
          
          return (
            <div key={player.playerId} className="flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors">
              <div className="flex items-center gap-2 truncate">
                <div 
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${isConnected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-gray-500'}`} 
                  title={isConnected ? 'Conectado' : 'Desconectado'} 
                />
                <span className="truncate font-medium">{player.nickname}</span>
              </div>
              {onRemovePlayer && (
                <button
                  type="button"
                  onClick={() => onRemovePlayer(player.playerId, player.nickname)}
                  className="text-xs text-red-300 hover:text-red-100 hover:bg-red-900/50 px-2 py-1 rounded transition-colors shrink-0 font-medium"
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
          <p className="text-sm text-blue-200 text-center py-4">Nenhum participante conectado ainda.</p>
        )}
      </div>
    </div>
  );
}

import React from 'react';

interface PlayerListProps {
  players: Array<{ playerId: string; nickname: string }>;
  presences: Array<{ playerId: string; connected: boolean }>;
}

export default function PlayerList({ players, presences }: PlayerListProps) {
  return (
    <div className="bg-black/20 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-3">Players ({players.length})</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {players.map(player => {
          const presence = presences.find(p => p.playerId === player.playerId);
          const isConnected = presence ? presence.connected : false;
          
          return (
            <div key={player.playerId} className="flex items-center justify-between p-2 bg-white/5 rounded text-white">
              <span className="truncate">{player.nickname}</span>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? 'Connected' : 'Disconnected'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';

interface HostLobbyProps {
  players: Array<{ playerId: string; nickname: string; joinedAt: number }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  pin: string;
}

export default function HostLobby({ players, presences, pin }: HostLobbyProps) {
  return (
    <div className="flex flex-col h-full text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">Join the game!</h2>
          <div className="text-5xl font-mono tracking-widest bg-white/10 px-6 py-4 rounded-lg inline-block">
            {pin}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-lg">
          {/* QR Code placeholder */}
          <div className="w-32 h-32 bg-gray-200 flex items-center justify-center text-gray-800 text-sm font-bold">
            QR CODE
          </div>
        </div>
      </div>

      <div className="flex-1 bg-black/20 rounded-xl p-6 overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">Players ({players.length})</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {players.map(player => {
            const presence = presences.find(p => p.playerId === player.playerId);
            const isConnected = presence ? presence.connected : false;
            
            return (
              <div 
                key={player.playerId}
                className={`p-3 rounded-lg flex items-center gap-3 ${isConnected ? 'bg-blue-600' : 'bg-gray-600 opacity-70'}`}
              >
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="font-medium truncate">{player.nickname}</span>
              </div>
            );
          })}
        </div>
        {players.length === 0 && (
          <div className="text-center text-white/50 py-12">
            Waiting for players to join...
          </div>
        )}
      </div>
    </div>
  );
}

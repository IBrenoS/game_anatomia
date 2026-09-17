import React from 'react';
import QrPanel from './QrPanel.js';

interface ScreenLobbyProps {
  players: Array<{ playerId: string; nickname: string; joinedAt: number }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  pin: string;
}

export default function ScreenLobby({ players, presences, pin }: ScreenLobbyProps) {
  return (
    <div className="flex flex-col h-full text-white p-8">
      <div className="flex justify-between items-start mb-12">
        <div className="bg-black/30 p-8 rounded-2xl">
          <h2 className="text-4xl font-bold mb-4">Join at <span className="text-yellow-400">batalha.com</span></h2>
          <div className="text-8xl font-mono font-bold tracking-widest">{pin}</div>
        </div>
        
        <QrPanel pin={pin} />
      </div>

      <div className="flex-1 mt-8">
        <h3 className="text-3xl font-semibold mb-6">Players ({players.length})</h3>
        <div className="flex flex-wrap gap-4">
          {players.map(player => {
            const presence = presences.find(p => p.playerId === player.playerId);
            const isConnected = presence ? presence.connected : false;
            
            return (
              <div 
                key={player.playerId}
                className={`px-6 py-3 rounded-full text-2xl font-bold shadow-lg transition-all ${isConnected ? 'bg-blue-600' : 'bg-gray-600 opacity-70'}`}
              >
                {player.nickname}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

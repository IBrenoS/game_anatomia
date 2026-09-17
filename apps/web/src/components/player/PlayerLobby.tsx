import React from 'react';

interface PlayerLobbyProps {
  nickname: string | null;
}

export default function PlayerLobby({ nickname }: PlayerLobbyProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white text-center">
      <div className="bg-black/30 p-8 rounded-2xl border border-white/10 w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-2">You're in!</h2>
        <div className="text-3xl font-black text-yellow-400 mb-8">{nickname}</div>
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <p className="text-blue-200">Waiting for host to start...</p>
        <p className="text-sm opacity-50 mt-4">Look at the big screen</p>
      </div>
    </div>
  );
}

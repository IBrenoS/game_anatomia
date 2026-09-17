import React from 'react';
import { RankingEntry } from '@batalha/protocol';

interface PlayerPodiumProps {
  podium: RankingEntry[];
  playerId: string | null;
}

export default function PlayerPodium({ podium, playerId }: PlayerPodiumProps) {
  const isWinner = podium.some(p => p.playerId === playerId);
  const position = podium.find(p => p.playerId === playerId)?.position;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white text-center px-4">
      {isWinner ? (
        <div className="animate-[pulse_2s_infinite]">
          <div className="text-8xl mb-6">🏆</div>
          <h2 className="text-4xl font-black mb-4 text-yellow-400 drop-shadow-lg">Congratulations!</h2>
          <p className="text-2xl">You finished in <strong>{position}{position === 1 ? 'st' : position === 2 ? 'nd' : 'rd'}</strong> place!</p>
        </div>
      ) : (
        <div>
          <div className="text-6xl mb-6">👏</div>
          <h2 className="text-3xl font-bold mb-4">Good game!</h2>
          <p className="text-xl text-blue-200">Look at the big screen for the winners.</p>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { RankingEntry } from '@batalha/protocol';

interface ScreenRankingProps {
  rankings: RankingEntry[];
  isFinal: boolean;
}

export default function ScreenRanking({ rankings, isFinal }: ScreenRankingProps) {
  const displayRankings = rankings.slice(0, 5); // Show top 5 on screen

  return (
    <div className="flex flex-col h-full text-white p-8">
      <h2 className="text-6xl font-bold text-center mb-4 text-yellow-400 drop-shadow-lg">
        {isFinal ? 'Final Standings' : 'Top 5 Players'}
      </h2>

      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full gap-4 mt-8">
        {displayRankings.map((player, index) => (
          <div 
            key={player.playerId}
            className="flex items-center bg-white/10 p-6 rounded-2xl shadow-xl border border-white/20 transform transition-transform hover:scale-105"
            style={{ animation: `slideIn 0.5s ease-out ${index * 0.1}s both` }}
          >
            <div className="w-16 h-16 flex items-center justify-center bg-black/40 rounded-full text-3xl font-bold mr-6">
              {player.position}
            </div>
            
            <div className="flex-1">
              <div className="font-bold text-4xl">{player.nickname}</div>
            </div>
            
            <div className="text-right">
              <div className="font-mono text-5xl font-bold text-yellow-400">
                {player.totalPoints}
              </div>
              {player.distanceToPrevious > 0 && player.position > 1 && (
                <div className="text-lg text-red-300 font-bold">
                  -{player.distanceToPrevious} behind
                </div>
              )}
            </div>
          </div>
        ))}
        
        {rankings.length === 0 && (
          <div className="text-center text-4xl text-white/50 p-12">
            Waiting for scores...
          </div>
        )}
      </div>
    </div>
  );
}

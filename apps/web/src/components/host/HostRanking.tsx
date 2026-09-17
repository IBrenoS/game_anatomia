import React from 'react';
import { RankingEntry } from '@batalha/protocol';

interface HostRankingProps {
  rankings: RankingEntry[];
  isFinal: boolean;
}

export default function HostRanking({ rankings, isFinal }: HostRankingProps) {
  // Show top 10 on host screen
  const displayRankings = rankings.slice(0, 10);

  return (
    <div className="flex flex-col h-full text-white">
      <h2 className="text-4xl font-bold text-center mb-2">
        {isFinal ? 'Final Results' : 'Current Standings'}
      </h2>
      <p className="text-center text-blue-200 mb-8">
        Top 10 Players
      </p>

      <div className="flex-1 max-w-3xl mx-auto w-full space-y-3 overflow-y-auto">
        {displayRankings.map((player) => (
          <div 
            key={player.playerId}
            className="flex items-center bg-white/10 p-4 rounded-xl shadow-sm border border-white/5"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-black/30 rounded-full text-xl font-bold mr-4">
              {player.position}
            </div>
            
            <div className="flex-1">
              <div className="font-bold text-xl">{player.nickname}</div>
            </div>
            
            <div className="text-right">
              <div className="font-mono text-2xl font-bold text-yellow-400">
                {player.totalPoints}
              </div>
              {player.distanceToPrevious > 0 && player.position > 1 && (
                <div className="text-xs text-red-300">
                  -{player.distanceToPrevious} behind #{player.position - 1}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {rankings.length === 0 && (
          <div className="text-center text-white/50 p-8">
            No scores available yet.
          </div>
        )}
      </div>
    </div>
  );
}

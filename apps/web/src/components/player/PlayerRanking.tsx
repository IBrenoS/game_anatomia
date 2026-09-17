import React from 'react';
import { RankingEntry } from '@batalha/protocol';

interface PlayerRankingProps {
  ranking?: RankingEntry;
  isFinal: boolean;
}

export default function PlayerRanking({ ranking, isFinal }: PlayerRankingProps) {
  if (!ranking) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold mb-4 text-center">Look at the big screen!</h2>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white">
      <h2 className="text-2xl font-bold mb-8 text-center opacity-80">
        {isFinal ? 'Final Position' : 'Current Position'}
      </h2>
      
      <div className="bg-black/30 p-8 rounded-2xl flex flex-col items-center min-w-[250px] border border-white/10 shadow-2xl">
        <div className="text-sm uppercase tracking-widest opacity-70 mb-2">You are in</div>
        <div className="text-7xl font-black mb-6">#{ranking.position}</div>
        
        <div className="w-full h-px bg-white/20 mb-6"></div>
        
        <div className="text-sm uppercase tracking-widest opacity-70 mb-1">Score</div>
        <div className="text-4xl font-mono font-bold text-yellow-400">{ranking.totalPoints}</div>
      </div>
    </div>
  );
}

import React from 'react';
import { RankingEntry } from '@batalha/protocol';

interface PlayerFinishedProps {
  ranking?: RankingEntry;
}

export default function PlayerFinished({ ranking }: PlayerFinishedProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white text-center">
      <h2 className="text-4xl font-bold mb-6">Game Over</h2>
      {ranking && (
        <div className="bg-black/30 p-6 rounded-xl border border-white/10 mb-8">
          <div className="text-sm uppercase tracking-widest opacity-70 mb-1">Final Position</div>
          <div className="text-6xl font-black mb-4">#{ranking.position}</div>
          <div className="text-sm uppercase tracking-widest opacity-70 mb-1">Final Score</div>
          <div className="text-3xl font-mono font-bold text-yellow-400">{ranking.totalPoints}</div>
        </div>
      )}
      <button 
        onClick={() => window.location.href = '/'}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}

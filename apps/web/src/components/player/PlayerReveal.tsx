import React from 'react';
import { PersonalResult } from '@batalha/protocol';

interface PlayerRevealProps {
  result: PersonalResult | null;
  correctOptionId: string | null;
}

export default function PlayerReveal({ result, correctOptionId }: PlayerRevealProps) {
  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white">
        <h2 className="text-3xl font-bold mb-4 text-center">Time's up!</h2>
        <p className="text-blue-200">Look at the big screen.</p>
      </div>
    );
  }

  const { correct, awardedPoints } = result;

  return (
    <div className={`flex-1 flex flex-col items-center justify-center text-white p-6 rounded-2xl ${correct ? 'bg-green-600' : 'bg-red-600'}`}>
      <div className="text-6xl mb-6">
        {correct ? '✅' : '❌'}
      </div>
      
      <h2 className="text-4xl font-bold mb-2 text-center">
        {correct ? 'Correct!' : 'Incorrect'}
      </h2>
      
      {correct ? (
        <div className="mt-8 flex flex-col items-center bg-black/20 p-6 rounded-xl">
          <span className="text-sm uppercase tracking-widest opacity-80 mb-1">Points</span>
          <span className="text-5xl font-mono font-bold">+{awardedPoints}</span>
        </div>
      ) : (
        <div className="mt-8 text-center text-white/80 text-lg">
          Better luck next time!
        </div>
      )}
      
      <div className="mt-12 text-sm opacity-70">
        Look at the big screen for standings
      </div>
    </div>
  );
}

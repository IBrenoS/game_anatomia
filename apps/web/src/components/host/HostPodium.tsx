import React from 'react';
import { RankingEntry } from '@batalha/protocol';

interface HostPodiumProps {
  podium: RankingEntry[];
}

export default function HostPodium({ podium }: HostPodiumProps) {
  if (!podium || podium.length === 0) return <div>No winners...</div>;

  const first = podium.find(p => p.position === 1);
  const second = podium.find(p => p.position === 2);
  const third = podium.find(p => p.position === 3);

  return (
    <div className="flex flex-col h-full text-white items-center justify-center">
      <h2 className="text-5xl font-bold text-center mb-16 text-yellow-400 drop-shadow-lg">Champions!</h2>

      <div className="flex items-end justify-center gap-4 h-96 w-full max-w-4xl mx-auto">
        {/* Second Place */}
        {second && (
          <div className="flex flex-col items-center w-1/3 z-10 animate-[slideUp_1s_ease-out]">
            <div className="text-2xl font-bold mb-2 text-gray-300 truncate w-full text-center">{second.nickname}</div>
            <div className="text-xl font-mono mb-2">{second.totalPoints}</div>
            <div className="w-full bg-gray-400 h-48 rounded-t-lg flex items-start justify-center pt-4 shadow-lg border-t-4 border-gray-300">
              <span className="text-4xl font-bold text-gray-800">2</span>
            </div>
          </div>
        )}

        {/* First Place */}
        {first && (
          <div className="flex flex-col items-center w-1/3 z-20 animate-[slideUp_1.5s_ease-out]">
            <div className="text-4xl font-bold mb-2 text-yellow-400 truncate w-full text-center">{first.nickname}</div>
            <div className="text-2xl font-mono mb-2">{first.totalPoints}</div>
            <div className="w-full bg-yellow-500 h-64 rounded-t-lg flex items-start justify-center pt-4 shadow-2xl border-t-4 border-yellow-300">
              <span className="text-5xl font-bold text-yellow-900">1</span>
            </div>
          </div>
        )}

        {/* Third Place */}
        {third && (
          <div className="flex flex-col items-center w-1/3 z-0 animate-[slideUp_0.5s_ease-out]">
            <div className="text-xl font-bold mb-2 text-amber-600 truncate w-full text-center">{third.nickname}</div>
            <div className="text-lg font-mono mb-2">{third.totalPoints}</div>
            <div className="w-full bg-amber-700 h-32 rounded-t-lg flex items-start justify-center pt-4 shadow border-t-4 border-amber-600">
              <span className="text-3xl font-bold text-amber-900">3</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

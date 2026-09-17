import React from 'react';
import { RankingEntry } from '@batalha/protocol';

interface ScreenPodiumProps {
  podium: RankingEntry[];
}

export default function ScreenPodium({ podium }: ScreenPodiumProps) {
  if (!podium || podium.length === 0) return null;

  const first = podium.find(p => p.position === 1);
  const second = podium.find(p => p.position === 2);
  const third = podium.find(p => p.position === 3);

  return (
    <div className="flex flex-col h-full text-white p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-[#1e3a5f] to-black">
      <h2 className="text-7xl font-extrabold text-center mb-24 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] animate-pulse">
        WINNERS!
      </h2>

      <div className="flex items-end justify-center gap-8 h-[500px] w-full max-w-5xl mx-auto">
        {/* Second Place */}
        {second && (
          <div className="flex flex-col items-center w-1/3 z-10 animate-[slideUp_1s_ease-out_0.5s_both]">
            <div className="text-4xl font-bold mb-4 text-gray-300 truncate w-full text-center drop-shadow-md">{second.nickname}</div>
            <div className="text-3xl font-mono mb-4 bg-black/40 px-6 py-2 rounded-full">{second.totalPoints}</div>
            <div className="w-full bg-gradient-to-b from-gray-300 to-gray-500 h-64 rounded-t-2xl flex items-start justify-center pt-6 shadow-[0_0_30px_rgba(156,163,175,0.4)] border-t-8 border-gray-100">
              <span className="text-6xl font-black text-gray-800 drop-shadow-sm">2</span>
            </div>
          </div>
        )}

        {/* First Place */}
        {first && (
          <div className="flex flex-col items-center w-1/3 z-20 animate-[slideUp_1.5s_ease-out_1s_both]">
            <div className="text-6xl font-black mb-4 text-yellow-400 truncate w-full text-center drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">{first.nickname}</div>
            <div className="text-4xl font-mono mb-4 bg-yellow-500/20 px-8 py-2 rounded-full border border-yellow-500/50">{first.totalPoints}</div>
            <div className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 h-96 rounded-t-2xl flex items-start justify-center pt-8 shadow-[0_0_50px_rgba(250,204,21,0.6)] border-t-8 border-yellow-200">
              <span className="text-8xl font-black text-yellow-900 drop-shadow-sm">1</span>
            </div>
          </div>
        )}

        {/* Third Place */}
        {third && (
          <div className="flex flex-col items-center w-1/3 z-0 animate-[slideUp_0.8s_ease-out_0s_both]">
            <div className="text-3xl font-bold mb-4 text-amber-600 truncate w-full text-center drop-shadow-md">{third.nickname}</div>
            <div className="text-2xl font-mono mb-4 bg-black/40 px-6 py-2 rounded-full">{third.totalPoints}</div>
            <div className="w-full bg-gradient-to-b from-amber-600 to-amber-800 h-48 rounded-t-2xl flex items-start justify-center pt-4 shadow-[0_0_20px_rgba(217,119,6,0.4)] border-t-8 border-amber-500">
              <span className="text-5xl font-black text-amber-950 drop-shadow-sm">3</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { PublicQuestion, OptionDistribution } from '@batalha/protocol';

interface HostRevealProps {
  question: PublicQuestion | null;
  distribution: OptionDistribution[];
  correctOptionId: string | null;
  explanation: string | null;
}

export default function HostReveal({ question, distribution, correctOptionId, explanation }: HostRevealProps) {
  if (!question) return <div>Loading...</div>;

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <div className="flex flex-col h-full text-white overflow-y-auto">
      <h2 className="text-3xl font-bold text-center mb-8">{question.prompt}</h2>

      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {question.options.map((option) => {
            const stat = distribution.find(d => d.optionId === option.id) || { count: 0, percentage: 0 };
            const isCorrect = option.id === correctOptionId;
            const barWidth = `${Math.max((stat.count / maxCount) * 100, 2)}%`;

            return (
              <div 
                key={option.id}
                className={`p-6 rounded-xl border-2 relative overflow-hidden flex flex-col ${isCorrect ? 'border-green-500 bg-green-500/20' : 'border-white/10 bg-white/5 opacity-70'}`}
              >
                <div 
                  className={`absolute top-0 bottom-0 left-0 -z-10 ${isCorrect ? 'bg-green-500/30' : 'bg-red-500/20'}`}
                  style={{ width: barWidth, transition: 'width 1s ease-out' }}
                />
                
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xl font-bold z-10 ${isCorrect ? 'text-green-300' : ''}`}>{option.label}</span>
                  {isCorrect && (
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded font-bold">CORRECT</span>
                  )}
                </div>
                
                <div className="text-right z-10">
                  <span className="text-2xl font-bold">{stat.count}</span>
                  <span className="text-sm text-white/70 ml-1">({Math.round(stat.percentage)}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        {explanation && (
          <div className="mt-8 bg-blue-900/50 p-6 rounded-xl border border-blue-500/30">
            <h3 className="text-blue-300 font-bold mb-2">Explanation</h3>
            <p className="text-lg">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

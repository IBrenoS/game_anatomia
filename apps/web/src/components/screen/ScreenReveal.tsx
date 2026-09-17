import React from 'react';
import { PublicQuestion, OptionDistribution } from '@batalha/protocol';

interface ScreenRevealProps {
  question: PublicQuestion | null;
  distribution: OptionDistribution[];
  correctOptionId: string | null;
  explanation: string | null;
}

export default function ScreenReveal({ question, distribution, correctOptionId, explanation }: ScreenRevealProps) {
  if (!question) return <div>Loading...</div>;

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <div className="flex flex-col h-full text-white p-8">
      <h2 className="text-5xl font-bold text-center mb-12">{question.prompt}</h2>

      <div className="flex-1 flex flex-col justify-center gap-8">
        <div className="grid grid-cols-2 gap-6">
          {question.options.map((option, index) => {
            const stat = distribution.find(d => d.optionId === option.id) || { count: 0, percentage: 0 };
            const isCorrect = option.id === correctOptionId;
            const barWidth = `${Math.max((stat.count / maxCount) * 100, 5)}%`;
            const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
            const baseColor = colors[index % colors.length];

            return (
              <div 
                key={option.id}
                className={`p-8 rounded-2xl border-4 relative overflow-hidden flex flex-col min-h-[150px] transition-all duration-500 ${isCorrect ? 'border-white scale-105 z-10' : 'border-black/20 opacity-50'}`}
              >
                <div 
                  className={`absolute top-0 bottom-0 left-0 -z-10 ${baseColor}`}
                  style={{ width: barWidth, transition: 'width 1.5s ease-out' }}
                />
                
                <div className="flex justify-between items-start mb-4">
                  <span className="text-3xl font-bold z-10 drop-shadow-md">{option.label}</span>
                  {isCorrect && (
                    <span className="bg-white text-black text-xl px-4 py-1 rounded-full font-bold shadow-lg">✓ CORRECT</span>
                  )}
                </div>
                
                <div className="text-right z-10 mt-auto">
                  <span className="text-5xl font-bold drop-shadow-md">{stat.count}</span>
                </div>
              </div>
            );
          })}
        </div>

        {explanation && (
          <div className="mt-8 bg-black/40 p-8 rounded-2xl border-2 border-white/20 text-center animate-[fadeIn_1s_ease-in_2s_both]">
            <h3 className="text-2xl text-blue-300 font-bold mb-4 uppercase tracking-wider">Explanation</h3>
            <p className="text-3xl font-medium leading-relaxed">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

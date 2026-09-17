import React, { useEffect, useState } from 'react';
import { PublicQuestion } from '@batalha/protocol';

interface ScreenQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
}

export default function ScreenQuestion({ question, currentQuestionIndex, startedAt, deadlineAt }: ScreenQuestionProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!deadlineAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((deadlineAt - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [deadlineAt]);

  if (!question) return <div>Loading question...</div>;

  return (
    <div className="flex flex-col h-full text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <span className="text-3xl font-bold text-blue-200">Question {currentQuestionIndex + 1}</span>
        <div className={`text-6xl font-mono font-bold px-8 py-4 rounded-full ${timeLeft <= 5 ? 'bg-red-600 animate-pulse' : 'bg-black/30'}`}>
          {timeLeft}
        </div>
      </div>

      <h2 className="text-6xl font-bold text-center mb-12 flex-1 flex items-center justify-center">
        {question.prompt}
      </h2>

      {question.media && (
        <div className="flex justify-center flex-1 mb-8">
          <img 
            src={question.media.src} 
            alt={question.media.alt || 'Question media'} 
            className="max-h-[40vh] object-contain rounded-xl shadow-2xl border-4 border-white/20"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mt-auto">
        {question.options.map((option, index) => {
          const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
          const bgColor = colors[index % colors.length];
          
          return (
            <div 
              key={option.id}
              className={`${bgColor} p-8 rounded-2xl text-3xl font-bold shadow-xl border-4 border-black/20 flex items-center justify-center min-h-[120px]`}
            >
              {option.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

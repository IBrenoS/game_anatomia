import React, { useEffect, useState } from 'react';
import { PublicQuestion } from '@batalha/protocol';

interface HostQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
}

export default function HostQuestion({ question, currentQuestionIndex, startedAt, deadlineAt }: HostQuestionProps) {
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
    <div className="flex flex-col h-full text-white">
      <div className="flex justify-between items-center mb-6">
        <span className="text-xl text-blue-200">Question {currentQuestionIndex + 1}</span>
        <div className="text-4xl font-mono font-bold bg-black/30 px-6 py-2 rounded-full">
          {timeLeft}s
        </div>
      </div>

      <h2 className="text-4xl font-bold text-center mb-12">{question.prompt}</h2>

      {question.media && (
        <div className="flex justify-center mb-8">
          <img 
            src={question.media.src} 
            alt={question.media.alt || 'Question media'} 
            className="max-h-64 object-contain rounded-lg shadow-lg bg-white/5"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
        {question.options.map((option) => (
          <div 
            key={option.id}
            className="bg-white/10 hover:bg-white/20 p-6 rounded-xl text-xl font-semibold border border-white/20 text-center"
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
}

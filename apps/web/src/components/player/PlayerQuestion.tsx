import React from 'react';
import { PublicQuestion } from '@batalha/protocol';
import { wsManager } from '../../lib/ws.js';

interface PlayerQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
  selectedOptionId: string | null;
  answerSubmitted: boolean;
}

export default function PlayerQuestion({ 
  question, 
  currentQuestionIndex,
  startedAt,
  deadlineAt,
  selectedOptionId, 
  answerSubmitted 
}: PlayerQuestionProps) {
  
  if (!question) return <div className="text-white text-center mt-12">Loading...</div>;

  const handleSelectOption = (optionId: string) => {
    if (answerSubmitted) return;
    
    // Optimistically update store via WS manager action which will be dispatched
    wsManager.submitAnswer(question.id, wsManager.roomVersion, optionId);
  };

  if (answerSubmitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white">
        <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-8 animate-bounce">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold mb-4">Answer submitted!</h2>
        <p className="text-blue-200">Waiting for other players...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-white text-center mb-6 text-sm font-bold opacity-70">
        QUESTION {currentQuestionIndex + 1}
      </div>
      
      <div className="grid grid-cols-1 gap-4 flex-1">
        {question.options.map((option, index) => {
          const colors = [
            'bg-red-500 active:bg-red-600', 
            'bg-blue-500 active:bg-blue-600', 
            'bg-yellow-500 active:bg-yellow-600', 
            'bg-green-500 active:bg-green-600'
          ];
          const bgColor = colors[index % colors.length];
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              onClick={() => handleSelectOption(option.id)}
              disabled={answerSubmitted}
              className={`${bgColor} ${isSelected ? 'ring-4 ring-white shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-[1.02]' : ''} 
                text-white p-6 rounded-xl text-2xl font-bold shadow-lg transition-all duration-200 flex items-center justify-center border-b-4 border-black/20`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

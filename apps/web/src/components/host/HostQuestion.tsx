import { useEffect, useState } from 'react';
import type { PublicQuestion } from '@batalha/protocol';

interface HostQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function HostQuestion({ question, currentQuestionIndex, deadlineAt }: HostQuestionProps) {
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

  if (!question) return <div className="text-white text-center py-12">Carregando questão...</div>;

  return (
    <div className="flex flex-col h-full text-white max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        {currentQuestionIndex === 9 ? (
          <span className="text-lg font-black text-amber-950 bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-1.5 rounded-full border border-yellow-300 shadow-md animate-pulse uppercase tracking-wider">
            🔥 DESAFIO FINAL · Questão 10 de 10
          </span>
        ) : (
          <span className="text-lg font-bold bg-blue-900/60 px-4 py-1.5 rounded-full border border-blue-400/30 text-blue-200">
            Questão {currentQuestionIndex + 1} de 10
          </span>
        )}
        <div className="text-4xl font-mono font-black bg-black/40 px-6 py-2 rounded-2xl border border-white/10 text-yellow-300">
          {timeLeft}s
        </div>
      </div>

      <h2 className="text-3xl md:text-4xl font-black text-center mb-6 leading-tight">
        {question.prompt}
      </h2>

      {question.media && (
        <div className="flex justify-center mb-6">
          <img 
            src={question.media.src} 
            alt={question.media.alt || 'Ilustração anatômica'} 
            width={question.media.width || 800}
            height={question.media.height || 600}
            className="max-h-64 object-contain rounded-xl shadow-2xl bg-white/5 border border-white/10"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
        {question.options.map((option, idx) => (
          <div 
            key={option.id}
            className="bg-white/10 hover:bg-white/15 p-5 rounded-2xl text-lg font-bold border border-white/15 flex items-center gap-4 shadow-md transition-all"
          >
            <span className="w-9 h-9 rounded-xl bg-blue-600/80 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
              {OPTION_LETTERS[idx] || (idx + 1)}
            </span>
            <span className="truncate">{option.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

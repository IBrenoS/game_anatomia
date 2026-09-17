import { useEffect, useState } from 'react';
import type { PublicQuestion } from '@batalha/protocol';

interface ScreenQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [
  'bg-blue-600 border-blue-400',
  'bg-amber-600 border-amber-400',
  'bg-emerald-600 border-emerald-400',
  'bg-purple-600 border-purple-400'
];

export default function ScreenQuestion({ question, currentQuestionIndex, deadlineAt }: ScreenQuestionProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [imgError, setImgError] = useState<boolean>(false);

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

  if (!question) return <div className="text-white text-4xl text-center py-24 font-bold">Carregando questão...</div>;

  return (
    <div className="flex flex-col h-full text-white p-8 md:p-10 max-w-7xl mx-auto w-full select-none justify-between">
      <div className="flex justify-between items-center mb-4">
        <span className="text-2xl md:text-3xl font-black text-blue-200 bg-blue-950/60 px-6 py-2 rounded-2xl border border-blue-400/30">
          Questão {currentQuestionIndex + 1} de 10
        </span>
        <div className={`text-5xl md:text-6xl font-mono font-black px-8 py-2.5 rounded-2xl border transition-all ${
          timeLeft <= 10 
            ? 'bg-red-600/90 border-red-400 text-white motion-safe:animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.5)]' 
            : 'bg-black/40 border-white/20 text-yellow-300'
        }`}>
          {timeLeft}s
        </div>
      </div>

      <h2 className="text-3xl md:text-5xl font-black text-center mb-4 leading-tight drop-shadow-md">
        {question.prompt}
      </h2>

      {question.media && !imgError && (
        <div className="flex justify-center mb-4">
          <img 
            src={question.media.src} 
            alt={question.media.alt || 'Ilustração anatômica'} 
            width={question.media.width || 800}
            height={question.media.height || 600}
            onError={() => setImgError(true)}
            className="max-h-[32vh] object-contain rounded-2xl shadow-2xl border-2 border-white/20 bg-black/25 transition-all"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 mt-auto">
        {question.options.map((option, index) => {
          const colorClass = OPTION_COLORS[index % OPTION_COLORS.length];
          const letter = OPTION_LETTERS[index] || (index + 1);

          return (
            <div 
              key={option.id}
              className={`${colorClass} p-5 md:p-6 rounded-2xl text-xl md:text-3xl font-black shadow-2xl border-2 flex items-center gap-4 min-h-[90px] md:min-h-[100px] transition-transform`}
            >
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-black/30 text-white flex items-center justify-center font-black text-2xl md:text-3xl shrink-0 border border-white/20 shadow-inner">
                {letter}
              </div>
              <span className="leading-snug">{option.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

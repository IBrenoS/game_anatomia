import { useEffect, useState } from 'react';
import type { PublicQuestion } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';

interface HostQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function HostQuestion({ question, currentQuestionIndex, deadlineAt }: HostQuestionProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const answeredCount = useGameStore((s) => s.answeredCount);
  const activeEligiblePlayers = useGameStore((s) => s.activeEligiblePlayers);
  const distribution = useGameStore((s) => s.distribution);
  const roomState = useGameStore((s) => s.roomState);
  const remainingMs = useGameStore((s) => s.remainingMs);
  const isPaused = roomState === 'PAUSED';

  useEffect(() => {
    if (isPaused) {
      setTimeLeft(Math.ceil(Math.max(0, remainingMs ?? 0) / 1000));
      return;
    }
    if (!deadlineAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((deadlineAt - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [deadlineAt, isPaused, remainingMs]);

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
        <div className="flex items-center gap-4">
          <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/10 text-sm font-bold text-blue-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{answeredCount} / {activeEligiblePlayers} jogadores ativos responderam</span>
          </div>
          <div className="text-4xl font-mono font-black bg-black/40 px-6 py-2 rounded-2xl border border-white/10 text-yellow-300">
            {isPaused ? `⏸ ${timeLeft}s` : `${timeLeft}s`}
          </div>
        </div>
      </div>

      {isPaused && (
        <div role="status" className="mb-5 rounded-xl border border-amber-400/40 bg-amber-950/70 px-4 py-3 text-center font-bold text-amber-100">
          Rodada pausada — cronômetro congelado
        </div>
      )}

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
        {question.options.map((option, idx) => {
          const dist = distribution?.find(d => d.optionId === option.id);
          const count = dist ? dist.count : 0;
          return (
            <div 
              key={option.id}
              className="bg-white/10 hover:bg-white/15 p-5 rounded-2xl text-lg font-bold border border-white/15 flex items-center justify-between gap-4 shadow-md transition-all"
            >
              <div className="flex items-center gap-4 truncate">
                <span className="w-9 h-9 rounded-xl bg-blue-600/80 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                  {OPTION_LETTERS[idx] || (idx + 1)}
                </span>
                <span className="truncate">{option.label}</span>
              </div>
              <span className="text-xs font-mono font-semibold bg-white/10 px-3 py-1.5 rounded-xl text-blue-200 border border-white/10 shrink-0">
                {count} voto{count === 1 ? '' : 's'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

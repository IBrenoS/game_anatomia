import { useEffect, useState } from 'react';
import { TOTAL_QUESTIONS, type PublicQuestion } from '@batalha/protocol';
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

  if (!question) return <div className="text-[#555E57] text-center py-12">Carregando questão...</div>;

  return (
    <div className="flex flex-col h-full text-[#122017] max-w-5xl mx-auto w-full p-4 sm:p-6 select-none">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        {currentQuestionIndex === TOTAL_QUESTIONS - 1 ? (
          <span className="text-xs sm:text-sm font-black text-[#B45309] bg-[#FEF9EE] px-3.5 py-1 rounded-full border border-[#F59E0B]/50 shadow-xs uppercase tracking-wider">
            {`🔥 DESAFIO FINAL · Questão ${TOTAL_QUESTIONS} de ${TOTAL_QUESTIONS}`}
          </span>
        ) : (
          <span className="text-xs sm:text-sm font-bold bg-white px-3.5 py-1 rounded-full border border-[#E2DDD2] text-[#122017] shadow-xs">
            Questão {currentQuestionIndex + 1} de {TOTAL_QUESTIONS}
          </span>
        )}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-white px-3.5 py-1 rounded-full border border-[#E2DDD2] text-xs font-bold text-[#555E57] flex items-center gap-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#2D8058] animate-pulse" />
            <span>{answeredCount} / {activeEligiblePlayers} responderam</span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black bg-white px-4 py-1 rounded-2xl border border-[#E2DDD2] text-[#123829] shadow-xs">
            {isPaused ? `⏸ ${timeLeft}s` : `${timeLeft}s`}
          </div>
        </div>
      </div>

      {isPaused && (
        <div role="status" className="mb-4 rounded-xl border border-[#D05F36]/30 bg-[#FBEBE8] px-4 py-2.5 text-center font-bold text-[#D05F36] text-xs sm:text-sm shadow-xs">
          Rodada pausada — cronômetro congelado
        </div>
      )}

      <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-center my-3 sm:my-4 leading-snug">
        {question.prompt}
      </h2>

      {question.media && (
        <div className="flex justify-center my-2 sm:my-4">
          <div className="bg-[#EBF0E8] border border-[#D5DDD0] rounded-2xl p-2 shadow-xs">
            <img 
              src={question.media.src} 
              alt={question.media.alt || 'Ilustração anatômica'} 
              width={question.media.width || 800}
              height={question.media.height || 600}
              className="max-h-48 sm:max-h-64 object-contain rounded-xl bg-white/70"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-auto">
        {question.options.map((option, idx) => {
          const dist = distribution?.find(d => d.optionId === option.id);
          const count = dist ? dist.count : 0;
          return (
            <div 
              key={option.id}
              className="bg-white hover:bg-[#F7F5EE] p-4 sm:p-5 rounded-2xl text-base sm:text-lg font-bold border border-[#E2DDD2] flex items-center justify-between gap-4 shadow-xs transition-all"
            >
              <div className="flex items-center gap-3 truncate">
                <span className="w-8 h-8 rounded-xl bg-[#123829] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                  {OPTION_LETTERS[idx] || (idx + 1)}
                </span>
                <span className="truncate">{option.label}</span>
              </div>
              <span className="text-xs font-mono font-semibold bg-[#FAF8F3] px-3 py-1 rounded-xl text-[#555E57] border border-[#E2DDD2] shrink-0">
                {count} voto{count === 1 ? '' : 's'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

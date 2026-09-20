import { useEffect, useState } from 'react';
import { TOTAL_QUESTIONS, type PublicQuestion } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';

interface HostQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
  onResume?: () => void;
  onResumeDisabled?: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function HostQuestion({
  question,
  currentQuestionIndex,
  deadlineAt,
  onResume,
  onResumeDisabled = false,
}: HostQuestionProps) {
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="host-pause-dialog-title"
          className="fixed inset-0 bg-[#123829]/40 backdrop-blur-xs z-30 flex items-center justify-center p-4 animate-fade-in-scale"
        >
          <div className="bg-white border border-[#E2DDD2] rounded-3xl p-6 sm:p-8 text-center shadow-2xl max-w-sm w-full mx-auto animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D05F36] to-[#A8382B] text-white flex items-center justify-center mx-auto mb-3 shadow-md text-xl font-black">
              ⏸
            </div>
            <h3 id="host-pause-dialog-title" className="text-xl sm:text-2xl font-black text-[#122017] mb-1 tracking-tight">
              Partida pausada
            </h3>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBEBE8] border border-[#D05F36]/30 text-[#D05F36] text-[11px] font-black tracking-wider uppercase mb-2 shadow-xs">
              Rodada pausada
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#D05F36] mb-2">
              Você pausou a partida. O cronômetro está congelado{remainingMs !== null ? ` em ${Math.ceil((remainingMs || 0) / 1000)}s.` : '.'}
            </p>
            <p className="text-xs text-[#555E57] leading-relaxed mb-4">
              A rodada está suspensa temporariamente. Clique no botão abaixo para retomar a partida do mesmo ponto.
            </p>
            {onResume ? (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  type="button"
                  onClick={onResume}
                  disabled={onResumeDisabled}
                  className="w-full py-3 px-5 bg-[#123829] hover:bg-[#1B4D3E] disabled:bg-slate-400 text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                  aria-label="Retomar Rodada - Retomar Partida"
                >
                  <span>▶</span> Retomar Partida
                </button>
                <span className="text-[11px] font-semibold text-[#64748B]">
                  Contagem regressiva de 3s antecede a retomada
                </span>
              </div>
            ) : (
              <span className="inline-block text-[11px] font-bold text-[#64748B] bg-[#FAF8F3] border border-[#E2DDD2] px-3 py-1 rounded-full">
                Aguardando reconexão dos controles do apresentador
              </span>
            )}
          </div>
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

import { useState } from 'react';
import type { PublicQuestion } from '@batalha/protocol';
import { wsManager } from '../../lib/ws.js';
import { useGameStore } from '../../stores/gameStore.js';
import { soundManager } from '../../lib/sound.js';
import CountdownTimer from './CountdownTimer.js';

interface PlayerQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
  selectedOptionId: string | null;
  answerSubmitted: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [
  'bg-blue-600 hover:bg-blue-500 border-blue-400',
  'bg-amber-600 hover:bg-amber-500 border-amber-400',
  'bg-emerald-600 hover:bg-emerald-500 border-emerald-400',
  'bg-purple-600 hover:bg-purple-500 border-purple-400'
];

export default function PlayerQuestion({ 
  question, 
  currentQuestionIndex,
  startedAt,
  deadlineAt,
  selectedOptionId, 
  answerSubmitted 
}: PlayerQuestionProps) {
  const [optimisticOptionId, setOptimisticOptionId] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  
  const selectOption = useGameStore((s) => s.selectOption);
  const answerRejected = useGameStore((s) => s.answerRejected);

  if (!question) return <div className="text-white text-center py-12">Carregando pergunta...</div>;

  const currentSelection = selectedOptionId || optimisticOptionId;
  const isLocked = Boolean(answerSubmitted || optimisticOptionId);

  const handleSelectOption = (optionId: string) => {
    if (isLocked) return;
    
    // Immediate optimistic lock and audio feedback
    setOptimisticOptionId(optionId);
    selectOption(optionId);
    soundManager.playAnswerSubmit();

    // Transmit authoritative answer
    wsManager.submitAnswer(question.id, wsManager.roomVersion, optionId);
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto w-full justify-between select-none">
      {/* Visual Hierarchy Header: Badge & Points */}
      <div className="shrink-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-bold text-blue-200 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-400/30 uppercase tracking-wider">
            Questão {currentQuestionIndex + 1} de 10
          </span>
          <span className="text-xs font-bold text-yellow-300 bg-yellow-950/40 px-3 py-1 rounded-full border border-yellow-500/30">
            ⭐ {question.basePoints} pontos base
          </span>
        </div>

        {/* Dynamic Countdown Bar */}
        <CountdownTimer deadlineAt={deadlineAt} startedAt={startedAt} />

        {/* Prompt */}
        <h2 className="text-base sm:text-lg font-bold text-white mt-2 mb-2 leading-snug">
          {question.prompt}
        </h2>

        {/* Responsive Anatomical Image (max-h-28 to max-h-36 to avoid mobile overflow) */}
        {question.media && !imgError && (
          <div className="flex justify-center mb-2">
            <img 
              src={question.media.src} 
              alt={question.media.alt || 'Ilustração anatômica'} 
              width={question.media.width || 800}
              height={question.media.height || 600}
              onError={() => setImgError(true)}
              className="max-h-28 sm:max-h-36 w-auto object-contain rounded-xl shadow border border-white/10 bg-black/25 transition-all"
            />
          </div>
        )}
      </div>

      {/* Answer Confirmation / Status Banner (Neutral - No premature spoilers) */}
      {isLocked && (
        <div className="bg-blue-950/80 border border-blue-400/40 rounded-2xl p-3 text-center shadow-lg my-1.5 animate-[fadeIn_0.25s_ease-out] motion-reduce:animate-none">
          <div className="flex items-center justify-center gap-2 text-blue-100 font-bold text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping motion-reduce:animate-none" />
            <span>Resposta registrada!</span>
          </div>
          <p className="text-xs text-blue-200/90 mt-0.5">
            Aguarde o encerramento da rodada e o gabarito no telão.
          </p>
        </div>
      )}

      {/* Rejection Notification if any */}
      {answerRejected && (
        <div className="bg-red-950/80 border border-red-500/50 rounded-2xl p-2.5 text-center shadow-lg my-1.5">
          <span className="text-xs font-bold text-red-200">
            ⚠ {answerRejected.message || 'Resposta rejeitada pelo servidor.'}
          </span>
        </div>
      )}
      
      {/* 4 Accessible Touch Alternative Buttons (min-h >= 50px) */}
      <div className="grid grid-cols-1 gap-2.5 my-auto pb-2">
        {question.options.map((option, index) => {
          const colorClass = OPTION_COLORS[index % OPTION_COLORS.length];
          const letter = OPTION_LETTERS[index] || (index + 1);
          const isSelected = currentSelection === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectOption(option.id)}
              disabled={isLocked}
              className={`${colorClass} ${
                isSelected 
                  ? 'ring-4 ring-white scale-[1.02] shadow-2xl brightness-110' 
                  : isLocked 
                  ? 'opacity-50 cursor-default' 
                  : 'cursor-pointer active:scale-98'
              } text-white min-h-[50px] sm:min-h-[56px] p-3 sm:p-3.5 rounded-2xl text-left font-bold shadow-md transition-all flex items-center gap-3 border-b-4 border-black/30`}
              aria-label={`Alternativa ${letter}: ${option.label}`}
              aria-pressed={isSelected}
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-base shrink-0 border border-white/20 shadow-inner ${
                isSelected ? 'bg-white text-slate-900' : 'bg-black/30 text-white'
              }`}>
                {isSelected ? '✓' : letter}
              </span>
              <span className="text-sm sm:text-base leading-snug flex-1">
                {option.label}
              </span>
              {isSelected && (
                <span className="text-[11px] font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full shrink-0">
                  Sua escolha
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

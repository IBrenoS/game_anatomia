import type { PublicQuestion } from '@batalha/protocol';
import { wsManager } from '../../lib/ws.js';
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
  'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 border-blue-400',
  'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 border-amber-400',
  'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border-emerald-400',
  'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 border-purple-400'
];

export default function PlayerQuestion({ 
  question, 
  currentQuestionIndex,
  startedAt,
  deadlineAt,
  selectedOptionId, 
  answerSubmitted 
}: PlayerQuestionProps) {
  
  if (!question) return <div className="text-white text-center py-12">Carregando pergunta...</div>;

  const handleSelectOption = (optionId: string) => {
    if (answerSubmitted) return;
    wsManager.submitAnswer(question.id, wsManager.roomVersion, optionId);
  };

  if (answerSubmitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center animate-[fadeIn_0.3s_ease-out]">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_25px_rgba(34,197,94,0.5)]">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-2 text-green-300">Resposta Enviada!</h2>
        <p className="text-base text-blue-200 max-w-xs">
          Aguarde todos os participantes responderem ou o encerramento do prazo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto w-full justify-between">
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-blue-200 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-400/30 uppercase tracking-wider">
            Questão {currentQuestionIndex + 1} de 10
          </span>
          <span className="text-xs font-bold text-yellow-300">
            {question.basePoints} pontos base
          </span>
        </div>

        <CountdownTimer deadlineAt={deadlineAt} startedAt={startedAt} />

        <h2 className="text-lg md:text-xl font-bold text-white mt-3 mb-4 leading-snug">
          {question.prompt}
        </h2>

        {question.media && (
          <div className="flex justify-center mb-4">
            <img 
              src={question.media.src} 
              alt={question.media.alt || 'Ilustração anatômica'} 
              width={question.media.width || 800}
              height={question.media.height || 600}
              className="max-h-40 object-contain rounded-xl shadow-lg border border-white/10 bg-black/20"
            />
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-3.5 my-auto pb-4">
        {question.options.map((option, index) => {
          const colorClass = OPTION_COLORS[index % OPTION_COLORS.length];
          const letter = OPTION_LETTERS[index] || (index + 1);
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectOption(option.id)}
              disabled={answerSubmitted}
              className={`${colorClass} ${
                isSelected ? 'ring-4 ring-white scale-[1.02] shadow-2xl' : ''
              } text-white min-h-[58px] p-4 rounded-2xl text-left font-bold shadow-lg transition-all active:scale-98 flex items-center gap-3.5 border-b-4 border-black/30 cursor-pointer`}
              aria-label={`Alternativa ${letter}: ${option.label}`}
            >
              <span className="w-9 h-9 rounded-xl bg-black/25 text-white flex items-center justify-center font-black text-lg shrink-0 border border-white/20 shadow-inner">
                {letter}
              </span>
              <span className="text-base md:text-lg leading-tight flex-1">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

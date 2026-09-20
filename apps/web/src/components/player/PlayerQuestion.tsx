import { useState, useEffect } from 'react';
import { TOTAL_QUESTIONS, type PublicQuestion } from '@batalha/protocol';
import { getWebSocketManager } from '../../lib/ws.js';
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
  roomState?: import('@batalha/protocol').GameState | null;
  remainingMs?: number | null;
  answerRejected?: { code: string; message: string } | null;
  layout?: 'auto' | 'complementary' | 'protagonist';
  protagonist?: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const OPTION_THEMES = [
  {
    letterBg: 'bg-[#3B68A6]',
    borderAccent: 'border-l-[#3B68A6]',
    textAccent: 'text-[#3B68A6]',
  },
  {
    letterBg: 'bg-[#C95A34]',
    borderAccent: 'border-l-[#C95A34]',
    textAccent: 'text-[#C95A34]',
  },
  {
    letterBg: 'bg-[#2D8058]',
    borderAccent: 'border-l-[#2D8058]',
    textAccent: 'text-[#2D8058]',
  },
  {
    letterBg: 'bg-[#7A4C80]',
    borderAccent: 'border-l-[#7A4C80]',
    textAccent: 'text-[#7A4C80]',
  },
];

export default function PlayerQuestion({
  question,
  currentQuestionIndex,
  startedAt,
  deadlineAt,
  selectedOptionId,
  answerSubmitted,
  roomState: propRoomState,
  remainingMs: propRemainingMs,
  answerRejected: propAnswerRejected,
  layout,
  protagonist,
}: PlayerQuestionProps) {
  const [optimisticOptionId, setOptimisticOptionId] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const selectOption = useGameStore((s) => s.selectOption);
  const storeAnswerRejected = useGameStore((s) => s.answerRejected);
  const storeRoomState = useGameStore((s) => s.roomState);
  const storeRemainingMs = useGameStore((s) => s.remainingMs);

  const roomState = propRoomState !== undefined ? propRoomState : storeRoomState;
  const remainingMs = propRemainingMs !== undefined ? propRemainingMs : storeRemainingMs;
  const answerRejected = propAnswerRejected !== undefined ? propAnswerRejected : storeAnswerRejected;

  useEffect(() => {
    if (answerRejected) {
      setOptimisticOptionId(null);
    }
  }, [answerRejected]);

  useEffect(() => {
    setOptimisticOptionId(null);
  }, [question?.id]);

  useEffect(() => {
    if (answerSubmitted) {
      setOptimisticOptionId(null);
    }
  }, [answerSubmitted]);

  if (!question) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-12 text-center">
        <div className="w-10 h-10 border-3 border-[#1FD4A7] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-base font-bold">Carregando pergunta...</p>
      </div>
    );
  }

  const currentSelection = selectedOptionId || (answerRejected ? null : optimisticOptionId);
  const isPaused = roomState === 'PAUSED';
  const hasRecordedAnswer = Boolean(
    answerSubmitted || ((selectedOptionId || optimisticOptionId) && !answerRejected)
  );
  const interactionLocked = roomState !== 'QUESTION_ACTIVE' || hasRecordedAnswer;

  const handleSelectOption = (optionId: string) => {
    if (interactionLocked) return;

    setOptimisticOptionId(optionId);
    selectOption(optionId);
    soundManager.playAnswerSubmit();

    getWebSocketManager('player').submitAnswer(question.id, currentQuestionIndex, optionId);
  };

  const isFinalQuestion = currentQuestionIndex === TOTAL_QUESTIONS - 1;
  const totalQuestions = TOTAL_QUESTIONS;
  const hasMedia = Boolean(question.media && !imgError);

  // Desktop layout variation:
  // - P03 (sem imagem): !hasMedia
  // - P04 (imagem complementar): hasMedia && !isProtagonist -> 2-column split (media left, alternatives right)
  // - P04B (imagem protagonista): hasMedia && isProtagonist -> full-width hero media in center, 2x2 grid below
  const isProtagonist = Boolean(
    hasMedia &&
      (protagonist ??
        (layout === 'protagonist'
          ? true
          : layout === 'complementary'
          ? false
          : question.type === 'identify' ||
            question.type === 'region' ||
            (question.prompt &&
              (question.prompt.toLowerCase().includes('identifique') ||
                question.prompt.toLowerCase().includes('observe a relação')))))
  );
  const isComplementary = hasMedia && !isProtagonist;

  const renderMediaCard = (variant: 'complementary' | 'protagonist' | 'mobile' = 'complementary') => {
    if (!hasMedia || !question.media) return null;

    const isProtagonistDesktop = variant === 'protagonist';
    const isMobileStacked = variant === 'mobile';

    return (
      <div
        className={`bg-[#EBF0E8] border border-[#D5DDD0] rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-center shadow-xs transition-all ${
          isProtagonistDesktop
            ? 'w-full max-h-[28vh] sm:max-h-[32vh] my-1 sm:my-2'
            : isMobileStacked
            ? 'w-full max-h-[13vh] my-0.5 sm:my-1'
            : 'w-full h-full max-h-[360px] lg:max-h-[420px]'
        }`}
      >
        <div className="w-full flex items-center justify-between mb-0.5 px-1 shrink-0">
          <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-[#123829]">
            REFERÊNCIA ANATÔMICA
          </span>
          <span className="text-[9px] sm:text-[10px] text-[#648B68] font-semibold">
            Ilustração
          </span>
        </div>

        <div className="flex-1 w-full flex items-center justify-center overflow-hidden rounded-xl bg-white/70 p-1 border border-[#D5DDD0]/50 min-h-0">
          <img
            src={question.media.src}
            alt={question.media.alt || 'Referência anatômica'}
            width={question.media.width || 800}
            height={question.media.height || 600}
            onError={() => setImgError(true)}
            className={`w-auto object-contain transition-all rounded-lg ${
              isProtagonistDesktop
                ? 'max-h-[22vh] sm:max-h-[26vh]'
                : isMobileStacked
                ? 'max-h-[9vh]'
                : 'max-h-[280px] lg:max-h-[340px]'
            }`}
          />
        </div>

        {question.media.alt && !isMobileStacked && (
          <span className="text-[9px] sm:text-[10px] text-[#526B59] font-medium text-center mt-0.5 truncate max-w-full px-1 shrink-0">
            {question.media.alt}
          </span>
        )}
      </div>
    );
  };

  const renderAlternatives = (cols: 1 | 2 = 1) => (
    <div className={`grid grid-cols-1 ${cols === 2 ? 'sm:grid-cols-2' : ''} gap-2 sm:gap-2.5 w-full`}>
      {question.options.map((option, index) => {
        const theme = OPTION_THEMES[index % OPTION_THEMES.length];
        const letter = OPTION_LETTERS[index] || (index + 1);
        const isSelected = currentSelection === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleSelectOption(option.id)}
            disabled={interactionLocked}
            className={`group relative w-full text-left min-h-[44px] sm:min-h-[52px] p-2.5 sm:p-3 rounded-2xl transition-all duration-150 flex items-center gap-3 border ${
              isSelected
                ? 'bg-white border-2 border-[#123829] shadow-lg ring-2 ring-[#123829]/20 scale-[1.01]'
                : interactionLocked
                ? 'bg-[#FAF8F3] border-[#E2DDD2] opacity-60 cursor-default'
                : 'bg-white hover:bg-[#F7F5EE] border-[#E2DDD2] hover:border-[#CBD5E1] shadow-xs cursor-pointer active:scale-[0.99]'
            } border-l-[6px] ${isSelected ? 'border-l-[#123829]' : theme.borderAccent}`}
            aria-label={`Alternativa ${letter}: ${option.label}`}
            aria-pressed={isSelected}
          >
            {/* Left Letter Badge or Checkmark */}
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shrink-0 transition-transform ${
                isSelected
                  ? 'bg-[#123829] text-white shadow-sm'
                  : `${theme.letterBg} text-white shadow-xs group-hover:scale-105`
              }`}
            >
              {isSelected ? '✓' : letter}
            </div>

            {/* Alternative Label */}
            <span className="text-xs sm:text-sm md:text-base font-bold text-[#122017] leading-snug flex-1">
              {option.label}
            </span>

            {/* Chosen Badge */}
            {isSelected && (
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-[#EAF5EC] text-[#123829] border border-[#123829]/20 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 animate-scale-in">
                Sua escolha
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderAnswerStatus = () =>
    hasRecordedAnswer ? (
      <div className="bg-[#EAF5EC] border border-[#A3D9B5] rounded-2xl p-2 sm:p-2.5 my-1 shadow-xs animate-scale-in shrink-0">
        <div className="flex items-center justify-between gap-2 text-[#123829] font-black text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#1FD4A7] animate-ping" />
            <span>✓ Resposta registrada!</span>
          </div>
          <span className="text-[11px] font-semibold text-[#555E57] hidden sm:inline">
            Você pode acompanhar o tempo — sua escolha já está salva.
          </span>
        </div>
        <p className="text-[11px] text-[#555E57] mt-0.5 sm:hidden">
          Você pode acompanhar o tempo — sua escolha já está salva.
        </p>
        <p className="text-[10px] text-[#648B68] mt-0.5">
          Aguarde o encerramento da rodada e o gabarito no telão.
        </p>
      </div>
    ) : null;

  const renderRejection = () =>
    answerRejected ? (
      <div className="bg-[#FBEBE8] border border-[#D05F36]/50 rounded-2xl p-2 text-center shadow-xs my-1 shrink-0">
        <span className="text-xs font-bold text-[#D05F36]">
          ⚠ {answerRejected.message || 'Resposta rejeitada pelo servidor. Escolha novamente.'}
        </span>
      </div>
    ) : null;

  const renderFooter = () => (
    <div className="text-center mt-1 shrink-0">
      <span className="text-[10px] sm:text-[11px] font-semibold text-[#64748B]">
        {hasRecordedAnswer
          ? 'Aguarde o encerramento da rodada.'
          : 'Escolha uma alternativa antes do tempo acabar.'}
      </span>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col justify-between p-2.5 sm:p-4 md:p-6 select-none w-full max-w-5xl mx-auto relative min-h-0 animate-scale-in">
      {/* Paused Overlay Modal (P06) - Battle context remains visible dimmed underneath */}
      {isPaused && (
        <div
          role="status"
          className="fixed inset-0 bg-[#123829]/40 backdrop-blur-xs z-30 flex items-center justify-center p-4 animate-fade-in-scale"
        >
          <div className="bg-white border border-[#E2DDD2] rounded-3xl p-6 sm:p-8 text-center shadow-2xl max-w-sm w-full mx-auto animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D05F36] to-[#A8382B] text-white flex items-center justify-center mx-auto mb-3 shadow-md text-xl font-black">
              ⏸
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-[#122017] mb-1 tracking-tight">
              Partida pausada
            </h3>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBEBE8] border border-[#D05F36]/30 text-[#D05F36] text-[11px] font-black tracking-wider uppercase mb-2 shadow-xs">
              Rodada pausada
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#D05F36] mb-2">
              {`Partida pausada pelo apresentador. O cronômetro está congelado${remainingMs !== null ? ` em ${Math.ceil((remainingMs || 0) / 1000)}s.` : '.'}`}
            </p>
            <p className="text-xs text-[#555E57] leading-relaxed mb-4">
              Quando a rodada voltar, você poderá responder normalmente. A rodada continua do mesmo ponto quando o apresentador retomar.
            </p>
            <span className="inline-block text-[11px] font-bold text-[#64748B] bg-[#FAF8F3] border border-[#E2DDD2] px-3 py-1 rounded-full">
              Rodada suspensa temporariamente
            </span>
          </div>
        </div>
      )}

      {/* Top Header: Brand, Question Counter & Points Badge */}
      <div className="shrink-0 mb-1 sm:mb-2">
        {/* Brand Header */}
        <div className="flex justify-between items-center mb-1">
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-xs font-black tracking-widest text-[#123829] uppercase">
              BATALHA ANATÔMICA
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold tracking-wider text-[#648B68] uppercase">
              BOVINO <span className="text-[#D05F36]">×</span> EQUINO
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isFinalQuestion ? (
              <span className="text-[10px] sm:text-xs font-black text-[#B45309] bg-[#FEF9EE] px-2.5 sm:px-3 py-0.5 rounded-full border border-[#F59E0B]/50 uppercase tracking-wider shadow-xs">
                {`🔥 DESAFIO FINAL · Questão ${totalQuestions} de ${totalQuestions}`}
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs font-bold text-[#122017] bg-white px-2.5 sm:px-3 py-0.5 rounded-full border border-[#E2DDD2] uppercase tracking-wider shadow-xs">
                {`Questão ${currentQuestionIndex + 1} de ${totalQuestions}`}
              </span>
            )}

            <span className="text-[10px] sm:text-xs font-black text-[#123829] bg-white px-2.5 sm:px-3 py-0.5 rounded-full border border-[#E2DDD2] shadow-xs">
              {`${question.basePoints} pts`}
            </span>
          </div>
        </div>

        {/* Countdown & Progress Bar */}
        <CountdownTimer
          deadlineAt={deadlineAt}
          startedAt={startedAt}
          paused={isPaused}
          remainingMs={remainingMs}
        />
      </div>

      {/* Question Content & Alternatives */}
      {isComplementary ? (
        /* P04: Desktop Complementary (2 columns on lg, stacked on mobile) */
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-2.5 sm:gap-6 lg:items-center min-h-0 my-auto">
          {/* Left Column (Desktop complementary media card) */}
          <div className="hidden lg:flex lg:col-span-5 h-full items-center justify-center">
            {renderMediaCard('complementary')}
          </div>

          {/* Right Column (Question prompt & Alternatives) */}
          <div className="col-span-1 lg:col-span-7 flex flex-col justify-between flex-1 lg:h-full min-h-0 overflow-y-auto sm:overflow-visible">
            {/* Mobile stacked media (always above prompt on mobile) */}
            <div className="lg:hidden shrink-0">
              {renderMediaCard('mobile')}
            </div>

            {/* Prompt */}
            <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-black text-[#122017] my-1 sm:my-2 leading-snug tracking-tight">
              {question.prompt}
            </h2>

            {/* Status Banner when Answer Recorded (P05) */}
            {renderAnswerStatus()}

            {/* Rejection Notification if any */}
            {renderRejection()}

            {/* Alternatives List (1 column in split layout) */}
            <div className="my-auto py-1">
              {renderAlternatives(1)}
            </div>

            {/* Footer guidance */}
            {renderFooter()}
          </div>
        </div>
      ) : isProtagonist ? (
        /* P04B: Desktop Protagonist (wide central hero media + 2x2 grid on desktop, stacked on mobile) */
        <div className="flex-1 flex flex-col justify-between min-h-0 overflow-y-auto sm:overflow-visible my-auto">
          {/* Mobile stacked media (always above prompt on mobile) */}
          <div className="sm:hidden w-full shrink-0">
            {renderMediaCard('mobile')}
          </div>

          {/* Prompt at top */}
          <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-black text-[#122017] my-1 leading-snug tracking-tight text-center sm:text-left">
            {question.prompt}
          </h2>

          {/* Status Banner when Answer Recorded (P05) */}
          {renderAnswerStatus()}

          {/* Rejection Notification if any */}
          {renderRejection()}

          {/* Wide Protagonist Hero Media Card (Desktop only) */}
          <div className="hidden sm:flex shrink-0 items-center justify-center">
            <div className="w-full">
              {renderMediaCard('protagonist')}
            </div>
          </div>

          {/* 2x2 Alternatives Grid on sm/desktop, 1 col on mobile */}
          <div className="my-auto py-1">
            {renderAlternatives(2)}
          </div>

          {/* Footer guidance */}
          {renderFooter()}
        </div>
      ) : (
        /* P03: Standard / Sem Imagem layout (2x2 grid on sm/desktop, 1 col on mobile) */
        <div className="flex-1 flex flex-col justify-between min-h-0 overflow-y-auto sm:overflow-visible my-auto">
          {/* Prompt */}
          <h2 className="text-base sm:text-lg md:text-xl font-black text-[#122017] my-2 sm:my-3 leading-snug tracking-tight text-center sm:text-left">
            {question.prompt}
          </h2>

          {/* Status Banner when Answer Recorded (P05) */}
          {renderAnswerStatus()}

          {/* Rejection Notification if any */}
          {renderRejection()}

          {/* Alternatives Grid: 2x2 on sm/desktop, 1 col on mobile */}
          <div className="my-auto py-1">
            {renderAlternatives(2)}
          </div>

          {/* Footer guidance */}
          {renderFooter()}
        </div>
      )}
    </div>
  );
}

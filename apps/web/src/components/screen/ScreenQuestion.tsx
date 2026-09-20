import { useEffect, useState } from 'react';
import { TOTAL_QUESTIONS, type PublicQuestion } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';

interface ScreenQuestionProps {
  question: PublicQuestion | null;
  currentQuestionIndex: number;
  startedAt: number | null;
  deadlineAt: number | null;
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

export default function ScreenQuestion({
  question,
  currentQuestionIndex,
  deadlineAt,
}: ScreenQuestionProps) {
  const answeredCount = useGameStore((s) => s.answeredCount);
  const activeEligiblePlayers = useGameStore((s) => s.activeEligiblePlayers);
  const roomState = useGameStore((s) => s.roomState);
  const remainingMs = useGameStore((s) => s.remainingMs);
  const isPaused = roomState === 'PAUSED';
  const allAnswered = activeEligiblePlayers > 0 && answeredCount >= activeEligiblePlayers;

  const initialTimeLeft = isPaused
    ? Math.ceil(Math.max(0, remainingMs ?? 0) / 1000)
    : deadlineAt
    ? Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000))
    : 0;

  const [timeLeft, setTimeLeft] = useState<number>(initialTimeLeft);
  const [imgError, setImgError] = useState<boolean>(false);

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

  if (!question) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[#555E57] py-24 text-center">
        <div className="w-12 h-12 border-4 border-[#123829] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-3xl font-black text-[#122017]">Carregando questão...</p>
      </div>
    );
  }

  const isFinalQuestion = currentQuestionIndex === TOTAL_QUESTIONS - 1;
  const hasMedia = Boolean(question.media && !imgError);

  const isProtagonist = Boolean(
    hasMedia &&
      (question.type === 'identify' ||
        question.type === 'region' ||
        (question.prompt &&
          (question.prompt.toLowerCase().includes('identifique') ||
            question.prompt.toLowerCase().includes('observe a relação'))))
  );
  const isComplementary = hasMedia && !isProtagonist;

  const renderMediaCard = (maxHeightClass: string) => {
    if (!hasMedia || !question.media) return null;
    return (
      <div className="bg-[#EBF0E8] border border-[#D5DDD0] rounded-3xl p-3 lg:p-4 flex flex-col items-center justify-center shadow-sm w-full">
        <div className="w-full flex items-center justify-between mb-1.5 px-2 shrink-0">
          <span className="text-xs lg:text-sm font-black uppercase tracking-widest text-[#123829]">
            REFERÊNCIA ANATÔMICA
          </span>
          <span className="text-xs text-[#648B68] font-bold">
            Ilustração
          </span>
        </div>
        <div className="w-full flex items-center justify-center overflow-hidden rounded-2xl bg-white/80 p-2 border border-[#D5DDD0]/60">
          <img
            src={question.media.src}
            alt={question.media.alt || 'Ilustração anatômica'}
            width={question.media.width || 800}
            height={question.media.height || 600}
            onError={() => setImgError(true)}
            className={`${maxHeightClass} w-auto object-contain rounded-xl transition-all`}
          />
        </div>
        {question.media.alt && (
          <span className="text-xs lg:text-sm text-[#526B59] font-medium text-center mt-1.5 truncate max-w-full px-2 shrink-0">
            {question.media.alt}
          </span>
        )}
      </div>
    );
  };

  const renderAlternatives = (cols: 1 | 2 = 2) => (
    <div
      className={`grid grid-cols-1 ${
        cols === 2 ? 'md:grid-cols-2' : ''
      } gap-4 lg:gap-6 w-full`}
    >
      {question.options.map((option, index) => {
        const theme = OPTION_THEMES[index % OPTION_THEMES.length];
        const letter = OPTION_LETTERS[index] || (index + 1);
        const isLong = option.label.length > 60;

        return (
          <div
            key={option.id}
            className={`bg-white border-2 border-[#E2DDD2] p-4 sm:p-5 lg:p-6 rounded-3xl shadow-sm flex items-center gap-4 lg:gap-5 min-h-[88px] lg:min-h-[105px] border-l-[8px] ${theme.borderAccent}`}
          >
            <div
              className={`w-12 h-12 lg:w-16 lg:h-16 rounded-2xl ${theme.letterBg} text-white flex items-center justify-center font-black text-2xl lg:text-3xl shrink-0 shadow-xs`}
            >
              {letter}
            </div>
            <span
              className={`${
                isLong
                  ? 'text-lg lg:text-xl 2xl:text-2xl'
                  : 'text-xl lg:text-2xl xl:text-3xl'
              } font-bold text-[#122017] leading-snug`}
            >
              {option.label}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full text-[#122017] p-6 md:p-8 lg:p-10 max-w-7xl 2xl:max-w-[1760px] mx-auto w-full select-none justify-between relative z-10 animate-fade-in-scale">
      {/* Top Header Bar: Question badge, answered count, timer */}
      <header className="flex justify-between items-center mb-4 shrink-0">
        <div className="flex items-center gap-3">
          {isFinalQuestion ? (
            <span className="text-base sm:text-xl lg:text-2xl font-black text-[#B45309] bg-[#FEF9EE] px-6 py-2 rounded-2xl border-2 border-[#F59E0B] shadow-xs uppercase tracking-wider animate-pulse">
              {`🔥 DESAFIO FINAL (300 PTS) · Questão ${TOTAL_QUESTIONS} de ${TOTAL_QUESTIONS}`}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-xl lg:text-2xl font-black text-[#123829] bg-white px-6 py-2 rounded-2xl border border-[#E2DDD2] shadow-xs">
                {`Questão ${currentQuestionIndex + 1} de ${TOTAL_QUESTIONS}`}
              </span>
              <span className="text-sm sm:text-base lg:text-lg font-bold text-[#648B68] bg-white px-4 py-2 rounded-2xl border border-[#E2DDD2] shadow-xs">
                {`${question.basePoints} pts`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`px-5 py-2.5 rounded-2xl border text-base sm:text-lg lg:text-xl font-bold flex items-center gap-2.5 shadow-xs transition-all ${
              allAnswered
                ? 'bg-[#EAF5EC] border-[#2D8058]/40 text-[#2D8058]'
                : 'bg-white border-[#E2DDD2] text-[#555E57]'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full ${
                allAnswered ? 'bg-[#2D8058]' : 'bg-[#2D8058] animate-pulse'
              }`}
            />
            <span>
              {allAnswered ? (
                <strong className="text-[#2D8058]">
                  {`✓ Todos responderam (${answeredCount}/${activeEligiblePlayers})`}
                </strong>
              ) : (
                <>
                  <strong className="text-[#122017]">{answeredCount}</strong>
                  {` / ${activeEligiblePlayers} responderam`}
                </>
              )}
            </span>
          </div>

          <div
            className={`text-4xl sm:text-5xl lg:text-6xl font-mono font-black px-7 py-2 rounded-2xl border-2 transition-all ${
              timeLeft <= 10 && !isPaused
                ? 'bg-[#EF4444] border-[#DC2626] text-white animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.45)]'
                : isPaused
                ? 'bg-[#FEF9EE] border-[#F59E0B] text-[#B45309]'
                : 'bg-white border-[#E2DDD2] text-[#123829] shadow-xs'
            }`}
          >
            {isPaused ? `⏸ ${timeLeft}s` : `${timeLeft}s`}
          </div>
        </div>
      </header>

      {/* Paused Banner Notification */}
      {isPaused && (
        <div
          role="status"
          className="mb-4 rounded-2xl border-2 border-[#F59E0B] bg-[#FEF9EE] px-8 py-3 text-center text-xl lg:text-2xl font-black text-[#B45309] shadow-md animate-scale-in"
        >
          ⏸ Partida pausada — cronômetro congelado. A rodada será retomada em instantes pelo apresentador.
        </div>
      )}

      {/* All Answered Banner Notification */}
      {allAnswered && !isPaused && (
        <div
          role="status"
          className="mb-4 rounded-2xl border-2 border-[#2D8058]/40 bg-[#EAF5EC] px-8 py-3 text-center text-xl lg:text-2xl font-black text-[#2D8058] shadow-md animate-scale-in"
        >
          ✓ Todos os participantes já responderam! Aguardando revelação do gabarito...
        </div>
      )}

      {/* Main Content Area based on Layout */}
      {isComplementary ? (
        /* Widescreen Complementary Layout (Prompt top, 2-column body: Media Left, Alternatives Right) */
        <main className="flex-1 flex flex-col justify-between my-auto min-h-0 w-full">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl 2xl:text-5xl font-black text-center mb-4 leading-tight max-w-5xl 2xl:max-w-6xl mx-auto">
            {question.prompt}
          </h2>

          <div className="grid grid-cols-12 gap-6 lg:gap-8 items-center my-auto w-full">
            <div className="col-span-12 lg:col-span-5 flex items-center justify-center">
              {renderMediaCard('max-h-[46vh]')}
            </div>

            <div className="col-span-12 lg:col-span-7 flex flex-col justify-center">
              {renderAlternatives(2)}
            </div>
          </div>
        </main>
      ) : isProtagonist ? (
        /* Widescreen Protagonist Layout (Prompt top, Center Hero Media, 2x2 Alternatives below) */
        <main className="flex-1 flex flex-col justify-between my-auto min-h-0 w-full">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl 2xl:text-5xl font-black text-center mb-2 leading-tight max-w-5xl 2xl:max-w-6xl mx-auto">
            {question.prompt}
          </h2>

          <div className="my-auto py-1 flex items-center justify-center">
            {renderMediaCard('max-h-[36vh]')}
          </div>

          <div className="mt-auto mb-2 w-full max-w-6xl 2xl:max-w-7xl mx-auto">
            {renderAlternatives(2)}
          </div>
        </main>
      ) : (
        /* Standard Layout without Media (Centered Large Prompt, 2x2 Alternatives below) */
        <main className="flex-1 flex flex-col justify-between my-auto min-h-0 w-full">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl 2xl:text-6xl font-black text-center leading-tight max-w-5xl 2xl:max-w-6xl mx-auto my-auto py-6">
            {question.prompt}
          </h2>

          <div className="mt-auto mb-4 w-full max-w-6xl 2xl:max-w-7xl mx-auto">
            {renderAlternatives(2)}
          </div>
        </main>
      )}

      {/* Footer Branding */}
      <footer className="text-center mt-2 shrink-0">
        <span className="text-xs lg:text-sm font-bold text-[#648B68] uppercase tracking-wider">
          Batalha Anatômica • Medicina Veterinária
        </span>
      </footer>
    </div>
  );
}

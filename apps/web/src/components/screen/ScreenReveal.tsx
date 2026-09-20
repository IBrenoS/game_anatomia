import { useEffect, useState } from 'react';
import type { PublicQuestion, OptionDistribution } from '@batalha/protocol';
import { soundManager } from '../../lib/sound.js';

interface ScreenRevealProps {
  question: PublicQuestion | null;
  distribution: OptionDistribution[];
  correctOptionId: string | null;
  explanation: string | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function ScreenReveal({
  question,
  distribution,
  correctOptionId,
  explanation,
}: ScreenRevealProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    soundManager.playRevealChime();
  }, []);

  if (!question) {
    return (
      <div className="text-[#555E57] text-center py-24 text-3xl font-black">
        Carregando revelação...
      </div>
    );
  }

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);
  const hasMedia = Boolean(question.media && !imgError);

  const renderMediaCard = (maxHeightClass: string) => {
    if (!hasMedia || !question.media) return null;
    return (
      <div className="bg-[#EBF0E8] border border-[#D5DDD0] rounded-3xl p-3 lg:p-4 flex flex-col items-center justify-center shadow-sm w-full">
        <div className="w-full flex items-center justify-between mb-1.5 px-2 shrink-0">
          <span className="text-xs lg:text-sm font-black uppercase tracking-widest text-[#123829]">
            REFERÊNCIA ANATÔMICA
          </span>
          <span className="text-xs text-[#648B68] font-bold">
            Gabarito Ilustrado
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
      } gap-4 lg:gap-5 w-full`}
    >
      {question.options.map((option, index) => {
        const stat = distribution.find((d) => d.optionId === option.id) || {
          count: 0,
          percentage: 0,
        };
        const isCorrect = option.id === correctOptionId;
        const barWidth = `${Math.max((stat.count / maxCount) * 100, 3)}%`;
        const letter = OPTION_LETTERS[index] || (index + 1);
        const isLong = option.label.length > 60;

        return (
          <div
            key={option.id}
            className={`p-5 lg:p-6 rounded-3xl border-4 relative overflow-hidden flex flex-col justify-between shadow-md transition-all duration-500 ${
              cols === 1 ? 'min-h-[96px] lg:min-h-[110px]' : 'min-h-[130px] lg:min-h-[145px]'
            } ${
              isCorrect
                ? 'border-[#2D8058] scale-[1.02] z-10 ring-4 ring-[#2D8058]/20 bg-[#EAF5EC]'
                : 'border-[#E2DDD2] bg-white/70 opacity-60'
            }`}
          >
            {/* Distribution Bar Fill */}
            <div
              className={`absolute top-0 bottom-0 left-0 -z-10 ${
                isCorrect ? 'bg-[#2D8058]/20' : 'bg-slate-200/50'
              }`}
              style={{ width: barWidth, transition: 'width 0.8s ease-out' }}
            />

            <div className="flex justify-between items-start mb-2 gap-4">
              <div className="flex items-center gap-3.5 lg:gap-4 min-w-0">
                <span
                  className={`w-11 h-11 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center font-black text-xl lg:text-3xl shrink-0 shadow-xs ${
                    isCorrect
                      ? 'bg-[#2D8058] text-white'
                      : 'bg-[#151F2E] text-white'
                  }`}
                >
                  {letter}
                </span>
                <span
                  className={`${
                    isLong
                      ? 'text-lg lg:text-xl 2xl:text-2xl'
                      : 'text-xl lg:text-2xl 2xl:text-3xl'
                  } font-bold leading-snug ${
                    isCorrect ? 'text-[#123829] font-black' : 'text-[#555E57]'
                  }`}
                >
                  {option.label}
                </span>
              </div>

              {isCorrect && (
                <span className="bg-[#2D8058] text-white text-xs lg:text-base px-3.5 py-1.5 rounded-full font-black tracking-wider shadow-sm shrink-0 flex items-center gap-1.5">
                  ✓ CORRETA
                </span>
              )}
            </div>

            <div className="text-right z-10 flex justify-end items-baseline gap-2 mt-auto pt-1">
              <span
                className={`text-3xl lg:text-5xl font-black font-mono ${
                  isCorrect ? 'text-[#123829]' : 'text-[#555E57]'
                }`}
              >
                {stat.count}
              </span>
              <span
                className={`text-base lg:text-xl font-bold ${
                  isCorrect ? 'text-[#2D8058]' : 'text-[#64748B]'
                }`}
              >
                {`(${Math.round(stat.percentage)}%)`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full text-[#122017] p-6 md:p-8 lg:p-10 max-w-7xl 2xl:max-w-[1760px] mx-auto w-full select-none justify-between relative z-10 animate-fade-in-scale">
      {/* Header */}
      <header className="text-center mb-3 lg:mb-5 shrink-0">
        <div className="inline-flex items-center gap-2 px-6 py-1.5 rounded-full bg-[#EAF5EC] border border-[#2D8058]/30 text-[#2D8058] text-sm lg:text-base font-black tracking-widest uppercase mb-2 shadow-xs">
          <span>✓</span>
          <span>Gabarito Oficial da Pergunta</span>
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl 2xl:text-5xl font-black leading-tight max-w-5xl 2xl:max-w-6xl mx-auto">
          {question.prompt}
        </h2>
      </header>

      {/* Main Content Area: with media split or 2x2 grid without media */}
      {hasMedia ? (
        <main className="grid grid-cols-12 gap-6 lg:gap-8 items-center my-auto w-full">
          <div className="col-span-12 lg:col-span-5 flex items-center justify-center">
            {renderMediaCard('max-h-[38vh]')}
          </div>
          <div className="col-span-12 lg:col-span-7 flex flex-col justify-center">
            {renderAlternatives(1)}
          </div>
        </main>
      ) : (
        <main className="max-w-6xl 2xl:max-w-7xl mx-auto w-full my-auto">
          {renderAlternatives(2)}
        </main>
      )}

      {/* Didactic Explanation */}
      {explanation && (
        <footer className="mt-3 lg:mt-5 bg-white p-4 lg:p-6 rounded-3xl border-2 border-[#2D8058]/30 text-center shadow-md max-w-5xl 2xl:max-w-6xl mx-auto w-full shrink-0 animate-scale-in">
          <h3 className="text-sm lg:text-base text-[#2D8058] font-black mb-1 uppercase tracking-wider flex items-center justify-center gap-2">
            <span>💡</span> Explicação Didática
          </h3>
          <p className="text-base lg:text-xl text-[#122017] font-semibold leading-relaxed max-w-4xl mx-auto">
            {explanation}
          </p>
        </footer>
      )}
    </div>
  );
}

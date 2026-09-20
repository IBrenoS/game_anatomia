import type { PublicQuestion, OptionDistribution } from '@batalha/protocol';

interface HostRevealProps {
  question: PublicQuestion | null;
  distribution: OptionDistribution[];
  correctOptionId: string | null;
  explanation: string | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function HostReveal({ question, distribution, correctOptionId, explanation }: HostRevealProps) {
  if (!question) return <div className="text-[#555E57] text-center py-12">Carregando resultado...</div>;

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <div className="flex flex-col h-full text-[#122017] overflow-y-auto max-w-5xl mx-auto w-full p-4 sm:p-6 select-none">
      <div className="text-center mb-4 sm:mb-6">
        <span className="text-xs font-bold uppercase tracking-widest text-[#2D8058] bg-[#EAF5EC] px-3.5 py-1 rounded-full border border-[#2D8058]/30 shadow-xs">
          Gabarito da Rodada
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black mt-2 leading-snug text-[#122017]">{question.prompt}</h2>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full gap-4 sm:gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {question.options.map((option, idx) => {
            const stat = distribution.find(d => d.optionId === option.id) || { count: 0, percentage: 0 };
            const isCorrect = option.id === correctOptionId;
            const barWidth = `${Math.max((stat.count / maxCount) * 100, 2)}%`;

            return (
              <div 
                key={option.id}
                className={`p-4 sm:p-5 rounded-2xl border-2 relative overflow-hidden flex flex-col justify-between shadow-xs transition-all ${
                  isCorrect 
                    ? 'border-[#2D8058] bg-[#EAF5EC]/60 ring-2 ring-[#2D8058]/20' 
                    : 'border-[#E2DDD2] bg-white opacity-85'
                }`}
              >
                <div 
                  className={`absolute top-0 bottom-0 left-0 -z-10 ${isCorrect ? 'bg-[#2D8058]/15' : 'bg-[#C95A34]/10'}`}
                  style={{ width: barWidth, transition: 'width 0.8s ease-out' }}
                />
                
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                      isCorrect ? 'bg-[#2D8058] text-white' : 'bg-[#FAF8F3] text-[#555E57] border border-[#E2DDD2]'
                    }`}>
                      {OPTION_LETTERS[idx] || (idx + 1)}
                    </span>
                    <span className={`text-base sm:text-lg font-bold ${isCorrect ? 'text-[#123829] font-black' : 'text-[#122017]'}`}>
                      {option.label}
                    </span>
                  </div>
                  {isCorrect && (
                    <span className="bg-[#2D8058] text-white text-[11px] px-2.5 py-0.5 rounded-full font-black tracking-wide shrink-0">
                      CORRETA
                    </span>
                  )}
                </div>
                
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-[#122017]">{stat.count}</span>
                  <span className="text-xs sm:text-sm text-[#555E57] ml-1 font-semibold">({Math.round(stat.percentage)}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        {explanation && (
          <div className="mt-2 bg-white p-4 sm:p-5 rounded-2xl border border-[#E2DDD2] shadow-xs">
            <h3 className="text-[#648B68] font-black text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>💡</span> Explicação Didática
            </h3>
            <p className="text-sm sm:text-base text-[#122017] leading-relaxed">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

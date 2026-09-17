import type { PublicQuestion, OptionDistribution } from '@batalha/protocol';

interface ScreenRevealProps {
  question: PublicQuestion | null;
  distribution: OptionDistribution[];
  correctOptionId: string | null;
  explanation: string | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [
  'bg-blue-600',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-purple-600'
];

export default function ScreenReveal({ question, distribution, correctOptionId, explanation }: ScreenRevealProps) {
  if (!question) return <div className="text-white text-center py-24 text-3xl font-bold">Carregando revelação...</div>;

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <div className="flex flex-col h-full text-white p-10 max-w-7xl mx-auto w-full select-none justify-between">
      <div className="text-center mb-6">
        <span className="text-base font-bold uppercase tracking-widest text-blue-300 bg-blue-950/70 px-6 py-1.5 rounded-full border border-blue-400/30">
          Gabarito da Pergunta
        </span>
        <h2 className="text-4xl md:text-5xl font-black mt-3 leading-tight drop-shadow-md">
          {question.prompt}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-6 my-auto">
        {question.options.map((option, index) => {
          const stat = distribution.find(d => d.optionId === option.id) || { count: 0, percentage: 0 };
          const isCorrect = option.id === correctOptionId;
          const barWidth = `${Math.max((stat.count / maxCount) * 100, 4)}%`;
          const baseColor = OPTION_COLORS[index % OPTION_COLORS.length];
          const letter = OPTION_LETTERS[index] || (index + 1);

          return (
            <div 
              key={option.id}
              className={`p-6 rounded-3xl border-4 relative overflow-hidden flex flex-col min-h-[130px] justify-between shadow-2xl transition-all duration-500 ${
                isCorrect 
                  ? 'border-green-400 scale-[1.03] z-10 ring-4 ring-green-400/40 bg-green-950/40' 
                  : 'border-white/10 bg-black/25 opacity-70'
              }`}
            >
              <div 
                className={`absolute top-0 bottom-0 left-0 -z-10 ${isCorrect ? 'bg-green-600/40' : baseColor} opacity-50`}
                style={{ width: barWidth, transition: 'width 1s ease-out' }}
              />
              
              <div className="flex justify-between items-start mb-3 gap-3">
                <div className="flex items-center gap-4">
                  <span className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl shrink-0 ${
                    isCorrect ? 'bg-green-400 text-slate-950' : 'bg-black/40 text-white border border-white/20'
                  }`}>
                    {letter}
                  </span>
                  <span className={`text-2xl md:text-3xl font-black ${isCorrect ? 'text-green-200' : 'text-white'}`}>
                    {option.label}
                  </span>
                </div>
                {isCorrect && (
                  <span className="bg-green-400 text-slate-950 text-base px-4 py-1.5 rounded-full font-black tracking-wider shadow-lg shrink-0">
                    ✓ CORRETA
                  </span>
                )}
              </div>
              
              <div className="text-right z-10 flex justify-end items-baseline gap-2">
                <span className="text-5xl font-black font-mono drop-shadow-md">{stat.count}</span>
                <span className="text-xl text-blue-200 font-bold">({Math.round(stat.percentage)}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      {explanation && (
        <div className="mt-6 bg-black/40 p-6 rounded-3xl border-2 border-blue-400/30 text-center shadow-xl">
          <h3 className="text-xl text-yellow-300 font-bold mb-2 uppercase tracking-wider flex items-center justify-center gap-2">
            <span>💡</span> Explicação Didática
          </h3>
          <p className="text-2xl text-blue-100 font-medium leading-relaxed max-w-4xl mx-auto">{explanation}</p>
        </div>
      )}
    </div>
  );
}

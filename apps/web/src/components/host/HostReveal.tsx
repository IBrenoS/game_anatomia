import type { PublicQuestion, OptionDistribution } from '@batalha/protocol';

interface HostRevealProps {
  question: PublicQuestion | null;
  distribution: OptionDistribution[];
  correctOptionId: string | null;
  explanation: string | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function HostReveal({ question, distribution, correctOptionId, explanation }: HostRevealProps) {
  if (!question) return <div className="text-white text-center py-12">Carregando resultado...</div>;

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <div className="flex flex-col h-full text-white overflow-y-auto max-w-5xl mx-auto w-full">
      <div className="text-center mb-6">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-300 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800">
          Gabarito da Rodada
        </span>
        <h2 className="text-2xl md:text-3xl font-black mt-2">{question.prompt}</h2>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {question.options.map((option, idx) => {
            const stat = distribution.find(d => d.optionId === option.id) || { count: 0, percentage: 0 };
            const isCorrect = option.id === correctOptionId;
            const barWidth = `${Math.max((stat.count / maxCount) * 100, 2)}%`;

            return (
              <div 
                key={option.id}
                className={`p-5 rounded-2xl border-2 relative overflow-hidden flex flex-col justify-between shadow-md transition-all ${
                  isCorrect 
                    ? 'border-green-400 bg-green-950/40 ring-2 ring-green-400/30' 
                    : 'border-white/10 bg-white/5 opacity-80'
                }`}
              >
                <div 
                  className={`absolute top-0 bottom-0 left-0 -z-10 ${isCorrect ? 'bg-green-600/30' : 'bg-red-900/20'}`}
                  style={{ width: barWidth, transition: 'width 0.8s ease-out' }}
                />
                
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
                      isCorrect ? 'bg-green-500 text-slate-900' : 'bg-white/20 text-white'
                    }`}>
                      {OPTION_LETTERS[idx] || (idx + 1)}
                    </span>
                    <span className={`text-lg font-bold ${isCorrect ? 'text-green-200 font-black' : 'text-white'}`}>
                      {option.label}
                    </span>
                  </div>
                  {isCorrect && (
                    <span className="bg-green-500 text-slate-950 text-xs px-2 py-0.5 rounded-full font-black tracking-wide shrink-0">
                      CORRETA
                    </span>
                  )}
                </div>
                
                <div className="text-right">
                  <span className="text-3xl font-black font-mono">{stat.count}</span>
                  <span className="text-sm text-blue-200 ml-1 font-semibold">({Math.round(stat.percentage)}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        {explanation && (
          <div className="mt-4 bg-blue-950/70 p-5 rounded-2xl border border-blue-400/30 shadow-lg">
            <h3 className="text-yellow-300 font-bold text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>💡</span> Explicação Didática
            </h3>
            <p className="text-base text-blue-100 leading-relaxed">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

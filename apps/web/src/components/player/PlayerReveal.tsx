import type { PersonalResult } from '@batalha/protocol';

interface PlayerRevealProps {
  result: PersonalResult | null;
  correctOptionId: string | null;
}

export default function PlayerReveal({ result }: PlayerRevealProps) {
  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center max-w-sm mx-auto">
        <div className="w-20 h-20 bg-amber-600/30 rounded-full flex items-center justify-center mb-4 text-4xl border border-amber-400/40">
          ⏱
        </div>
        <h2 className="text-3xl font-black mb-2 text-yellow-300">Tempo Esgotado!</h2>
        <p className="text-base text-blue-200">
          Você não enviou uma resposta a tempo nesta rodada.
        </p>
        <p className="text-xs text-blue-300/70 mt-6">
          Observe a explicação e o gabarito no telão principal.
        </p>
      </div>
    );
  }

  const { correct, awardedPoints, responseTimeMs } = result;
  const hadBonus = correct && responseTimeMs <= 10000;

  return (
    <div className={`flex-1 flex flex-col items-center justify-center text-white p-6 max-w-sm mx-auto w-full rounded-3xl text-center shadow-2xl border ${
      correct ? 'bg-green-950/60 border-green-500/40' : 'bg-red-950/60 border-red-500/40'
    }`}>
      <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 shadow-xl ${
        correct ? 'bg-green-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.5)]' : 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]'
      }`}>
        {correct ? '✓' : '✗'}
      </div>
      
      <h2 className="text-3xl md:text-4xl font-black mb-2">
        {correct ? 'Você Acertou!' : 'Resposta Incorreta'}
      </h2>

      {correct ? (
        <div className="mt-4 flex flex-col items-center bg-black/35 p-6 rounded-2xl w-full border border-green-500/20">
          <span className="text-xs uppercase font-bold tracking-widest text-green-300 mb-1">
            Pontos Conquistados
          </span>
          <span className="text-5xl font-mono font-black text-yellow-300">
            +{awardedPoints}
          </span>
          {hadBonus && (
            <span className="text-xs font-bold bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full border border-yellow-500/30 mt-3 flex items-center gap-1">
              ⚡ Bônus de Rapidez (+25%)
            </span>
          )}
          <span className="text-xs text-blue-200 mt-2">
            Tempo: {(responseTimeMs / 1000).toFixed(2)}s
          </span>
        </div>
      ) : (
        <div className="mt-4 bg-black/35 p-6 rounded-2xl w-full border border-red-500/20 text-blue-200 text-sm">
          <p className="font-semibold text-white mb-1">Não foi dessa vez!</p>
          <p>Veja a explicação da alternativa correta no telão.</p>
        </div>
      )}
      
      <div className="mt-8 text-xs text-blue-300/80 font-medium">
        Aguarde o apresentador avançar para a classificação
      </div>
    </div>
  );
}

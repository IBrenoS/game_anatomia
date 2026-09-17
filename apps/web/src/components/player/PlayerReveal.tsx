import { useEffect } from 'react';
import type { PersonalResult, PublicQuestion } from '@batalha/protocol';
import { useGameStore } from '../../stores/gameStore.js';
import { soundManager } from '../../lib/sound.js';

interface PlayerRevealProps {
  result: PersonalResult | null;
  correctOptionId: string | null;
  question?: PublicQuestion | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function PlayerReveal({ result, correctOptionId, question: propQuestion }: PlayerRevealProps) {
  const storeQuestion = useGameStore((s) => s.currentQuestion);
  const personalScore = useGameStore((s) => s.personalScore);

  const question = propQuestion || storeQuestion;
  const correctOption = question?.options?.find(o => o.id === correctOptionId);
  const correctIndex = question?.options?.findIndex(o => o.id === correctOptionId);
  const correctLetter = correctIndex !== undefined && correctIndex >= 0 ? OPTION_LETTERS[correctIndex] : null;

  useEffect(() => {
    soundManager.playRevealChime(result?.correct);
  }, [result]);

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center max-w-sm mx-auto select-none">
        <div className="w-20 h-20 bg-amber-600/30 rounded-full flex items-center justify-center mb-4 text-4xl border border-amber-400/40">
          ⏱
        </div>
        <h2 className="text-3xl font-black mb-2 text-yellow-300">Tempo Esgotado!</h2>
        <p className="text-sm text-blue-200 mb-4">
          Você não enviou uma resposta a tempo nesta rodada.
        </p>

        {correctOption && (
          <div className="w-full bg-black/40 p-4 rounded-2xl border border-white/15 my-3 text-left">
            <span className="text-xs uppercase font-bold tracking-wider text-green-300 block mb-1">
              Gabarito Oficial
            </span>
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-green-500 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
                {correctLetter || '✓'}
              </span>
              <span className="text-sm font-bold text-white leading-snug">
                {correctOption.label}
              </span>
            </div>
          </div>
        )}

        <div className="bg-black/30 px-4 py-2 rounded-xl border border-white/10 mt-2 text-xs text-blue-200">
          Pontuação Acumulada: <strong className="text-yellow-300 font-mono text-sm">{personalScore.totalPoints} pts</strong>
        </div>

        <p className="text-xs text-blue-300/70 mt-6">
          Observe a explicação detalhada no telão principal.
        </p>
      </div>
    );
  }

  const { correct, awardedPoints, responseTimeMs } = result;
  const hadBonus = correct && responseTimeMs <= 10000;

  return (
    <div className={`flex-1 flex flex-col items-center justify-center text-white p-6 max-w-sm mx-auto w-full rounded-3xl text-center shadow-2xl border select-none ${
      correct ? 'bg-green-950/70 border-green-500/40' : 'bg-red-950/70 border-red-500/40'
    }`}>
      {/* Icon Badge */}
      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 shadow-xl ${
        correct ? 'bg-green-500 text-white shadow-[0_0_25px_rgba(34,197,94,0.6)]' : 'bg-red-500 text-white shadow-[0_0_25px_rgba(239,68,68,0.6)]'
      }`}>
        {correct ? '✓' : '✗'}
      </div>
      
      {/* Status Heading */}
      <h2 className="text-2xl sm:text-3xl font-black mb-1">
        {correct ? 'Você Acertou!' : 'Resposta Incorreta'}
      </h2>

      {/* Round Points & Bonus */}
      <div className="mt-3 flex flex-col items-center bg-black/40 p-4 rounded-2xl w-full border border-white/10">
        <span className="text-[11px] uppercase font-bold tracking-widest text-slate-300 mb-0.5">
          Pontos Conquistados na Rodada
        </span>
        <span className="text-4xl font-mono font-black text-yellow-300">
          +{awardedPoints} <span className="text-sm font-sans text-white/80">pts</span>
        </span>
        {hadBonus && (
          <span className="text-xs font-bold bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full border border-yellow-500/40 mt-2 flex items-center gap-1">
            ⚡ Bônus de Rapidez (+25%)
          </span>
        )}
        <span className="text-xs text-blue-200 mt-1">
          Tempo de Resposta: {(responseTimeMs / 1000).toFixed(2)}s
        </span>
      </div>

      {/* Correct Alternative Display */}
      {correctOption && (
        <div className="w-full bg-black/40 p-3.5 rounded-2xl border border-green-500/30 my-3 text-left">
          <span className="text-[11px] uppercase font-bold tracking-wider text-green-300 block mb-1">
            Gabarito Oficial
          </span>
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-green-400 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
              {correctLetter || '✓'}
            </span>
            <span className="text-sm font-bold text-white leading-snug">
              {correctOption.label}
            </span>
          </div>
        </div>
      )}

      {/* Cumulative Score */}
      <div className="w-full bg-blue-950/60 p-3 rounded-2xl border border-blue-400/30 flex justify-between items-center px-4">
        <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
          Pontuação Acumulada
        </span>
        <span className="text-lg font-mono font-black text-yellow-300">
          {personalScore.totalPoints} pts
        </span>
      </div>
      
      <div className="mt-4 text-xs text-blue-300/80 font-medium">
        Aguarde o apresentador avançar para a classificação
      </div>
    </div>
  );
}

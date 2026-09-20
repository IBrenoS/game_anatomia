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

export default function PlayerReveal({
  result,
  correctOptionId,
  question: propQuestion,
}: PlayerRevealProps) {
  const storeQuestion = useGameStore((s) => s.currentQuestion);
  const personalScore = useGameStore((s) => s.personalScore);

  const question = propQuestion || storeQuestion;
  const correctOption = question?.options?.find((o) => o.id === correctOptionId);
  const correctIndex = question?.options?.findIndex((o) => o.id === correctOptionId);
  const correctLetter =
    correctIndex !== undefined && correctIndex >= 0 ? OPTION_LETTERS[correctIndex] : null;

  useEffect(() => {
    soundManager.playRevealChime(result?.correct);
  }, [result]);

  const basePoints = question?.basePoints || 100;
  const totalPoints = personalScore.totalPoints;

  // P10: Timeout / No answer sent
  if (!result || !result.selectedOptionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 select-none w-full max-w-2xl mx-auto text-center animate-scale-in">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-4">
          <span className="text-[11px] sm:text-xs font-black tracking-widest text-[#123829] uppercase">
            BATALHA ANATÔMICA
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#648B68] uppercase">
            BOVINO <span className="text-[#D05F36]">×</span> EQUINO
          </span>
        </div>

        {/* Amber Clock Icon */}
        <div className="w-16 h-16 rounded-full bg-[#C47A2C] text-white flex items-center justify-center text-3xl shadow-lg shadow-[#C47A2C]/25 mb-3 animate-scale-in">
          ⏱
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBEBE8] border border-[#D05F36]/30 text-[#C95A34] text-[11px] font-black tracking-wider uppercase mb-3 shadow-xs">
          Tempo Esgotado
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-1">
          O tempo acabou.
        </h1>
        <p className="text-xs sm:text-sm text-[#555E57] font-medium mb-1">
          Você não enviou uma alternativa nesta rodada.
        </p>
        <p className="text-xs text-[#8C4328] font-bold mb-6">
          Sem resposta nesta rodada.
        </p>

        {/* Correct Answer Display */}
        {correctOption && (
          <div className="w-full max-w-md bg-white border-2 border-[#2D8058] rounded-2xl p-3.5 sm:p-4 my-2 text-left shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-[#2D8058] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                {correctLetter || '✓'}
              </span>
              <span className="text-sm sm:text-base font-bold text-[#122017] leading-snug flex-1">
                {correctOption.label}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2DDD2] flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#2D8058] bg-[#EAF5EC] px-2 py-0.5 rounded-full border border-[#2D8058]/30">
                GABARITO OFICIAL
              </span>
              <span className="text-[11px] text-[#64748B] font-medium">
                Revise antes da classificação
              </span>
            </div>
          </div>
        )}

        {/* Cumulative Score */}
        <div className="w-full max-w-md bg-white border border-[#E2DDD2] rounded-2xl p-3.5 sm:p-4 mt-3 flex justify-between items-center px-5 shadow-xs">
          <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Pontuação acumulada
          </span>
          <span className="text-lg sm:text-xl font-mono font-black text-[#122017]">
            {totalPoints} pts
          </span>
        </div>

        {/* Footer note */}
        <p className="text-xs text-[#64748B] mt-6 font-semibold">
          Veja como ficou o ranking
        </p>
      </div>
    );
  }

  const { correct, awardedPoints, responseTimeMs } = result;
  const hasSpeedBonus = correct && (responseTimeMs <= 10000 || awardedPoints > basePoints);
  const bonusPoints = Math.max(0, awardedPoints - basePoints);
  const responseTimeSec = (responseTimeMs / 1000).toFixed(2);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 select-none w-full max-w-2xl mx-auto text-center animate-scale-in">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-4">
          <span className="text-[11px] sm:text-xs font-black tracking-widest text-[#123829] uppercase">
            BATALHA ANATÔMICA
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#648B68] uppercase">
            BOVINO <span className="text-[#D05F36]">×</span> EQUINO
          </span>
        </div>

        {correct ? (
          hasSpeedBonus ? (
            /* P08: Resposta Correta + Bônus de Rapidez */
            <>
              {/* Badge Icon with speed radiance */}
              <div className="relative my-2">
                <div className="w-16 h-16 rounded-full bg-[#123829] text-white flex items-center justify-center text-3xl shadow-xl shadow-[#123829]/30 relative z-10 animate-check-pop">
                  ✓
                </div>
                {/* Golden ambient glow */}
                <div className="absolute inset-0 rounded-full bg-[#F59E0B]/30 blur-xl animate-gold-glow pointer-events-none" />
              </div>

              {/* Title & Time */}
              <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mt-2 mb-0.5">
                Resposta certeira.
              </h1>
              <p className="text-xs sm:text-sm font-black text-[#D48B28] mb-6 flex items-center justify-center gap-1.5">
                <span className="text-[#123829] font-black">Você acertou!</span>
                <span>{`Você respondeu em ${responseTimeSec}s`}</span>
              </p>

              {/* Points Card with breakdown and horizontal speed lines */}
              <div className="relative w-full max-w-md my-2">
                {/* Horizontal speed lines decoration */}
                <div className="absolute -left-4 -right-4 top-1/2 -translate-y-1/2 h-16 pointer-events-none flex flex-col justify-between opacity-30 animate-speed-lines">
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
                </div>

                <div className="bg-white border border-[#E2DDD2] rounded-2xl p-4 sm:p-5 shadow-md relative z-10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] uppercase font-black tracking-wider text-[#64748B]">
                      PONTOS DA RODADA
                    </span>
                    <span className="text-[11px] font-black text-[#B45309] bg-[#FEF9EE] border border-[#F59E0B]/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      BÔNUS DE VELOCIDADE +25%
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline mt-2">
                    <div className="text-4xl sm:text-5xl font-black font-mono text-[#122017]">
                      {`+${awardedPoints}`}
                    </div>
                    <div className="text-xs sm:text-sm font-black text-[#64748B]">
                      Pontuação acumulada: {`TOTAL ${totalPoints} pts`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Speed bonus callout pill */}
              <div className="w-full max-w-md bg-[#FEF9EE] border border-[#F59E0B]/60 text-[#B45309] rounded-2xl py-2.5 px-4 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs my-2 animate-gold-glow">
                <span>{`⚡ +${bonusPoints > 0 ? bonusPoints : Math.round(basePoints * 0.25)} pts por velocidade`}</span>
              </div>

              {/* Correct Option Display */}
              {correctOption && (
                <div className="w-full max-w-md bg-white border-2 border-[#2D8058] rounded-2xl p-3 sm:p-3.5 my-1.5 flex items-center gap-3 text-left shadow-xs">
                  <span className="w-7 h-7 rounded-xl bg-[#2D8058] text-white font-black text-xs flex items-center justify-center shrink-0">
                    {correctLetter || '✓'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#122017] leading-snug flex-1">
                    {correctOption.label}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* P07: Resposta Correta (Normal) */
            <>
              {/* Green Checkmark Badge */}
              <div className="w-16 h-16 rounded-full bg-[#123829] text-white flex items-center justify-center text-3xl shadow-xl shadow-[#123829]/25 mb-3 animate-check-pop">
                ✓
              </div>

              {/* Title & Subtitle */}
              <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-0.5">
                Você acertou.
              </h1>
              <p className="text-xs sm:text-sm font-bold text-[#2D8058] mb-6">
                Boa leitura anatômica.
              </p>

              {/* Points Card */}
              <div className="w-full max-w-md bg-white border border-[#E2DDD2] rounded-2xl p-4 sm:p-5 shadow-xs my-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] uppercase font-black tracking-wider text-[#64748B]">
                    PONTOS DA RODADA
                  </span>
                  <span className="text-xs sm:text-sm font-black text-[#64748B]">
                    Pontuação acumulada: {`TOTAL ${totalPoints} pts`}
                  </span>
                </div>

                <div className="text-left text-4xl sm:text-5xl font-black font-mono text-[#122017] mt-2">
                  {`+${awardedPoints}`}
                </div>
              </div>

              {/* Correct Option Card */}
              {correctOption && (
                <div className="w-full max-w-md bg-white border-2 border-[#2D8058] rounded-2xl p-3 sm:p-3.5 my-2 flex items-center gap-3 text-left shadow-xs">
                  <span className="w-7 h-7 rounded-xl bg-[#2D8058] text-white font-black text-xs flex items-center justify-center shrink-0">
                    {correctLetter || '✓'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#122017] leading-snug flex-1">
                    {correctOption.label}
                  </span>
                </div>
              )}
            </>
          )
        ) : (
          /* P09: Resposta Incorreta */
          <>
            {/* Terracotta Cross Badge */}
            <div className="w-16 h-16 rounded-full bg-[#C95A34] text-white flex items-center justify-center text-3xl shadow-xl shadow-[#C95A34]/30 mb-3 animate-scale-in">
              ✗
            </div>

            {/* Section Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBEBE8] border border-[#D05F36]/30 text-[#C95A34] text-[11px] font-black tracking-wider uppercase mb-3 shadow-xs">
              Resposta Incorreta
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-0.5">
              Não foi dessa vez.
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#8C4328] mb-6">
              Confira a resposta correta e siga para a próxima.
            </p>

            {/* Points Card */}
            <div className="w-full max-w-md bg-white border border-[#E2DDD2] rounded-2xl p-4 sm:p-5 shadow-xs my-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] uppercase font-black tracking-wider text-[#64748B]">
                  PONTOS DA RODADA
                </span>
                <span className="text-xs sm:text-sm font-black text-[#64748B]">
                  Pontuação acumulada: TOTAL <span className="font-mono text-[#122017]">{totalPoints} pts</span>
                </span>
              </div>

              <div className="text-left text-4xl sm:text-5xl font-black font-mono text-[#122017] mt-2">
                +0
              </div>
            </div>

            {/* Correct Option Card */}
            {correctOption && (
              <div className="w-full max-w-md bg-white border-2 border-[#2D8058] rounded-2xl p-3.5 sm:p-4 my-2 text-left shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#2D8058] text-white font-black text-xs flex items-center justify-center shrink-0">
                    {correctLetter || '✓'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#122017] leading-snug flex-1">
                    {correctOption.label}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-[#E2DDD2] flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-black tracking-wider text-[#2D8058] bg-[#EAF5EC] px-2 py-0.5 rounded-full border border-[#2D8058]/30">
                    RESPOSTA CORRETA
                  </span>
                  <span className="text-[11px] text-[#64748B] font-medium">
                    Revise o gabarito antes do ranking
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer Guidance */}
        <p className="text-xs text-[#64748B] mt-6 font-semibold">
          Veja como ficou o ranking
        </p>
      </div>
    );
  }

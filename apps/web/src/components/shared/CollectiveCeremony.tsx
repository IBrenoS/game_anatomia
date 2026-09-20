import React, { useState, useEffect, useRef } from 'react';
import type { RankingEntry } from '@batalha/protocol';
import { soundManager } from '../../lib/sound.js';

export type CeremonyPhase = 'prep' | 'third' | 'second' | 'first' | 'podium' | 'champion' | 'thanks';

export interface CollectiveCeremonyProps {
  podium: RankingEntry[];
  mode: 'host' | 'screen';
  initialStep?: number;
  initialPhase?: CeremonyPhase;
  phaseStartedAt?: number | null;
  roomState?: string | null;
  onNewGame?: () => void;
  onExit?: () => void;
}

interface ConfettiItem {
  id: number;
  left: string;
  color: string;
  size: string;
  animDuration: string;
  animDelay: string;
}

const CONFETTI_COLORS = ['#D48B28', '#1FD4A7', '#D05F36', '#2D8058', '#F59E0B', '#94A3B8', '#FEF3C7'];

function generateConfetti(count: number): ConfettiItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${(i * (100 / count) + (i % 3) * 1.5).toFixed(1)}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: `${7 + (i % 5) * 2.5}px`,
    animDuration: `${1.6 + (i % 4) * 0.35}s`,
    animDelay: `${(i % 5) * 0.12}s`,
  }));
}

export default function CollectiveCeremony({
  podium,
  mode,
  initialStep,
  initialPhase,
  phaseStartedAt,
  roomState,
  onNewGame,
  onExit,
}: CollectiveCeremonyProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  // Determine initial phase from props or elapsed time
  const getInitialPhase = (): CeremonyPhase => {
    if (initialPhase) return initialPhase;
    if (initialStep !== undefined) {
      if (initialStep === 0) return 'prep';
      if (initialStep === 1) return 'third';
      if (initialStep === 2) return 'second';
      return 'podium';
    }
    if (roomState === 'FINISHED' && !phaseStartedAt) return 'thanks';
    if (!phaseStartedAt) return 'prep';
    const elapsed = Math.max(0, Date.now() - phaseStartedAt);
    const count = podium.length;

    if (count <= 1) {
      if (elapsed < 1200) return 'prep';
      if (elapsed < 3700) return 'first';
      if (elapsed < 6200) return 'podium';
      if (elapsed < 10000) return 'champion';
      return 'thanks';
    }

    if (count === 2) {
      if (elapsed < 1200) return 'prep';
      if (elapsed < 3200) return 'second';
      if (elapsed < 5700) return 'first';
      if (elapsed < 8200) return 'podium';
      if (elapsed < 12000) return 'champion';
      return 'thanks';
    }

    // 3+ players
    if (elapsed < 1200) return 'prep';
    if (elapsed < 3000) return 'third';
    if (elapsed < 4800) return 'second';
    if (elapsed < 7000) return 'first';
    if (elapsed < 9500) return 'podium';
    if (elapsed < 13000) return 'champion';
    return 'thanks';
  };

  const [phase, setPhase] = useState<CeremonyPhase>(getInitialPhase);
  const playedCuesRef = useRef<Set<string>>(new Set());

  // Keep phase synchronized when initialPhase prop changes
  useEffect(() => {
    if (initialPhase) {
      setPhase(initialPhase);
    }
  }, [initialPhase]);

  useEffect(() => {
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(isReduced);

    if (isReduced) {
      setPhase((prev) => (prev === 'prep' || prev === 'third' || prev === 'second' ? 'podium' : prev));
    }

    if (initialStep !== undefined || initialPhase !== undefined) {
      return;
    }

    const startTime = phaseStartedAt ?? Date.now();
    const elapsed = Math.max(0, Date.now() - startTime);
    const count = podium.length;

    // Suppress past audio cues during reconnect
    if (count <= 1) {
      if (elapsed >= 1200 + 400) playedCuesRef.current.add('first');
      if (elapsed >= 6200 + 400) playedCuesRef.current.add('champion');
    } else if (count === 2) {
      if (elapsed >= 1200 + 400) playedCuesRef.current.add('second');
      if (elapsed >= 3200 + 400) playedCuesRef.current.add('first');
      if (elapsed >= 8200 + 400) playedCuesRef.current.add('champion');
    } else {
      if (elapsed >= 1200 + 400) playedCuesRef.current.add('third');
      if (elapsed >= 3000 + 400) playedCuesRef.current.add('second');
      if (elapsed >= 4800 + 400) playedCuesRef.current.add('first');
      if (elapsed >= 9500 + 400) playedCuesRef.current.add('champion');
    }

    const timers: NodeJS.Timeout[] = [];

    const schedule = (targetMs: number, nextPhase: CeremonyPhase, soundCue?: () => void, cueId?: string) => {
      const delay = targetMs - elapsed;
      if (delay <= 0) {
        return;
      }
      const timer = setTimeout(() => {
        setPhase(nextPhase);
        if (soundCue && cueId && !playedCuesRef.current.has(cueId)) {
          playedCuesRef.current.add(cueId);
          soundCue();
        }
      }, delay);
      timers.push(timer);
    };

    if (count <= 1) {
      schedule(1200, 'first', () => soundManager.playGoldCue(), 'first');
      schedule(3700, 'podium');
      schedule(6200, 'champion', () => soundManager.playChampionClimax(), 'champion');
      schedule(10000, 'thanks');
    } else if (count === 2) {
      schedule(1200, 'second', () => soundManager.playSilverCue(), 'second');
      schedule(3200, 'first', () => soundManager.playGoldCue(), 'first');
      schedule(5700, 'podium');
      schedule(8200, 'champion', () => soundManager.playChampionClimax(), 'champion');
      schedule(12000, 'thanks');
    } else {
      schedule(1200, 'third', () => soundManager.playBronzeCue(), 'third');
      schedule(3000, 'second', () => soundManager.playSilverCue(), 'second');
      schedule(4800, 'first', () => soundManager.playGoldCue(), 'first');
      schedule(7000, 'podium');
      schedule(9500, 'champion', () => soundManager.playChampionClimax(), 'champion');
      schedule(13000, 'thanks');
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [podium.length, phaseStartedAt, initialStep, initialPhase]);

  // Audio trigger on immediate phase render if cue hasn't played and is within 400ms
  useEffect(() => {
    if (reducedMotion) return;
    if (phase === 'third' && !playedCuesRef.current.has('third')) {
      playedCuesRef.current.add('third');
      soundManager.playBronzeCue();
    } else if (phase === 'second' && !playedCuesRef.current.has('second')) {
      playedCuesRef.current.add('second');
      soundManager.playSilverCue();
    } else if (phase === 'first' && !playedCuesRef.current.has('first')) {
      playedCuesRef.current.add('first');
      soundManager.playGoldCue();
    } else if (phase === 'champion' && !playedCuesRef.current.has('champion')) {
      playedCuesRef.current.add('champion');
      soundManager.playChampionClimax();
    }
  }, [phase, reducedMotion]);

  // ─────────────────────────────────────────────────────────────
  // 1. AGRADECIMENTO / ENCERRAMENTO (Phase 'thanks')
  // ─────────────────────────────────────────────────────────────
  if (phase === 'thanks') {
    return (
      <div className="flex-1 flex flex-col justify-between items-center text-center p-6 md:p-10 lg:p-12 select-none w-full max-w-5xl 2xl:max-w-6xl mx-auto animate-fade-in-scale">
        <header className="flex flex-col items-center mb-4 shrink-0">
          <span className="text-xs sm:text-sm font-black tracking-widest text-[#123829] uppercase mb-1">
            BATALHA ANATÔMICA
          </span>
          <span className="text-[10px] sm:text-xs font-bold tracking-wider text-[#648B68] uppercase">
            BOVINO <span className="text-[#D05F36]">×</span> EQUINO
          </span>
        </header>

        <main className="my-auto flex flex-col items-center justify-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#EAF5EC] border-2 border-[#2D8058]/30 text-[#2D8058] flex items-center justify-center text-4xl sm:text-5xl shadow-md mb-6 animate-scale-in">
            🏁
          </div>

          <div className="inline-flex items-center gap-2 px-6 py-1.5 rounded-full bg-[#EAF5EC] border border-[#2D8058]/30 text-[#2D8058] text-xs sm:text-sm lg:text-base font-black tracking-widest uppercase mb-4 shadow-xs">
            <span>Partida Finalizada</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#122017] tracking-tight mb-4">
            Fim de Jogo!
          </h1>

          <p className="text-xl sm:text-2xl lg:text-3xl text-[#526B59] font-bold max-w-2xl leading-relaxed mb-8">
            Parabéns a todos os participantes pela dedicação e excelente desempenho na arena!
          </p>

          <div className="bg-white border-2 border-[#E2DDD2] rounded-3xl p-6 lg:p-8 max-w-xl w-full shadow-md text-center mb-8">
            <span className="text-xs sm:text-sm uppercase font-black tracking-widest text-[#123829] block mb-2">
              Medicina Veterinária • Anatomia Comparada
            </span>
            <p className="text-sm sm:text-base text-[#555E57] font-medium leading-normal">
              {mode === 'host'
                ? 'A batalha foi concluída com sucesso. Você pode iniciar uma nova partida ou voltar ao início.'
                : 'A Batalha Anatômica foi encerrada pelo apresentador. Obrigado pela participação de todos!'}
            </p>
          </div>

          {mode === 'host' ? (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={onNewGame}
                className="px-6 py-3.5 bg-[#123829] hover:bg-[#1B4D3E] font-black text-white rounded-2xl shadow-md transition-all cursor-pointer text-sm sm:text-base"
              >
                Nova Partida
              </button>
              <button
                type="button"
                onClick={onExit}
                className="px-6 py-3.5 bg-white hover:bg-[#F7F5EE] border-2 border-[#E2DDD2] font-black text-[#122017] rounded-2xl shadow-xs transition-all cursor-pointer text-sm sm:text-base"
              >
                Voltar ao Início
              </button>
            </div>
          ) : (
            <div className="bg-[#FAF8F3] border border-[#E2DDD2] px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-[#555E57] shadow-xs">
              Aguarde o apresentador iniciar uma nova batalha.
            </div>
          )}
        </main>

        <footer className="text-center mt-4 shrink-0">
          <span className="text-xs lg:text-sm font-bold text-[#648B68] uppercase tracking-wider">
            Batalha Anatômica • Medicina Veterinária
          </span>
        </footer>
      </div>
    );
  }

  if (!podium || podium.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
        <div className="w-12 h-12 border-4 border-[#D48B28] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-3xl font-black text-[#122017]">Preparando cerimônia do pódio...</h2>
      </div>
    );
  }

  const first = podium.find((p) => p.position === 1) || podium[0];
  const second = podium.find((p) => p.position === 2) || podium[1];
  const third = podium.find((p) => p.position === 3) || podium[2];

  // Reveal conditions based on phase
  const isThirdRevealed =
    reducedMotion ||
    initialStep === 3 ||
    phase === 'third' ||
    phase === 'second' ||
    phase === 'first' ||
    phase === 'podium' ||
    phase === 'champion';

  const isSecondRevealed =
    reducedMotion ||
    initialStep === 3 ||
    (initialStep === 2) ||
    phase === 'second' ||
    phase === 'first' ||
    phase === 'podium' ||
    phase === 'champion';

  const isFirstRevealed =
    reducedMotion ||
    initialStep === 3 ||
    phase === 'first' ||
    phase === 'podium' ||
    phase === 'champion';

  // Confetti intensity calculation
  const confettiCount =
    reducedMotion || phase === 'prep' || phase === 'third' || phase === 'second'
      ? 0
      : phase === 'first'
      ? 16
      : phase === 'podium'
      ? 24
      : phase === 'champion'
      ? 44
      : 0;

  const confettiItems = confettiCount > 0 ? generateConfetti(confettiCount) : [];



  // ─────────────────────────────────────────────────────────────
  // 2. MOMENTO DO CAMPEÃO (Phase 'champion')
  // ─────────────────────────────────────────────────────────────
  if (phase === 'champion') {
    return (
      <div className="relative flex flex-col h-full text-[#122017] p-6 md:p-10 lg:p-12 max-w-7xl 2xl:max-w-[1760px] mx-auto w-full justify-between select-none overflow-hidden animate-fade-in-scale">
        <style>{`
          @keyframes confettiDrop {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(640px) rotate(720deg); opacity: 0; }
          }
        `}</style>

        {/* Climax Confetti Burst */}
        {confettiItems.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-30" aria-hidden="true">
            {confettiItems.map((item) => (
              <div
                key={item.id}
                className="absolute rounded-xs shadow-xs"
                style={{
                  left: item.left,
                  top: '-10px',
                  width: item.size,
                  height: item.size,
                  backgroundColor: item.color,
                  animation: `confettiDrop ${item.animDuration} ease-out ${item.animDelay} infinite`,
                }}
              />
            ))}
          </div>
        )}

        <header className="text-center mb-2 shrink-0">
          <span className="text-xs sm:text-sm lg:text-base font-black uppercase tracking-widest text-[#B45309] bg-[#FEF9EE] px-6 py-1.5 rounded-full border border-[#F59E0B]/50 shadow-xs">
            Cerimônia Oficial dos Campeões
          </span>
        </header>

        {/* Centerpiece: Champion Spotlight */}
        <main className="my-auto flex flex-col items-center justify-center text-center relative z-10">
          {/* Subtle warm golden ambient radial halo */}
          <div
            className="absolute w-96 h-96 sm:w-[500px] sm:h-[500px] rounded-full bg-gradient-to-tr from-amber-400/20 via-yellow-500/15 to-transparent blur-3xl pointer-events-none -z-10"
            aria-hidden="true"
          />

          {/* Troféu Dourado com Glow Controlado */}
          <div className="text-6xl sm:text-8xl lg:text-9xl mb-3 select-none filter drop-shadow-[0_12px_28px_rgba(212,139,40,0.45)] animate-scale-in">
            🏆
          </div>

          <div className="inline-block bg-[#FEF3C7] text-amber-950 px-6 py-1 rounded-full font-black text-xs sm:text-sm lg:text-base tracking-wider uppercase mb-3 shadow-xs border border-[#F59E0B]/40">
            1º Lugar · Grande Campeão da Arena
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-[#122017] tracking-tight mb-3 truncate max-w-4xl px-4">
            {first.nickname}
          </h1>

          <div className="inline-flex items-center gap-2 bg-[#FEF9EE] border-2 border-[#F59E0B] px-8 py-2 sm:px-10 sm:py-3 rounded-2xl shadow-sm text-2xl sm:text-4xl font-mono font-black text-[#B45309] mb-5">
            <span>{`${first.totalPoints} pts`}</span>
          </div>

          <div className="bg-white/90 backdrop-blur-xs border-2 border-[#E2DDD2] rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-md text-center">
            <span className="text-xs sm:text-sm uppercase font-black tracking-widest text-[#123829] block mb-1.5">
              Consagração na Anatomia Veterinária
            </span>
            <p className="text-sm sm:text-base text-[#555E57] font-medium leading-relaxed">
              Desempenho extraordinário e velocidade com precisão científica na Batalha Anatômica!
            </p>
          </div>
        </main>

        <footer className="text-center text-[#526B59] text-sm sm:text-base lg:text-lg font-bold mt-3 shrink-0">
          Parabéns ao grande campeão da batalha!
        </footer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. PÓDIO PROGRESSIVO & CONSOLIDADO (Phases 'prep', 'third', 'second', 'first', 'podium')
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col h-full text-[#122017] p-6 md:p-10 lg:p-12 max-w-7xl 2xl:max-w-[1760px] mx-auto w-full justify-between select-none overflow-hidden animate-fade-in-scale">
      <style>{`
        @keyframes podiumSlideUp {
          from {
            opacity: 0;
            transform: translateY(80px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes confettiDrop {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(600px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Confetti particles */}
      {confettiItems.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30" aria-hidden="true">
          {confettiItems.map((item) => (
            <div
              key={item.id}
              className="absolute rounded-xs shadow-xs"
              style={{
                left: item.left,
                top: '-10px',
                width: item.size,
                height: item.size,
                backgroundColor: item.color,
                animation: `confettiDrop ${item.animDuration} ease-out ${item.animDelay} infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <header className="text-center mb-4 lg:mb-6 z-10 shrink-0">
        <span className="text-sm sm:text-base lg:text-lg font-black uppercase tracking-widest text-[#B45309] bg-[#FEF9EE] px-8 py-2 rounded-full border border-[#F59E0B]/50 shadow-xs">
          Cerimônia Oficial de Encerramento
        </span>
        <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black mt-3 text-[#122017] tracking-tight">
          🏆 PÓDIO DOS CAMPEÕES
        </h2>
      </header>

      {/* Adaptive Podium Structure */}
      <main className="flex-1 flex items-end justify-center my-auto z-10 w-full min-h-0">
        {podium.length === 1 ? (
          /* Solo Champion Podium */
          <div className="flex items-end justify-center h-[420px] sm:h-[480px] lg:h-[520px] w-full max-w-md 2xl:max-w-lg mx-auto">
            <div className="flex flex-col items-center w-full z-20 min-h-[380px] justify-end">
              {first && isFirstRevealed ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.8s_ease-out_both]' : ''}`}>
                  <div className="text-5xl sm:text-6xl mb-1 animate-bounce motion-reduce:animate-none">
                    🏆
                  </div>
                  <div className="text-3xl sm:text-5xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {first.nickname}
                  </div>
                  <div className="text-xl sm:text-3xl font-mono font-black mb-3 bg-[#FEF9EE] px-6 py-2 rounded-full border-2 border-[#F59E0B] shadow-xs text-[#B45309]">
                    {`${first.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#F59E0B] via-[#D48B28] to-[#92400E] h-72 sm:h-80 lg:h-96 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-[0_0_50px_rgba(212,139,40,0.35)] border-t-8 border-[#FEF3C7] ring-4 ring-[#F59E0B]/30">
                    <span className="text-7xl sm:text-9xl font-black text-amber-950/85 leading-none">1º</span>
                    <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-950 bg-[#FEF3C7] px-4 py-1 rounded-full mt-3 shadow-xs">
                      Campeão
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-72 sm:h-80 lg:h-96 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-2xl">...</span>
                </div>
              )}
            </div>
          </div>
        ) : podium.length === 2 ? (
          /* 2 Players Podium: 2nd (Silver Medal) - 1st (Gold Trophy) */
          <div className="flex items-end justify-center gap-6 sm:gap-8 h-[420px] sm:h-[480px] lg:h-[520px] w-full max-w-3xl 2xl:max-w-4xl mx-auto">
            {/* 2nd Place (Silver Medal) */}
            <div className="flex flex-col items-center w-1/2 z-10 min-h-[320px] justify-end">
              {second && isSecondRevealed ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.7s_ease-out_both]' : ''}`}>
                  <div className="text-4xl sm:text-5xl mb-1">
                    🥈
                  </div>
                  <div className="text-2xl sm:text-4xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {second.nickname}
                  </div>
                  <div className="text-lg sm:text-2xl font-mono font-bold mb-3 bg-white px-5 py-1.5 rounded-full border border-slate-300 text-[#122017] shadow-xs">
                    {`${second.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 h-52 sm:h-60 lg:h-64 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-md border-t-8 border-white">
                    <span className="text-5xl sm:text-7xl font-black text-slate-800 leading-none">2º</span>
                    <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-700 bg-white/80 px-3 py-0.5 rounded-full mt-2 shadow-xs">
                      Vice-Campeão
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-52 sm:h-60 lg:h-64 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-xl">...</span>
                </div>
              )}
            </div>

            {/* 1st Place (Gold Champion Trophy) */}
            <div className="flex flex-col items-center w-1/2 z-20 min-h-[380px] justify-end">
              {first && isFirstRevealed ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.8s_ease-out_both]' : ''}`}>
                  <div className="text-5xl sm:text-6xl mb-1 animate-bounce motion-reduce:animate-none">
                    🏆
                  </div>
                  <div className="text-3xl sm:text-5xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {first.nickname}
                  </div>
                  <div className="text-xl sm:text-3xl font-mono font-black mb-3 bg-[#FEF9EE] px-6 py-2 rounded-full border-2 border-[#F59E0B] shadow-xs text-[#B45309]">
                    {`${first.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#F59E0B] via-[#D48B28] to-[#92400E] h-72 sm:h-80 lg:h-96 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-[0_0_50px_rgba(212,139,40,0.35)] border-t-8 border-[#FEF3C7] ring-4 ring-[#F59E0B]/30">
                    <span className="text-7xl sm:text-9xl font-black text-amber-950/85 leading-none">1º</span>
                    <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-950 bg-[#FEF3C7] px-4 py-1 rounded-full mt-3 shadow-xs">
                      Campeão
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-72 sm:h-80 lg:h-96 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-2xl">...</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 3+ Players Full Podium (2nd Silver Medal - 1st Gold Trophy - 3rd Bronze Medal) */
          <div className="flex items-end justify-center gap-5 sm:gap-6 lg:gap-8 h-[420px] sm:h-[480px] lg:h-[520px] w-full max-w-5xl 2xl:max-w-6xl mx-auto">
            {/* 2nd Place (Silver Medal) */}
            <div className="flex flex-col items-center w-1/3 z-10 min-h-[320px] justify-end">
              {second && isSecondRevealed ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.7s_ease-out_both]' : ''}`}>
                  <div className="text-4xl sm:text-5xl mb-1">
                    🥈
                  </div>
                  <div className="text-xl sm:text-3xl lg:text-4xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {second.nickname}
                  </div>
                  <div className="text-base sm:text-xl lg:text-2xl font-mono font-bold mb-3 bg-white px-5 py-1.5 rounded-full border border-slate-300 text-[#122017] shadow-xs">
                    {`${second.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 h-52 sm:h-60 lg:h-64 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-md border-t-8 border-white">
                    <span className="text-5xl sm:text-7xl font-black text-slate-800 leading-none">2º</span>
                    <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-700 bg-white/80 px-3 py-0.5 rounded-full mt-2 shadow-xs">
                      Vice-Campeão
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-52 sm:h-60 lg:h-64 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-xl">...</span>
                </div>
              )}
            </div>

            {/* 1st Place (Gold Champion Trophy) */}
            <div className="flex flex-col items-center w-1/3 z-20 min-h-[380px] justify-end">
              {first && isFirstRevealed ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.8s_ease-out_both]' : ''}`}>
                  <div className="text-5xl sm:text-6xl mb-1 animate-bounce motion-reduce:animate-none">
                    🏆
                  </div>
                  <div className="text-2xl sm:text-4xl lg:text-5xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {first.nickname}
                  </div>
                  <div className="text-lg sm:text-2xl lg:text-3xl font-mono font-black mb-3 bg-[#FEF9EE] px-6 py-2 rounded-full border-2 border-[#F59E0B] shadow-xs text-[#B45309]">
                    {`${first.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#F59E0B] via-[#D48B28] to-[#92400E] h-72 sm:h-80 lg:h-96 rounded-t-3xl flex flex-col items-center justify-start pt-6 shadow-[0_0_50px_rgba(212,139,40,0.35)] border-t-8 border-[#FEF3C7] ring-4 ring-[#F59E0B]/30">
                    <span className="text-7xl sm:text-9xl font-black text-amber-950/85 leading-none">1º</span>
                    <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-950 bg-[#FEF3C7] px-4 py-1 rounded-full mt-3 shadow-xs">
                      Campeão
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-72 sm:h-80 lg:h-96 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-2xl">...</span>
                </div>
              )}
            </div>

            {/* 3rd Place (Bronze Medal) */}
            <div className="flex flex-col items-center w-1/3 z-0 min-h-[260px] justify-end">
              {third && isThirdRevealed ? (
                <div className={`w-full flex flex-col items-center ${!reducedMotion ? 'animate-[podiumSlideUp_0.6s_ease-out_both]' : ''}`}>
                  <div className="text-4xl sm:text-5xl mb-1">
                    🥉
                  </div>
                  <div className="text-lg sm:text-2xl lg:text-3xl font-black mb-2 text-[#122017] truncate w-full text-center">
                    {third.nickname}
                  </div>
                  <div className="text-sm sm:text-lg lg:text-xl font-mono font-bold mb-3 bg-white px-4 py-1.5 rounded-full border border-[#D05F36]/40 text-[#D05F36] shadow-xs">
                    {`${third.totalPoints} pts`}
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#E8A588] via-[#D05F36] to-[#A8382B] h-36 sm:h-44 lg:h-48 rounded-t-3xl flex flex-col items-center justify-start pt-5 shadow-md border-t-8 border-[#F5C2AF]">
                    <span className="text-4xl sm:text-6xl font-black text-amber-950/85 leading-none">3º</span>
                    <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-amber-950/80 bg-white/70 px-3 py-0.5 rounded-full mt-2 shadow-xs">
                      3º Colocado
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-36 sm:h-44 lg:h-48 rounded-t-3xl bg-[#EFEFEA] border-t-2 border-[#D5DDD0] flex items-center justify-center">
                  <span className="text-[#8C9B90] font-bold text-lg">...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[#526B59] text-base sm:text-lg lg:text-xl font-bold mt-4 z-10 shrink-0">
        Parabéns a todos os participantes da Batalha Anatômica!
      </footer>
    </div>
  );
}

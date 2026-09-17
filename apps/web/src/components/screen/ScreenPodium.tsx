import type { RankingEntry } from '@batalha/protocol';

interface ScreenPodiumProps {
  podium: RankingEntry[];
}

export default function ScreenPodium({ podium }: ScreenPodiumProps) {
  if (!podium || podium.length === 0) return null;

  const first = podium.find(p => p.position === 1);
  const second = podium.find(p => p.position === 2);
  const third = podium.find(p => p.position === 3);

  return (
    <div className="flex flex-col h-full text-white p-12 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-[#1e3a5f] to-black justify-between select-none">
      <div className="text-center mb-6">
        <span className="text-xl font-bold uppercase tracking-widest text-yellow-300 bg-yellow-950/70 px-8 py-2 rounded-full border border-yellow-500/40">
          Encerramento Oficial
        </span>
        <h2 className="text-7xl font-black mt-4 text-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,0.8)] motion-safe:animate-pulse">
          🏆 PÓDIO DOS CAMPEÕES
        </h2>
      </div>

      <div className="flex items-end justify-center gap-8 h-[520px] w-full max-w-6xl mx-auto my-auto">
        {/* Segundo Lugar */}
        {second && (
          <div className="flex flex-col items-center w-1/3 z-10 motion-safe:animate-[slideUp_1s_ease-out_0.5s_both]">
            <div className="text-4xl font-black mb-3 text-slate-200 truncate w-full text-center drop-shadow-md">
              {second.nickname}
            </div>
            <div className="text-3xl font-mono font-bold mb-4 bg-black/50 px-6 py-2 rounded-full border border-white/20">
              {second.totalPoints} pts
            </div>
            <div className="w-full bg-gradient-to-b from-slate-300 to-slate-500 h-64 rounded-t-3xl flex items-start justify-center pt-6 shadow-[0_0_30px_rgba(156,163,175,0.4)] border-t-8 border-white">
              <span className="text-7xl font-black text-slate-800 drop-shadow-sm">2º</span>
            </div>
          </div>
        )}

        {/* Primeiro Lugar */}
        {first && (
          <div className="flex flex-col items-center w-1/3 z-20 motion-safe:animate-[slideUp_1.4s_ease-out_both]">
            <div className="text-5xl font-black mb-3 text-yellow-300 truncate w-full text-center drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">
              {first.nickname}
            </div>
            <div className="text-4xl font-mono font-black mb-4 bg-yellow-500/20 px-8 py-2.5 rounded-full border-2 border-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.4)]">
              {first.totalPoints} pts
            </div>
            <div className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 h-96 rounded-t-3xl flex items-start justify-center pt-8 shadow-[0_0_50px_rgba(250,204,21,0.6)] border-t-8 border-yellow-200">
              <span className="text-9xl font-black text-yellow-950 drop-shadow-sm">1º</span>
            </div>
          </div>
        )}

        {/* Terceiro Lugar */}
        {third && (
          <div className="flex flex-col items-center w-1/3 z-0 motion-safe:animate-[slideUp_0.8s_ease-out_0.2s_both]">
            <div className="text-3xl font-black mb-3 text-amber-500 truncate w-full text-center drop-shadow-md">
              {third.nickname}
            </div>
            <div className="text-2xl font-mono font-bold mb-4 bg-black/50 px-6 py-2 rounded-full border border-white/20">
              {third.totalPoints} pts
            </div>
            <div className="w-full bg-gradient-to-b from-amber-600 to-amber-800 h-48 rounded-t-3xl flex items-start justify-center pt-5 shadow-[0_0_20px_rgba(217,119,6,0.4)] border-t-8 border-amber-400">
              <span className="text-6xl font-black text-amber-950 drop-shadow-sm">3º</span>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-blue-200 text-xl font-medium mt-4">
        Obrigado por participar da Batalha Anatômica!
      </div>
    </div>
  );
}

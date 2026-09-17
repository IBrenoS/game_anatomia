import type { RankingEntry } from '@batalha/protocol';

interface HostPodiumProps {
  podium: RankingEntry[];
}

export default function HostPodium({ podium }: HostPodiumProps) {
  if (!podium || podium.length === 0) return <div className="text-white text-center py-12">Aguardando definição do pódio...</div>;

  const first = podium.find(p => p.position === 1);
  const second = podium.find(p => p.position === 2);
  const third = podium.find(p => p.position === 3);

  return (
    <div className="flex flex-col h-full text-white items-center justify-center max-w-4xl mx-auto w-full">
      <div className="text-center mb-12">
        <span className="text-sm font-bold uppercase tracking-widest text-yellow-300 bg-yellow-950/60 px-4 py-1.5 rounded-full border border-yellow-500/30">
          Cerimônia Final
        </span>
        <h2 className="text-4xl md:text-5xl font-black mt-3 text-yellow-400 drop-shadow-md">
          🏆 Pódio dos Campeões
        </h2>
      </div>

      <div className="flex items-end justify-center gap-4 h-80 w-full max-w-3xl mx-auto">
        {/* Segundo Lugar */}
        {second && (
          <div className="flex flex-col items-center w-1/3 z-10 motion-safe:animate-[slideUp_0.8s_ease-out_0.2s_both]">
            <div className="text-lg font-bold mb-1 text-slate-300 truncate w-full text-center">{second.nickname}</div>
            <div className="text-sm font-mono font-bold mb-2 text-slate-300 bg-black/40 px-3 py-1 rounded-full">{second.totalPoints} pts</div>
            <div className="w-full bg-gradient-to-b from-slate-300 to-slate-500 h-44 rounded-t-2xl flex items-start justify-center pt-3 shadow-lg border-t-4 border-white">
              <span className="text-4xl font-black text-slate-800">2º</span>
            </div>
          </div>
        )}

        {/* Primeiro Lugar */}
        {first && (
          <div className="flex flex-col items-center w-1/3 z-20 motion-safe:animate-[slideUp_1s_ease-out_both]">
            <div className="text-2xl font-black mb-1 text-yellow-300 truncate w-full text-center">{first.nickname}</div>
            <div className="text-base font-mono font-black mb-2 text-yellow-400 bg-yellow-950/50 px-4 py-1 rounded-full border border-yellow-500/40">{first.totalPoints} pts</div>
            <div className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 h-60 rounded-t-2xl flex items-start justify-center pt-4 shadow-2xl border-t-4 border-yellow-200">
              <span className="text-5xl font-black text-yellow-950">1º</span>
            </div>
          </div>
        )}

        {/* Terceiro Lugar */}
        {third && (
          <div className="flex flex-col items-center w-1/3 z-0 motion-safe:animate-[slideUp_0.6s_ease-out_0.4s_both]">
            <div className="text-base font-bold mb-1 text-amber-500 truncate w-full text-center">{third.nickname}</div>
            <div className="text-xs font-mono font-bold mb-2 text-amber-400 bg-black/40 px-3 py-1 rounded-full">{third.totalPoints} pts</div>
            <div className="w-full bg-gradient-to-b from-amber-600 to-amber-800 h-32 rounded-t-2xl flex items-start justify-center pt-3 shadow border-t-4 border-amber-400">
              <span className="text-3xl font-black text-amber-950">3º</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

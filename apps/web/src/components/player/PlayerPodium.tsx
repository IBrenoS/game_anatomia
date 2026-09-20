import { useEffect } from 'react';
import type { RankingEntry } from '@batalha/protocol';
import { soundManager } from '../../lib/sound.js';

interface PlayerPodiumProps {
  podium: RankingEntry[];
  playerId: string | null;
}

export default function PlayerPodium({ podium, playerId }: PlayerPodiumProps) {
  const isWinner = podium.some((p) => p.playerId === playerId);
  const myEntry = podium.find((p) => p.playerId === playerId);
  const position = myEntry?.position;
  const totalPoints = myEntry?.totalPoints;

  useEffect(() => {
    if (isWinner) {
      soundManager.playFanfare();
    }
  }, [isWinner]);

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

      {/* Section Pill */}
      <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-[#E2DDD2] text-[#123829] text-[11px] sm:text-xs font-black tracking-wider uppercase mb-5 shadow-xs">
        CERIMÔNIA FINAL
      </div>

      {isWinner ? (
        /* P13: Classificado para o pódio */
        <>
          {/* Golden Trophy Icon */}
          <div className="text-6xl sm:text-7xl mb-4 animate-bounce select-none filter drop-shadow-[0_4px_12px_rgba(212,139,40,0.3)]">
            🏆
          </div>

          {/* Title & Subtitle */}
          <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-1">
            Você está no pódio.
          </h1>
          <p className="text-base sm:text-xl font-black text-[#D48B28] mb-1">
            {`${position}º lugar · ${totalPoints} pontos`}
          </p>
          <p className="text-xs sm:text-sm font-bold text-[#2D8058] mb-3">
            Parabéns, você subiu ao pódio!
          </p>
          <p className="text-xs sm:text-sm text-[#555E57] font-medium max-w-md mb-6">
            A revelação final acontece no telão — sua conquista já está garantida.
          </p>

          {/* Preparation Callout Card */}
          <div className="w-full max-w-md bg-[#FEF9EE] border border-[#F59E0B]/50 rounded-2xl p-4 shadow-xs mt-2">
            <span className="text-[11px] uppercase font-black tracking-wider text-[#B45309] block mb-1">
              PREPARE-SE PARA A CELEBRAÇÃO
            </span>
            <p className="text-xs text-[#78350F] font-semibold">
              A celebração final vem a seguir. Sua colocação fica registrada aqui.
            </p>
          </div>
        </>
      ) : (
        /* Participation celebration */
        <>
          <div className="text-5xl sm:text-6xl mb-4 select-none">
            👏
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#122017] tracking-tight mb-2">
            Excelente Participação!
          </h1>
          <p className="text-xs sm:text-sm text-[#555E57] font-medium max-w-md mb-6">
            A Batalha Anatômica foi concluída. Acompanhe os grandes campeões no telão da sala.
          </p>
          <div className="w-full max-w-md bg-white border border-[#E2DDD2] rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-bold text-[#64748B]">
              A revelação dos 3 primeiros colocados está acontecendo agora no telão.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

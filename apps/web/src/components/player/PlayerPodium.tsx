import type { RankingEntry } from '@batalha/protocol';

interface PlayerPodiumProps {
  podium: RankingEntry[];
  playerId: string | null;
}

export default function PlayerPodium({ podium, playerId }: PlayerPodiumProps) {
  const isWinner = podium.some(p => p.playerId === playerId);
  const myEntry = podium.find(p => p.playerId === playerId);
  const position = myEntry?.position;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white text-center px-4 max-w-sm mx-auto">
      {isWinner ? (
        <div className="w-full bg-yellow-500/20 p-8 rounded-3xl border-2 border-yellow-400/50 shadow-2xl backdrop-blur-md">
          <div className="text-7xl mb-4">🏆</div>
          <span className="text-xs uppercase font-bold tracking-widest text-yellow-300">
            Parabéns, Campeão!
          </span>
          <h2 className="text-3xl font-black mt-1 mb-2 text-yellow-300 drop-shadow-md">
            Você subiu ao pódio!
          </h2>
          <p className="text-lg text-blue-100 mb-6">
            Você terminou em <strong className="text-white text-2xl font-black">{position}º lugar</strong> com {myEntry?.totalPoints} pontos!
          </p>
          <p className="text-xs text-blue-200">
            Confira a revelação solene no telão da sala.
          </p>
        </div>
      ) : (
        <div className="w-full bg-black/35 p-8 rounded-3xl border border-white/15 shadow-xl backdrop-blur-md">
          <div className="text-6xl mb-4">👏</div>
          <h2 className="text-2xl font-black mb-2 text-white">Excelente Participação!</h2>
          <p className="text-base text-blue-200 mb-4">
            A Batalha Anatômica foi concluída.
          </p>
          <p className="text-sm text-yellow-300 font-semibold">
            Olhe para o telão para ver os grandes vencedores!
          </p>
        </div>
      )}
    </div>
  );
}

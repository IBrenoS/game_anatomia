interface PlayerLobbyProps {
  nickname: string | null;
}

export default function PlayerLobby({ nickname }: PlayerLobbyProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white text-center select-none">
      <div className="bg-black/35 p-8 rounded-3xl border border-white/15 w-full max-w-sm shadow-2xl backdrop-blur-md flex flex-col items-center">
        <span className="text-xs uppercase tracking-widest text-emerald-300 font-bold bg-emerald-950/60 px-4 py-1.5 rounded-full border border-emerald-500/30 mb-3">
          ✓ Conectado
        </span>
        <h2 className="text-2xl font-bold mb-1 text-white">Você está no jogo!</h2>
        <div className="text-3xl font-black text-yellow-300 mb-8 truncate max-w-full drop-shadow-md">
          {nickname}
        </div>
        
        <div className="flex justify-center mb-6 relative">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
        
        <p className="text-base font-semibold text-blue-100">
          Aguardando o apresentador iniciar...
        </p>
        <p className="text-xs text-blue-300/70 mt-4 font-medium">
          Olhe para o telão
        </p>
      </div>
    </div>
  );
}

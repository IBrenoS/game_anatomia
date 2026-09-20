import QrPanel from './QrPanel.js';
import { useGameStore } from '../../stores/gameStore.js';

interface ScreenLobbyProps {
  players: Array<{ playerId: string; nickname: string; joinedAt: number }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  pin: string;
}

export default function ScreenLobby({ players, presences, pin }: ScreenLobbyProps) {
  const hostUrl = typeof window !== 'undefined' ? `${window.location.host}/join/${pin}` : `sala ${pin}`;
  const totalPlayers = useGameStore((state) => state.totalPlayers);

  return (
    <div className="flex flex-col h-full text-[#FAF7F2] p-6 md:p-10 lg:p-12 max-w-7xl 2xl:max-w-[1760px] mx-auto w-full justify-between select-none relative z-10">
      {/* Brand & Arena Title */}
      <header className="text-center mb-4 lg:mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#123829]/60 border border-[#1FD4A7]/30 text-[#1FD4A7] text-xs lg:text-sm font-black tracking-widest uppercase mb-3 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#1FD4A7] animate-pulse" aria-hidden="true" />
          <span>Arena Pública • Telão</span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-md">
          Batalha Anatômica
        </h1>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-400 font-bold uppercase tracking-wider mt-1">
          BOVINO <span className="text-[#D05F36]">×</span> EQUINO
        </p>
      </header>

      {/* Main Connection Panel */}
      <main className="flex flex-col lg:flex-row justify-center items-center gap-8 lg:gap-14 my-auto w-full">
        {/* Left: URL & Gigantic PIN */}
        <div className="bg-[#0E141E]/90 p-8 lg:p-10 rounded-3xl border border-white/15 backdrop-blur-md flex flex-col items-center text-center shadow-2xl max-w-xl w-full">
          <span className="text-sm lg:text-base font-black uppercase tracking-widest text-slate-400 mb-2">
            Acesse no celular ou navegador
          </span>
          <div className="text-xl md:text-2xl lg:text-3xl font-mono font-black text-[#1FD4A7] mb-8 bg-[#151F2E] px-8 py-3 rounded-2xl border border-[#1FD4A7]/30 shadow-inner break-all">
            {hostUrl}
          </div>

          <span className="text-xs lg:text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
            Ou informe o PIN da Sala
          </span>
          <div className="text-7xl md:text-8xl lg:text-9xl font-mono font-black tracking-widest text-white drop-shadow-[0_0_35px_rgba(31,212,167,0.35)] select-all">
            {pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin}
          </div>
        </div>

        {/* Right: Big QR Code */}
        <div className="shrink-0">
          <QrPanel pin={pin} />
        </div>
      </main>

      {/* Live Lobby Roster */}
      <footer className="mt-6 bg-[#0E141E]/80 p-5 lg:p-6 rounded-3xl border border-white/10 backdrop-blur-sm w-full">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#1FD4A7] animate-pulse motion-reduce:animate-none" />
            <h2 className="text-xl lg:text-2xl font-bold text-white">
              Participantes na Arena
            </h2>
          </div>
          <span className="text-base lg:text-lg font-black bg-[#123829] px-5 py-1 rounded-full border border-[#1FD4A7]/30 text-[#1FD4A7] shadow-xs">
            {totalPlayers} conectados
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 max-h-40 overflow-y-auto pr-2">
          {players.map((player) => {
            const presence = presences.find((p) => p.playerId === player.playerId);
            const isConnected = presence ? presence.connected : false;

            return (
              <div
                key={player.playerId}
                className={`px-4 py-2 rounded-full text-base lg:text-lg font-bold shadow-md transition-all duration-300 flex items-center gap-2.5 animate-scale-in motion-reduce:animate-none ${
                  isConnected
                    ? 'bg-[#151F2E] text-white border border-[#1FD4A7]/30'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/40'
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isConnected
                      ? 'bg-[#1FD4A7] shadow-[0_0_8px_rgba(31,212,167,0.8)] animate-pulse motion-reduce:animate-none'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="truncate max-w-[200px]">{player.nickname}</span>
              </div>
            );
          })}
          {players.length === 0 && (
            <p className="text-base lg:text-lg text-slate-400 italic py-4 text-center w-full">
              Aguardando participantes entrarem... Aponte a câmera para o QR Code acima.
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}

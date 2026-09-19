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
    <div className="flex flex-col h-full text-white p-8 md:p-12 max-w-7xl mx-auto w-full justify-between select-none">
      <style>{`
        @keyframes playerEnter {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      {/* Arena Title */}
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
          🦴 Batalha Anatômica
        </h1>
        <p className="text-xl md:text-2xl text-blue-200 font-medium mt-1">
          Anatomia Comparada — Bovino e Equino
        </p>
      </div>

      {/* Main Connection Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-8 my-auto">
        <div className="bg-black/35 p-8 md:p-10 rounded-3xl border border-white/15 backdrop-blur-md flex flex-col items-center text-center shadow-2xl">
          <span className="text-lg md:text-xl font-bold uppercase tracking-widest text-blue-300 mb-2">
            Acesse no celular ou navegador
          </span>
          <div className="text-2xl md:text-3xl font-mono font-black text-yellow-300 mb-6 bg-blue-950/70 px-6 py-2 rounded-2xl border border-blue-400/30 shadow-inner">
            {hostUrl}
          </div>
          
          <span className="text-sm md:text-base font-bold uppercase tracking-wider text-slate-400 mb-1">
            Ou informe o PIN da Sala
          </span>
          <div className="text-7xl md:text-8xl font-mono font-black tracking-widest text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
            {pin}
          </div>
        </div>
        
        <QrPanel pin={pin} />
      </div>

      {/* Live Lobby Roster */}
      <div className="mt-6 bg-black/25 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
            <h2 className="text-xl md:text-2xl font-bold text-blue-100">
              Participantes na Arena
            </h2>
          </div>
          <span className="text-lg md:text-xl font-black bg-blue-600/50 px-4 py-1 rounded-full border border-blue-400/30 text-yellow-300">
            {totalPlayers} / 50
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 max-h-44 overflow-y-auto pr-2">
          {players.map(player => {
            const presence = presences.find(p => p.playerId === player.playerId);
            const isConnected = presence ? presence.connected : false;
            
            return (
              <div 
                key={player.playerId}
                className={`px-4 py-1.5 rounded-full text-base md:text-lg font-bold shadow-md transition-all duration-300 flex items-center gap-2 animate-[playerEnter_0.35s_ease-out] motion-reduce:animate-none motion-reduce:transition-none ${
                  isConnected 
                    ? 'bg-blue-600/80 text-white border border-blue-400/30' 
                    : 'bg-slate-700/60 text-slate-300 border border-slate-600/40'
                }`}
              >
                <div 
                  className={`w-2.5 h-2.5 rounded-full ${
                    isConnected 
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse motion-reduce:animate-none' 
                      : 'bg-slate-400'
                  }`} 
                />
                <span className="truncate max-w-[180px]">{player.nickname}</span>
              </div>
            );
          })}
          {players.length === 0 && (
            <p className="text-base text-blue-300/70 italic py-3 text-center w-full">
              Aguardando participantes entrarem...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

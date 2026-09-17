import QrPanel from './QrPanel.js';

interface ScreenLobbyProps {
  players: Array<{ playerId: string; nickname: string; joinedAt: number }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  pin: string;
}

export default function ScreenLobby({ players, presences, pin }: ScreenLobbyProps) {
  const hostUrl = typeof window !== 'undefined' ? `${window.location.host}/join/${pin}` : `sala ${pin}`;

  return (
    <div className="flex flex-col h-full text-white p-12 max-w-7xl mx-auto w-full justify-between select-none">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-md">
          🦴 Batalha Anatômica
        </h1>
        <p className="text-2xl text-blue-200 font-medium mt-1">
          Anatomia Comparada — Bovino e Equino
        </p>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-12 my-auto">
        <div className="bg-black/35 p-10 rounded-3xl border border-white/15 backdrop-blur-md flex flex-col items-center text-center shadow-2xl">
          <span className="text-xl font-bold uppercase tracking-widest text-blue-300 mb-2">
            Acesse no navegador
          </span>
          <div className="text-3xl font-mono font-black text-yellow-300 mb-6 bg-blue-950/60 px-6 py-2 rounded-2xl border border-blue-400/30">
            {hostUrl}
          </div>
          
          <span className="text-base font-bold uppercase tracking-wider text-slate-400 mb-1">
            Ou digite o PIN
          </span>
          <div className="text-8xl font-mono font-black tracking-widest text-white drop-shadow-lg">
            {pin}
          </div>
        </div>
        
        <QrPanel pin={pin} />
      </div>

      <div className="mt-8 bg-black/20 p-6 rounded-3xl border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-blue-200">
            Participantes no Lobby
          </h2>
          <span className="text-xl font-black bg-blue-600/50 px-4 py-1.5 rounded-full border border-blue-400/30">
            {players.length} / 50
          </span>
        </div>

        <div className="flex flex-wrap gap-3 max-h-40 overflow-y-auto pr-2">
          {players.map(player => {
            const presence = presences.find(p => p.playerId === player.playerId);
            const isConnected = presence ? presence.connected : false;
            
            return (
              <div 
                key={player.playerId}
                className={`px-5 py-2 rounded-full text-lg font-bold shadow-md transition-all flex items-center gap-2.5 ${
                  isConnected ? 'bg-blue-600/80 text-white' : 'bg-slate-700/60 text-slate-300'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span>{player.nickname}</span>
              </div>
            );
          })}
          {players.length === 0 && (
            <p className="text-lg text-blue-300/70 italic py-2">
              Aguardando participantes entrarem...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

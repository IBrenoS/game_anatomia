import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import PlayerList from './PlayerList.js';
import ConfirmDialog from '../shared/ConfirmDialog.js';
import { wsManager } from '../../lib/ws.js';
import { useGameStore } from '../../stores/gameStore.js';

interface HostLobbyProps {
  players: Array<{ playerId: string; nickname: string; joinedAt: number }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  pin: string;
}

export default function HostLobby({ players, presences, pin }: HostLobbyProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [playerToRemove, setPlayerToRemove] = useState<{ id: string; nickname: string } | null>(null);
  const entryLocked = useGameStore(s => s.entryLocked);
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${pin}` : '';

  useEffect(() => {
    if (joinUrl) {
      QRCode.toDataURL(joinUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(setQrDataUrl).catch(console.error);
    }
  }, [joinUrl]);

  const handleToggleLock = () => {
    const command = entryLocked ? 'UNLOCK_ENTRIES' : 'LOCK_ENTRIES';
    wsManager.sendHostCommand(command, wsManager.roomVersion);
  };

  const handleConfirmRemove = () => {
    if (!playerToRemove) return;
    wsManager.sendHostCommand('REMOVE_PLAYER', wsManager.roomVersion, { playerId: playerToRemove.id });
    setPlayerToRemove(null);
  };

  return (
    <div className="flex flex-col h-full text-white max-w-5xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-8">
        <div className="bg-black/25 p-6 rounded-2xl border border-white/10 flex flex-col items-center text-center">
          <h2 className="text-xl text-blue-200 font-semibold mb-2">PIN DA SALA</h2>
          <div className="text-6xl font-black tracking-widest text-yellow-300 font-mono mb-4 select-all">
            {pin}
          </div>
          <p className="text-sm text-blue-300 mb-6">
            Acesse pelo celular: <span className="font-mono text-white font-bold">{joinUrl}</span>
          </p>

          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={handleToggleLock}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-md ${
                entryLocked
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-blue-200'
              }`}
            >
              {entryLocked ? '🔓 Liberar Novas Entradas' : '🔒 Bloquear Entradas'}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center text-slate-900 text-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR Code para entrar na sala ${pin}`} className="w-56 h-56 rounded-lg mb-3 shadow-inner" />
          ) : (
            <div className="w-56 h-56 bg-slate-100 flex items-center justify-center rounded-lg mb-3">
              <span className="text-sm text-slate-500">Gerando QR Code...</span>
            </div>
          )}
          <p className="text-sm font-bold text-slate-700">Aponte a câmera para entrar no jogo</p>
        </div>
      </div>

      <div className="flex-1 bg-black/20 rounded-2xl p-6 border border-white/10 flex flex-col">
        <PlayerList
          players={players}
          presences={presences}
          onRemovePlayer={(id, nickname) => setPlayerToRemove({ id, nickname })}
        />
      </div>

      <ConfirmDialog
        isOpen={Boolean(playerToRemove)}
        title="Remover Participante"
        message={`Deseja realmente remover "${playerToRemove?.nickname}" da partida? A sessão do participante será encerrada imediatamente.`}
        confirmText="Sim, Remover"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmRemove}
        onCancel={() => setPlayerToRemove(null)}
      />
    </div>
  );
}

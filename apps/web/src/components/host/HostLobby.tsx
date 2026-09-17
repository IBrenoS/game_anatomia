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
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  const handleCopyPin = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (navigator.clipboard && joinUrl) {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleToggleLock = () => {
    const command = entryLocked ? 'UNLOCK_ENTRIES' : 'LOCK_ENTRIES';
    wsManager.sendHostCommand(command, wsManager.roomVersion);
  };

  const handleStartGame = () => {
    if (players.length === 0) return;
    wsManager.sendHostCommand('START_GAME', wsManager.roomVersion);
  };

  const handleConfirmRemove = () => {
    if (!playerToRemove) return;
    wsManager.sendHostCommand('REMOVE_PLAYER', wsManager.roomVersion, { playerId: playerToRemove.id });
    setPlayerToRemove(null);
  };

  const canStart = players.length > 0;

  return (
    <div className="flex flex-col h-full text-white max-w-5xl mx-auto w-full">
      {/* Hero Control Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch mb-6">
        {/* PIN & Links Card */}
        <div className="bg-black/25 p-6 rounded-2xl border border-white/10 flex flex-col justify-between items-center text-center">
          <div className="w-full">
            <span className="text-xs uppercase tracking-widest text-blue-300 font-bold mb-1 block">
              PIN da Arena
            </span>
            <div className="flex items-center justify-center gap-3 my-2">
              <span className="text-5xl sm:text-6xl font-black tracking-widest text-yellow-300 font-mono select-all">
                {pin}
              </span>
              <button
                type="button"
                onClick={handleCopyPin}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-blue-200 transition-all border border-white/10 active:scale-95"
                title="Copiar PIN"
                aria-label="Copiar PIN"
              >
                {copiedPin ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-xs text-blue-300 mb-4 truncate max-w-xs mx-auto">
              Link de entrada: <span className="font-mono text-white font-semibold">{joinUrl}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full mt-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-blue-200 border border-white/10 transition-all active:scale-95"
            >
              {copiedLink ? '✓ Link Copiado!' : '🔗 Copiar Link'}
            </button>
            <button
              type="button"
              onClick={handleToggleLock}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all shadow-md ${
                entryLocked
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-blue-200'
              }`}
            >
              {entryLocked ? '🔓 Liberar Entradas' : '🔒 Bloquear Entradas'}
            </button>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center text-slate-900 text-center">
          {qrDataUrl ? (
            <img 
              src={qrDataUrl} 
              alt={`QR Code para entrar na sala ${pin}`} 
              className="w-48 h-48 rounded-lg mb-2 shadow-inner" 
            />
          ) : (
            <div className="w-48 h-48 bg-slate-100 flex items-center justify-center rounded-lg mb-2">
              <span className="text-xs text-slate-500">Gerando QR Code...</span>
            </div>
          )}
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">
            Aponte a câmera para entrar na partida
          </p>
        </div>
      </div>

      {/* Start Action & Arena Status Bar */}
      <div className="bg-blue-950/60 border border-blue-800/40 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full ${canStart ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <div>
            <h3 className="text-base font-bold text-white">
              {canStart ? `Arena pronta: ${players.length} participante(s)` : 'Aguardando participantes...'}
            </h3>
            <p className="text-xs text-blue-300">
              {canStart
                ? 'Você já pode dar início à rodada da batalha quando desejar.'
                : 'Pelo menos 1 jogador precisa entrar na sala para habilitar o início da partida.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!canStart}
          onClick={handleStartGame}
          className={`min-h-[48px] px-8 py-3 rounded-xl font-black text-base transition-all shadow-lg flex items-center gap-2.5 ${
            canStart
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-green-950/40 active:scale-95 cursor-pointer'
              : 'bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed border border-slate-700'
          }`}
          title={canStart ? 'Iniciar partida' : 'Aguarde pelo menos 1 participante entrar'}
        >
          <span>▶</span>
          <span>{canStart ? `Iniciar Partida (${players.length})` : 'Aguardando Jogadores'}</span>
        </button>
      </div>

      {/* Roster of participants */}
      <div className="flex-1 bg-black/20 rounded-2xl p-6 border border-white/10 flex flex-col min-h-[220px]">
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

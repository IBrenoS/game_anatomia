import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import PlayerList from './PlayerList.js';
import ConfirmDialog from '../shared/ConfirmDialog.js';
import BrandHeader from '../shared/BrandHeader.js';
import { getWebSocketManager } from '../../lib/ws.js';
import { useGameStore } from '../../stores/gameStore.js';
import { getHostParticipation } from '../../lib/hostParticipation.js';

interface HostLobbyProps {
  players: Array<{ playerId: string; nickname: string; joinedAt: number }>;
  presences: Array<{ playerId: string; connected: boolean }>;
  pin: string;
}

export const HostLobby: React.FC<HostLobbyProps> = ({ players, presences, pin }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [playerToRemove, setPlayerToRemove] = useState<{ id: string; nickname: string } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const entryLocked = useGameStore((s) => s.entryLocked);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const isHostPlayer = pin ? getHostParticipation(pin) === 'player' : false;

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${pin}` : '';

  useEffect(() => {
    if (joinUrl) {
      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 1,
        color: {
          dark: '#080C11',
          light: '#FAF7F2',
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [joinUrl]);

  const handleCopyPin = async () => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(pin);
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 2000);
      } catch (err) {
        console.error('Falha ao copiar PIN:', err);
      }
    }
  };

  const handleCopyLink = async () => {
    if (navigator.clipboard && joinUrl) {
      try {
        await navigator.clipboard.writeText(joinUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch (err) {
        console.error('Falha ao copiar link:', err);
      }
    }
  };

  const handleToggleLock = () => {
    const command = entryLocked ? 'UNLOCK_ENTRIES' : 'LOCK_ENTRIES';
    const hostManager = getWebSocketManager('host');
    hostManager.sendHostCommand(command, hostManager.roomVersion);
  };

  const canStart = connectedPlayers >= 1;

  const handleStartGame = () => {
    if (!canStart) return;
    const hostManager = getWebSocketManager('host');
    hostManager.sendHostCommand('START_GAME', hostManager.roomVersion);
  };

  const handleConfirmRemove = () => {
    if (!playerToRemove) return;
    const hostManager = getWebSocketManager('host');
    hostManager.sendHostCommand('REMOVE_PLAYER', hostManager.roomVersion, {
      playerId: playerToRemove.id,
    });
    setPlayerToRemove(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-between select-none animate-[fadeInScale_0.3s_ease-out]">
      {/* Brand Header */}
      <BrandHeader showArenaStatus={false} />

      {/* Main Lobby View (Tela 5) */}
      <main className="w-full my-auto py-6 sm:py-8 space-y-8">
        {/* Title Area */}
        <div className="space-y-2 text-left">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
            Sala criada
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl">
            Convide os jogadores e comece quando todo mundo estiver pronto.
          </p>
        </div>

        {/* 3-Column Balanced Layout (Desktop) / Tailored Stack (Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Column 1: PIN Section */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                PIN
              </span>
              <div className="flex items-baseline gap-4 flex-wrap">
                <div 
                  className="text-5xl sm:text-6xl font-mono font-black tracking-widest text-white select-all"
                  aria-label={`PIN da sala: ${pin}`}
                >
                  <span className="mr-3 sm:mr-4">{pin.slice(0, 3)}</span><span>{pin.slice(3)}</span>
                </div>
                {/* Mobile inline copy button */}
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="sm:hidden py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                >
                  {copiedPin ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Desktop Copy Buttons */}
            <div className="hidden sm:flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyPin}
                className="py-2 px-4 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-xs font-bold text-slate-200 border border-white/10 hover:border-white/25 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>{copiedPin ? '✓ Copiado!' : 'Copiar PIN'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2 px-4 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-xs font-bold text-slate-200 border border-white/10 hover:border-white/25 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>{copiedLink ? '✓ Link copiado!' : 'Copiar link'}</span>
              </button>
            </div>
          </div>

          {/* Column 2: QR Code Card */}
          <div className="md:col-span-3 flex flex-col items-center justify-center">
            <div className="bg-[#FAF7F2] p-4 rounded-2xl shadow-2xl border border-white/20 flex flex-col items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code para entrar na sala ${pin}`}
                  className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-lg"
                />
              ) : (
                <div className="w-40 h-40 sm:w-44 sm:h-44 bg-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-600">
                  Gerando QR...
                </div>
              )}
              <span className="text-[11px] font-bold text-slate-600 tracking-wide mt-2">
                Escanear para entrar
              </span>
            </div>
          </div>

          {/* Column 3: Participantes Section */}
          <div className="md:col-span-4 flex flex-col space-y-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Participantes ({connectedPlayers}/{players.length} conectados)
              </h2>
              <div className="flex items-center gap-2">
                <span 
                  className={`w-2.5 h-2.5 rounded-full ${
                    connectedPlayers > 0 ? 'bg-[#1FD4A7] animate-pulse' : 'bg-slate-500'
                  }`} 
                  aria-hidden="true" 
                />
                <span className="text-xl sm:text-2xl font-black text-white">
                  {connectedPlayers} conectado{connectedPlayers === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* List of Connected Players */}
            <div className="bg-[#0E1522]/60 rounded-2xl p-3 border border-white/10">
              <PlayerList
                players={players}
                presences={presences}
                onRemovePlayer={(id, nickname) => setPlayerToRemove({ id, nickname })}
                isHostPlaying={isHostPlayer}
              />
            </div>
          </div>
        </div>

        {/* Action Area & CTAs */}
        <div className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            {/* Dominant CTA: Iniciar Partida */}
            <button
              type="button"
              disabled={!canStart}
              onClick={handleStartGame}
              className="w-full sm:w-auto min-w-[220px] py-4 px-8 rounded-xl bg-[#1FD4A7] hover:bg-[#19C298] disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-50 text-[#080C11] font-black text-base tracking-wide shadow-[0_4px_20px_rgba(31,212,167,0.25)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Iniciar partida</span>
              <span>→</span>
            </button>

            {/* Secondary actions group */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Secondary: Abrir Telão */}
              <a
                href={`/screen/${pin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-white font-bold text-xs sm:text-sm tracking-wide border border-white/15 hover:border-white/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <span>Abrir telão</span>
              </a>

              {/* Secondary: Copiar Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-white font-bold text-xs sm:text-sm tracking-wide border border-white/15 hover:border-white/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{copiedLink ? '✓ Link copiado!' : 'Copiar link'}</span>
              </button>

              {/* Discrete Lock / Unlock Control */}
              <button
                type="button"
                onClick={handleToggleLock}
                className="py-2.5 px-3 rounded-xl bg-transparent hover:bg-white/5 text-xs text-slate-400 hover:text-white transition-colors border border-transparent hover:border-white/10 cursor-pointer sm:ml-auto"
                title={entryLocked ? 'Liberar novas entradas na sala' : 'Bloquear novas entradas na sala'}
              >
                {entryLocked ? '🔓 Liberar' : '🔒 Bloquear'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-left">
            O telão é opcional. Ideal para sala de aula e projetor.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500">
        <span>Batalha Anatômica • Sala de Batalha</span>
      </footer>

      {/* Confirmation Dialog for kicking players */}
      <ConfirmDialog
        isOpen={Boolean(playerToRemove)}
        title="Remover Participante"
        message={`Deseja realmente remover "${playerToRemove?.nickname}" da sala?`}
        confirmText="Sim, Remover"
        cancelText="Cancelar"
        onConfirm={handleConfirmRemove}
        onCancel={() => setPlayerToRemove(null)}
      />
    </div>
  );
};

export default HostLobby;

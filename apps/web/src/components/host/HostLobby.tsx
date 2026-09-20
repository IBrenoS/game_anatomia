import React, { useState, useEffect, useRef } from 'react';
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
  const inlineCtaRef = useRef<HTMLDivElement | null>(null);
  const [isInlineCtaVisible, setIsInlineCtaVisible] = useState(true);

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

  // Observer to detect when the inline CTA is visible in the viewport
  useEffect(() => {
    const target = inlineCtaRef.current;
    if (!target) return;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInlineCtaVisible(entry.isIntersecting);
      },
      { threshold: 0.3 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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

  // Sticky CTA is only shown on mobile when the inline CTA is off-screen and room is ready to start
  const showStickyCta = !isInlineCtaVisible && canStart;

  return (
    <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-between select-none animate-[fadeInScale_0.3s_ease-out]">
      {/* Brand Header */}
      <BrandHeader showArenaStatus={false} />

      {/* Main Lobby View (Tela 5) */}
      <main className="w-full my-auto py-2 sm:py-4 md:py-6 space-y-4 sm:space-y-6 md:space-y-8 pb-20 md:pb-6">
        {/* Title Area */}
        <div className="space-y-1 sm:space-y-2 text-left">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-white">
            Sala criada
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-slate-400 max-w-xl">
            Convide os jogadores e comece quando todo mundo estiver pronto.
          </p>
        </div>

        {/* 3-Column Balanced Layout (Desktop) / Tailored Stack (Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 md:gap-8 items-start">
          {/* Column 1: PIN Section */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-2 sm:space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                PIN
              </span>
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <div 
                  className="text-4xl sm:text-5xl md:text-6xl font-mono font-black tracking-widest text-white select-all"
                  aria-label={`PIN da sala: ${pin}`}
                >
                  <span className="mr-2 sm:mr-3">{pin.slice(0, 3)}</span><span>{pin.slice(3)}</span>
                </div>
                {/* Mobile inline copy button */}
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="sm:hidden py-1.5 px-3 rounded-lg bg-[#151F2E] hover:bg-[#1C293D] border border-white/15 text-xs font-bold text-slate-200 active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1FD4A7]"
                >
                  {copiedPin ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Desktop Copy Buttons */}
            <div className="hidden sm:flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopyPin}
                className="py-2 px-4 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-xs font-bold text-slate-200 border border-white/10 hover:border-white/25 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1FD4A7]"
              >
                <span>{copiedPin ? '✓ Copiado' : 'Copiar PIN'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2 px-4 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-xs font-bold text-slate-200 border border-white/10 hover:border-white/25 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1FD4A7]"
              >
                <span>{copiedLink ? '✓ Copiado' : 'Copiar link'}</span>
              </button>
            </div>
          </div>

          {/* Column 2: QR Code Card */}
          <div className="md:col-span-3 flex flex-col items-center justify-center">
            <div className="bg-[#FAF7F2] p-2.5 sm:p-3 md:p-4 rounded-2xl shadow-xl border border-white/20 flex flex-col items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code para entrar na sala ${pin}`}
                  className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain rounded-lg"
                />
              ) : (
                <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 bg-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-600">
                  Gerando QR...
                </div>
              )}
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 tracking-wide mt-1 sm:mt-2">
                Escanear para entrar
              </span>
            </div>
          </div>

          {/* Column 3: Participantes Section */}
          <div className="md:col-span-4 flex flex-col space-y-2 sm:space-y-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                PARTICIPANTES
                <span className="sr-only"> ({connectedPlayers}/{players.length} conectados)</span>
              </h2>
              <div className="flex items-center gap-2">
                <span 
                  className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-colors duration-300 ${
                    connectedPlayers > 0 ? 'bg-[#1FD4A7] animate-pulse motion-reduce:animate-none' : 'bg-slate-500'
                  }`} 
                  aria-hidden="true" 
                />
                <span className="text-lg sm:text-xl md:text-2xl font-black text-white">
                  {connectedPlayers === 0 
                    ? '0 conectados' 
                    : connectedPlayers === 1 
                      ? '1 conectado' 
                      : `${connectedPlayers} conectados`}
                </span>
              </div>
            </div>

            {/* List of Connected Players */}
            <div className="bg-[#0E1522]/60 rounded-2xl p-2 sm:p-3 border border-white/10">
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
        <div className="pt-4 sm:pt-6 border-t border-white/10 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            {/* Dominant CTA: Iniciar Partida */}
            <div ref={inlineCtaRef} className="w-full sm:w-auto">
              <button
                type="button"
                disabled={!canStart}
                onClick={handleStartGame}
                className={`w-full sm:w-auto min-w-[200px] sm:min-w-[220px] py-3.5 sm:py-4 px-6 sm:px-8 rounded-xl bg-[#1FD4A7] hover:bg-[#19C298] disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-50 text-[#080C11] font-black text-base tracking-wide transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C11] ${
                  canStart ? 'shadow-[0_0_24px_rgba(31,212,167,0.35)] hover:scale-[1.02]' : 'shadow-none'
                }`}
              >
                <span>Iniciar partida</span>
                <span>→</span>
              </button>
            </div>

            {/* Secondary & Tertiary Actions */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Secondary: Abrir Telão */}
              <a
                href={`/screen/${pin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-3.5 sm:px-5 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-white font-bold text-xs sm:text-sm tracking-wide border border-white/15 hover:border-white/30 transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] flex items-center justify-center gap-1.5 cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7]"
              >
                <span>Abrir telão</span>
                <span className="text-slate-400 text-xs">↗</span>
              </a>

              {/* Secondary: Copiar Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-3.5 sm:px-5 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-white font-bold text-xs sm:text-sm tracking-wide border border-white/15 hover:border-white/30 transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7]"
              >
                <span>{copiedLink ? '✓ Copiado' : 'Copiar link'}</span>
              </button>

              {/* Tertiary: Subordinated Action [ ••• ] */}
              <div className="relative sm:ml-auto group">
                <button
                  type="button"
                  onClick={handleToggleLock}
                  aria-label={entryLocked ? 'Liberar entradas' : 'Bloquear novas entradas'}
                  title={entryLocked ? 'Liberar entradas' : 'Bloquear novas entradas'}
                  className={`py-2.5 sm:py-3 px-3 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-slate-300 hover:text-white border transition-all active:scale-95 cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] ${
                    entryLocked ? 'border-amber-500/50 text-amber-300 bg-amber-950/20' : 'border-white/15 hover:border-white/30'
                  }`}
                >
                  <span className="text-sm font-bold tracking-widest select-none leading-none px-0.5">•••</span>
                  {entryLocked && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1.5 right-1.5" />
                  )}
                </button>

                {/* Subordinated Tooltip / Popover */}
                <div
                  role="tooltip"
                  className="absolute right-0 bottom-full mb-2 hidden group-hover:flex group-focus-within:flex items-center gap-1.5 bg-[#0E1522] border border-white/15 rounded-xl shadow-xl py-1.5 px-3 whitespace-nowrap text-xs font-semibold text-slate-200 pointer-events-none z-30 animate-[fadeInScale_0.15s_ease-out]"
                >
                  <span>{entryLocked ? '🔓 Liberar entradas' : '🔒 Bloquear novas entradas'}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-left">
            O telão é opcional. Ideal para sala de aula e projetor.
          </p>
        </div>
      </main>

      {/* Sticky CTA (Mobile only, low viewports when inline CTA is off-screen and game can start) */}
      {showStickyCta && (
        <div 
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080C11]/95 backdrop-blur-md border-t border-white/10 p-3 px-4 shadow-[0_-4px_24px_rgba(0,0,0,0.8)] animate-[fadeInScale_0.2s_ease-out]"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={handleStartGame}
            className="w-full py-3.5 px-6 rounded-xl bg-[#1FD4A7] hover:bg-[#19C298] text-[#080C11] font-black text-base tracking-wide shadow-[0_0_20px_rgba(31,212,167,0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7]"
          >
            <span>Iniciar partida</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500">
        <span>Batalha Anatômica • Medicina Veterinária</span>
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


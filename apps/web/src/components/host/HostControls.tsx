import { useState, useEffect } from 'react';
import { getWebSocketManager, type ConnectionState } from '../../lib/ws.js';
import { useGameStore } from '../../stores/gameStore.js';
import { soundManager } from '../../lib/sound.js';
import ConfirmDialog from '../shared/ConfirmDialog.js';

interface HostControlsProps {
  roomState: string | null;
  adminConnectionState: ConnectionState;
}

export default function HostControls({ roomState, adminConnectionState }: HostControlsProps) {
  const [confirmAction, setConfirmAction] = useState<'END_QUESTION' | 'END_GAME' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundManager.isEnabled());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const pin = useGameStore((s) => s.pin);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleSound = () => {
    const next = soundManager.toggleSound();
    setSoundEnabled(next);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const handleCommand = (command: string, data?: Record<string, unknown>) => {
    if (adminConnectionState !== 'connected') return;
    const hostManager = getWebSocketManager('host');
    hostManager.sendHostCommand(command, hostManager.roomVersion, data);
  };

  const handleExecuteConfirmedAction = () => {
    if (confirmAction === 'END_QUESTION') {
      handleCommand('END_QUESTION');
    } else if (confirmAction === 'END_GAME') {
      handleCommand('END_GAME');
    }
    setConfirmAction(null);
  };

  const connectedPlayers = useGameStore((s) => s.connectedPlayers);

  const renderStateButtons = () => {
    switch (roomState) {
      case 'LOBBY': {
        const canStart = connectedPlayers >= 1;
        return (
          <button 
            type="button"
            disabled={!canStart}
            onClick={() => handleCommand('START_GAME')}
            className={`px-6 py-2.5 font-bold rounded-xl shadow-lg transition-all ${
              canStart
                ? 'bg-green-600 hover:bg-green-500 text-white active:scale-95 cursor-pointer shadow-green-950/40'
                : 'bg-slate-700 text-slate-400 opacity-60 cursor-not-allowed border border-slate-600'
            }`}
            title={canStart ? 'Iniciar partida' : 'Aguardando pelo menos um jogador conectado.'}
            aria-label={canStart ? 'Iniciar partida' : 'Aguardando pelo menos um jogador conectado.'}
          >
            {canStart ? `▶ Iniciar Partida (${connectedPlayers})` : 'Aguardando pelo menos um jogador conectado.'}
          </button>
        );
      }
      case 'QUESTION_ACTIVE':
        return (
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => handleCommand('PAUSE')}
              className="px-3.5 py-1.5 bg-[#C95A34] hover:bg-[#B04A27] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              ⏸ Pausar
            </button>
            <button 
              type="button"
              onClick={() => setConfirmAction('END_QUESTION')}
              className="px-3.5 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              ⏹ Encerrar Questão
            </button>
          </div>
        );
      case 'PAUSED':
        return (
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => handleCommand('RESUME')}
              className="px-3.5 py-1.5 bg-[#123829] hover:bg-[#1B4D3E] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              ▶ Retomar
            </button>
            <button 
              type="button"
              onClick={() => setConfirmAction('END_GAME')}
              className="px-3.5 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Finalizar Partida
            </button>
          </div>
        );
      case 'QUESTION_REVEAL':
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#123829] font-semibold flex items-center gap-1.5 bg-[#EAF5EC] px-3 py-1 rounded-full border border-[#2D8058]/30">
              <span className="w-2 h-2 rounded-full bg-[#2D8058] animate-pulse" />
              Avanço automático em ~5s
            </span>
          </div>
        );
      case 'ROUND_RANKING':
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#123829] font-semibold flex items-center gap-1.5 bg-[#EAF5EC] px-3 py-1 rounded-full border border-[#2D8058]/30">
              <span className="w-2 h-2 rounded-full bg-[#2D8058] animate-pulse" />
              Próxima questão em ~5s
            </span>
          </div>
        );
      case 'FINAL_RANKING':
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#B45309] font-semibold flex items-center gap-1.5 bg-[#FEF9EE] px-3 py-1 rounded-full border border-[#F59E0B]/40">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
              Pódio iniciando em ~5s
            </span>
          </div>
        );
      case 'PODIUM':
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#123829] font-semibold flex items-center gap-1.5 bg-[#EAF5EC] px-3 py-1 rounded-full border border-[#2D8058]/30">
              <span className="w-2 h-2 rounded-full bg-[#2D8058] animate-pulse" />
              Encerramento automático em ~10s
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap justify-between items-center gap-2 sm:gap-3">
      {/* Controles locais (FR 032) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={handleToggleSound}
          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
            soundEnabled
              ? 'bg-[#EAF5EC] border-[#2D8058]/40 text-[#2D8058]'
              : 'bg-white border-[#E2DDD2] text-[#555E57] hover:bg-[#F7F5EE]'
          }`}
          title="Alternar áudio local"
          aria-label={soundEnabled ? 'Desativar som local' : 'Ativar som local'}
        >
          {soundEnabled ? '🔊 Som Ativo' : '🔇 Som Mudo'}
        </button>
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-[#E2DDD2] bg-white hover:bg-[#F7F5EE] text-xs font-bold text-[#122017] transition-all cursor-pointer shadow-xs"
          title="Alternar tela cheia"
          aria-label="Alternar tela cheia"
        >
          {isFullscreen ? '⛶ Sair' : '⛶ Tela Cheia'}
        </button>
        {pin && (
          <a
            href={`/screen/${pin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-[#E2DDD2] bg-white hover:bg-[#F7F5EE] text-xs font-bold text-[#122017] transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
            title="Abrir Telão em nova aba"
            aria-label="Abrir Telão em nova aba"
          >
            <span>📺</span>
            <span className="hidden sm:inline">Telão</span>
          </a>
        )}
      </div>

      {/* Ações de controle de estado */}
      <fieldset disabled={adminConnectionState !== 'connected'} className="flex items-center gap-1.5 sm:gap-2 disabled:opacity-60">
        {adminConnectionState !== 'connected' ? (
          <span role="status" className="text-xs font-bold text-[#C95A34]">
            Reconectando controles da partida…
          </span>
        ) : renderStateButtons()}
      </fieldset>

      <ConfirmDialog
        isOpen={confirmAction === 'END_QUESTION'}
        title="Encerrar Questão"
        message="Tem certeza que deseja encerrar a questão antecipadamente? Participantes que ainda não responderam receberão 0 pontos."
        confirmText="Sim, Encerrar"
        cancelText="Voltar"
        isDestructive={true}
        onConfirm={handleExecuteConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'END_GAME'}
        title="Encerrar Partida"
        message="Tem certeza que deseja finalizar a partida agora? Essa ação é definitiva e não poderá ser desfeita."
        confirmText="Finalizar Agora"
        cancelText="Voltar"
        isDestructive={true}
        onConfirm={handleExecuteConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

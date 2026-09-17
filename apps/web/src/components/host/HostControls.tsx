import { useState, useEffect } from 'react';
import { wsManager } from '../../lib/ws.js';
import { useGameStore } from '../../stores/gameStore.js';
import ConfirmDialog from '../shared/ConfirmDialog.js';

interface HostControlsProps {
  roomState: string | null;
}

export default function HostControls({ roomState }: HostControlsProps) {
  const [confirmAction, setConfirmAction] = useState<'END_QUESTION' | 'END_GAME' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('batalha_sound_enabled') !== 'false';
    }
    return true;
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('batalha_sound_enabled', String(next));
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const handleCommand = (command: string, data?: Record<string, unknown>) => {
    wsManager.sendHostCommand(command, wsManager.roomVersion, data);
  };

  const handleExecuteConfirmedAction = () => {
    if (confirmAction === 'END_QUESTION') {
      handleCommand('END_QUESTION');
    } else if (confirmAction === 'END_GAME') {
      handleCommand('END_GAME');
    }
    setConfirmAction(null);
  };

  const players = useGameStore((s) => s.players);

  const renderStateButtons = () => {
    switch (roomState) {
      case 'LOBBY': {
        const canStart = players.length > 0;
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
            title={canStart ? 'Iniciar partida' : 'Aguarde pelo menos 1 participante entrar para iniciar'}
            aria-label={canStart ? 'Iniciar partida' : 'Aguarde pelo menos 1 participante entrar para iniciar'}
          >
            {canStart ? `▶ Iniciar Partida (${players.length})` : 'Aguardando jogadores...'}
          </button>
        );
      }
      case 'QUESTION_ACTIVE':
        return (
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => handleCommand('PAUSE')}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow transition-all cursor-pointer"
            >
              ⏸ Pausar Rodada
            </button>
            <button 
              type="button"
              onClick={() => setConfirmAction('END_QUESTION')}
              className="px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl shadow transition-all cursor-pointer"
            >
              ⏹ Encerrar Questão
            </button>
          </div>
        );
      case 'PAUSED':
        return (
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => handleCommand('RESUME')}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow transition-all cursor-pointer"
            >
              ▶ Retomar Rodada
            </button>
            <button 
              type="button"
              onClick={() => setConfirmAction('END_GAME')}
              className="px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl shadow transition-all cursor-pointer"
            >
              Finalizar Partida
            </button>
          </div>
        );
      case 'QUESTION_REVEAL':
        return (
          <button 
            type="button"
            onClick={() => handleCommand('SHOW_RANKING')}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow transition-all cursor-pointer"
          >
            📊 Ver Classificação
          </button>
        );
      case 'ROUND_RANKING':
        return (
          <button 
            type="button"
            onClick={() => handleCommand('NEXT_QUESTION')}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow transition-all cursor-pointer"
          >
            ➡ Próxima Pergunta
          </button>
        );
      case 'FINAL_RANKING':
        return (
          <button 
            type="button"
            onClick={() => handleCommand('START_PODIUM')}
            className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black rounded-xl shadow-lg transition-all cursor-pointer"
          >
            🏆 Iniciar Pódio
          </button>
        );
      case 'PODIUM':
        return (
          <button 
            type="button"
            onClick={() => setConfirmAction('END_GAME')}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow transition-all cursor-pointer"
          >
            🏁 Concluir Partida
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap justify-between items-center gap-4">
      {/* Controles locais (FR 032) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleSound}
          className={`p-2.5 rounded-xl border text-sm font-semibold transition-all ${
            soundEnabled
              ? 'bg-blue-600/30 border-blue-400/40 text-blue-200'
              : 'bg-white/5 border-white/10 text-white/50'
          }`}
          title="Alternar áudio local"
          aria-label={soundEnabled ? 'Desativar som local' : 'Ativar som local'}
        >
          {soundEnabled ? '🔊 Som Ativo' : '🔇 Som Mudo'}
        </button>
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold text-white/80 transition-all"
          title="Alternar tela cheia"
          aria-label="Alternar tela cheia"
        >
          {isFullscreen ? '⛶ Sair da Tela Cheia' : '⛶ Tela Cheia'}
        </button>
      </div>

      {/* Ações de controle de estado */}
      <div className="flex items-center gap-3">
        {renderStateButtons()}
      </div>

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

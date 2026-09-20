import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ServerEventType } from '@batalha/protocol';
import { getWebSocketManager } from '../lib/ws.js';
import { useGameStore } from '../stores/gameStore.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { getHostParticipation } from '../lib/hostParticipation.js';
import HostLobby from '../components/host/HostLobby.js';
import HostQuestion from '../components/host/HostQuestion.js';
import HostReveal from '../components/host/HostReveal.js';
import HostRanking from '../components/host/HostRanking.js';
import HostPodium from '../components/host/HostPodium.js';
import HostControls from '../components/host/HostControls.js';
import PlayerCountdown from '../components/player/PlayerCountdown.js';
import PlayerQuestion from '../components/player/PlayerQuestion.js';
import PlayerReveal from '../components/player/PlayerReveal.js';
import PlayerRanking from '../components/player/PlayerRanking.js';
import PlayerPodium from '../components/player/PlayerPodium.js';
import PlayerFinished from '../components/player/PlayerFinished.js';
import ReconnectOverlay from '../components/player/ReconnectOverlay.js';

export function HostPage() {
  const { pin: routePin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const pin = routePin || '';
  const participation = pin ? getHostParticipation(pin) : 'presenter';
  const isHostPlayer = participation === 'player';
  const playerToken = isHostPlayer && typeof localStorage !== 'undefined'
    ? localStorage.getItem(`batalha_session_${pin}`)
    : null;
  const [restorationError, setRestorationError] = useState<string | null>(
    isHostPlayer && !playerToken
      ? 'Não foi possível restaurar sua sessão de participante. Os controles do apresentador continuam disponíveis.'
      : null,
  );
  const competitiveView = isHostPlayer && Boolean(playerToken) && !restorationError;

  const hostSocket = useGameSocket('host', { syncStore: !competitiveView });
  const playerSocket = useGameSocket('player', { syncStore: competitiveView });

  const roomState = useGameStore((s) => s.roomState);
  const players = useGameStore((s) => s.players);
  const presences = useGameStore((s) => s.presences);
  const playerId = useGameStore((s) => s.playerId);
  const nickname = useGameStore((s) => s.nickname);
  const currentQuestionIndex = useGameStore((s) => s.currentQuestionIndex);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const startedAt = useGameStore((s) => s.startedAt);
  const deadlineAt = useGameStore((s) => s.deadlineAt);
  const remainingMs = useGameStore((s) => s.remainingMs);
  const selectedOptionId = useGameStore((s) => s.selectedOptionId);
  const answerSubmitted = useGameStore((s) => s.answerSubmitted);
  const answerRejected = useGameStore((s) => s.answerRejected);
  const distribution = useGameStore((s) => s.distribution);
  const correctOptionId = useGameStore((s) => s.correctOptionId);
  const explanation = useGameStore((s) => s.explanation);
  const personalResult = useGameStore((s) => s.personalResult);
  const rankings = useGameStore((s) => s.rankings);
  const isFinalRanking = useGameStore((s) => s.isFinalRanking);
  const podium = useGameStore((s) => s.podium);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const previousRankings = useGameStore((s) => s.previousRankings);
  const personalRanking = rankings.find(ranking => ranking.playerId === playerId);

  useEffect(() => {
    if (pin) hostSocket.connect(pin);
  }, [hostSocket.connect, pin]);

  useEffect(() => {
    if (!competitiveView || !playerToken || !pin) return;
    playerSocket.connect(pin, playerToken);
    if (playerSocket.manager.state === 'connected') {
      playerSocket.manager.requestSnapshot();
    }
  }, [competitiveView, pin, playerSocket.connect, playerSocket.manager, playerToken]);

  useEffect(() => {
    if (!isHostPlayer) return;
    return playerSocket.manager.onEvent(ServerEventType.ERROR, (payload) => {
      if (payload.code === 'UNAUTHORIZED') {
        setRestorationError('Não foi possível restaurar sua sessão de participante. Os controles do apresentador continuam disponíveis.');
      }
    });
  }, [isHostPlayer, playerSocket.manager]);

  useEffect(() => {
    if (restorationError && hostSocket.manager.state === 'connected') {
      hostSocket.manager.requestSnapshot();
    }
  }, [hostSocket.manager, restorationError]);

  const isGameplay = Boolean(
    roomState &&
      roomState !== 'LOBBY'
  );
  const pauseModalIsOpen = roomState === 'PAUSED';

  // Sync body and documentElement background color based on game state (dark for pre-game lobby, ivory for gameplay)
  useEffect(() => {
    if (isGameplay) {
      document.body.style.backgroundColor = '#FAF8F3';
      document.body.style.color = '#122017';
      document.documentElement.style.backgroundColor = '#FAF8F3';
    } else {
      document.body.style.backgroundColor = '#080C11';
      document.body.style.color = '#FAF7F2';
      document.documentElement.style.backgroundColor = '#080C11';
    }
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      document.documentElement.style.backgroundColor = '';
    };
  }, [isGameplay]);

  const primaryConnectionState = competitiveView
    ? playerSocket.connectionState
    : hostSocket.connectionState;

  if (primaryConnectionState === 'disconnected' || primaryConnectionState === 'connecting') {
    return (
      <div className="min-h-screen bg-[#080C11] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#1FD4A7] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-300">Conectando à sala...</span>
        </div>
      </div>
    );
  }

  // During LOBBY, render the dedicated redesigned Tela 5 layout without technical operational headers
  if (roomState === 'LOBBY') {
    return (
      <div className="min-h-screen bg-[#080C11] text-[#FAF7F2] flex flex-col p-3 sm:p-6 md:p-10 relative overflow-x-hidden">
        <div 
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#123829]/20 blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />
        <div 
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#D05F36]/10 blur-3xl pointer-events-none" 
          aria-hidden="true" 
        />
        <ReconnectOverlay isReconnecting={competitiveView && playerSocket.connectionState === 'reconnecting'} isGameplay={false} />
        {restorationError && (
          <div role="alert" className="mb-4 rounded-xl border border-amber-400/50 bg-amber-950/80 p-3 text-center font-bold text-amber-100 text-xs sm:text-sm">
            {restorationError}
          </div>
        )}
        <HostLobby players={players} presences={presences} pin={pin} />
      </div>
    );
  }

  const renderPresenterFinished = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-4 sm:space-y-6 select-none">
      <span className="text-5xl sm:text-6xl">🏁</span>
      <h2 className="text-3xl sm:text-4xl font-black text-[#122017]">Partida Encerrada</h2>
      <p className="text-[#555E57] text-base sm:text-lg max-w-md">
        A batalha foi concluída com sucesso. Você pode iniciar uma nova partida ou voltar ao início.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            hostSocket.disconnect();
            useGameStore.getState().resetStore();
            navigate('/host');
          }}
          className="px-6 py-3 bg-[#123829] hover:bg-[#1B4D3E] font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer"
        >
          Nova Partida
        </button>
        <button
          type="button"
          onClick={() => {
            hostSocket.disconnect();
            useGameStore.getState().resetStore();
            navigate('/');
          }}
          className="px-6 py-3 bg-white hover:bg-[#F7F5EE] border border-[#E2DDD2] font-bold text-[#122017] rounded-xl shadow-xs transition-all cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    </div>
  );

  const handleHostResume = () => {
    if (hostSocket.connectionState !== 'connected') return;
    const hostManager = getWebSocketManager('host');
    hostManager.sendHostCommand('RESUME', hostManager.roomVersion);
  };

  const renderContent = () => {
    if (competitiveView) {
      switch (roomState) {
        case 'COUNTDOWN':
          return <PlayerCountdown />;
        case 'QUESTION_ACTIVE':
        case 'PAUSED':
          return (
            <PlayerQuestion
              question={currentQuestion}
              currentQuestionIndex={currentQuestionIndex}
              startedAt={startedAt}
              deadlineAt={deadlineAt}
              selectedOptionId={selectedOptionId}
              answerSubmitted={answerSubmitted}
              roomState={roomState}
              remainingMs={remainingMs}
              answerRejected={answerRejected}
              isHost={true}
              onResume={handleHostResume}
              onResumeDisabled={hostSocket.connectionState !== 'connected'}
            />
          );
        case 'QUESTION_REVEAL':
          return <PlayerReveal result={personalResult} correctOptionId={correctOptionId} question={currentQuestion} />;
        case 'ROUND_RANKING':
        case 'FINAL_RANKING':
          return (
            <PlayerRanking
              ranking={personalRanking}
              isFinal={isFinalRanking}
              previousRankings={previousRankings}
            />
          );
        case 'PODIUM':
          return <PlayerPodium podium={podium} playerId={playerId} />;
        case 'FINISHED':
          return <PlayerFinished ranking={personalRanking} />;
        default:
          return <div className="flex-1 flex items-center justify-center text-[#555E57]">Aguarde...</div>;
      }
    }

    switch (roomState) {
      case 'COUNTDOWN':
        return <PlayerCountdown />;
      case 'PAUSED':
      case 'QUESTION_ACTIVE':
        return (
          <HostQuestion
            question={currentQuestion}
            currentQuestionIndex={currentQuestionIndex}
            startedAt={startedAt}
            deadlineAt={deadlineAt}
            onResume={handleHostResume}
            onResumeDisabled={hostSocket.connectionState !== 'connected'}
          />
        );
      case 'QUESTION_REVEAL':
        return (
          <HostReveal
            question={currentQuestion}
            correctOptionId={correctOptionId}
            explanation={explanation}
            distribution={distribution}
          />
        );
      case 'ROUND_RANKING':
      case 'FINAL_RANKING':
        return <HostRanking rankings={rankings} isFinal={isFinalRanking} />;
      case 'PODIUM':
      case 'FINISHED':
        return <HostPodium podium={podium} roomState={roomState} />;
      default:
        return <div className="flex-1 flex items-center justify-center text-[#555E57]">Aguardando estado do jogo...</div>;
    }
  };

  return (
    <div className="min-h-screen gameplay-canvas bg-[#FAF8F3] text-[#122017] flex flex-col relative overflow-x-hidden">
      <ReconnectOverlay isReconnecting={competitiveView && playerSocket.connectionState === 'reconnecting'} isGameplay={isGameplay} />

      {/* Slim discreet ivory header */}
      <header className="px-3 sm:px-6 py-1.5 sm:py-2 bg-[#FAF8F3]/95 backdrop-blur-xs flex justify-between items-center text-xs border-b border-[#E2DDD2]/70 shrink-0 z-20 select-none">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-bold text-[#123829] bg-white border border-[#E2DDD2] px-2.5 py-0.5 rounded-full shadow-xs">
            {competitiveView ? `Host + Player · ${nickname || 'Jogador'}` : 'Apresentador'}
          </span>
          <span className="font-mono font-bold text-[#555E57]">PIN: {pin}</span>
          {pin && (
            <a
              href={`/screen/${pin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-0.5 bg-white hover:bg-[#F7F5EE] text-[#123829] text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 border border-[#E2DDD2] shadow-xs cursor-pointer"
            >
              <span>Telão</span>
              <span className="text-[10px] text-[#648B68]">↗</span>
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#555E57]">
          <span className={`w-2 h-2 rounded-full ${connectedPlayers > 0 ? 'bg-[#2D8058] animate-pulse' : 'bg-slate-400'}`} />
          <span><strong className="text-[#122017]">{connectedPlayers}</strong> conectados</span>
        </div>
      </header>

      {restorationError && (
        <div role="alert" className="m-3 rounded-xl border border-amber-400/50 bg-[#FEF9EE] p-2.5 text-center font-bold text-[#B45309] text-xs sm:text-sm">
          {restorationError}
        </div>
      )}

      {/* Main gameplay viewport directly on ivory canvas */}
      <main className="flex-1 flex flex-col min-h-0 w-full">
        {renderContent()}
      </main>

      {/* Secondary ivory controls bar */}
      <footer
        className="px-2.5 sm:px-6 py-1.5 sm:py-2 bg-[#FAF8F3]/95 backdrop-blur-xs border-t border-[#E2DDD2]/70 shrink-0 z-20"
        inert={pauseModalIsOpen || undefined}
        aria-hidden={pauseModalIsOpen || undefined}
      >
        <HostControls roomState={roomState} adminConnectionState={hostSocket.connectionState} />
      </footer>
    </div>
  );
}

export default HostPage;

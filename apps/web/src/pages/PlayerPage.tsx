import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useGameStore } from '../stores/gameStore.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import PlayerLobby from '../components/player/PlayerLobby.js';
import PlayerCountdown from '../components/player/PlayerCountdown.js';
import PlayerQuestion from '../components/player/PlayerQuestion.js';
import PlayerReveal from '../components/player/PlayerReveal.js';
import PlayerRanking from '../components/player/PlayerRanking.js';
import PlayerPodium from '../components/player/PlayerPodium.js';
import PlayerFinished from '../components/player/PlayerFinished.js';
import ReconnectOverlay from '../components/player/ReconnectOverlay.js';
import ConnectionRestoredToast from '../components/player/ConnectionRestoredToast.js';

export function PlayerPage() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const { manager, connect, connectionState } = useGameSocket('player');

  const roomState = useGameStore((s) => s.roomState);
  const remainingMs = useGameStore((s) => s.remainingMs);
  const answerRejected = useGameStore((s) => s.answerRejected);
  const playerId = useGameStore((s) => s.playerId);
  const nickname = useGameStore((s) => s.nickname);
  const currentQuestionIndex = useGameStore((s) => s.currentQuestionIndex);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const startedAt = useGameStore((s) => s.startedAt);
  const deadlineAt = useGameStore((s) => s.deadlineAt);
  const selectedOptionId = useGameStore((s) => s.selectedOptionId);
  const answerSubmitted = useGameStore((s) => s.answerSubmitted);
  const correctOptionId = useGameStore((s) => s.correctOptionId);
  const personalResult = useGameStore((s) => s.personalResult);
  const rankings = useGameStore((s) => s.rankings);
  const isFinalRanking = useGameStore((s) => s.isFinalRanking);
  const podium = useGameStore((s) => s.podium);
  const totalPlayers = useGameStore((s) => s.totalPlayers);
  const previousRankings = useGameStore((s) => s.previousRankings);

  const personalRanking = rankings.find((r) => r.playerId === playerId);

  // Track reconnection restoration for P16 toast
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const prevConnectionState = useRef(connectionState);

  useEffect(() => {
    if (prevConnectionState.current === 'reconnecting' && connectionState === 'connected') {
      setShowRestoredToast(true);
      const timer = setTimeout(() => setShowRestoredToast(false), 3500);
      return () => clearTimeout(timer);
    }
    prevConnectionState.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
    if (!pin) {
      navigate('/');
      return;
    }

    if (connectionState === 'disconnected' && manager.state === 'disconnected') {
      const savedToken = localStorage.getItem(`batalha_session_${pin}`);
      if (savedToken) {
        connect(pin, savedToken);
      } else if (!playerId) {
        navigate(`/join/${pin}`, { replace: true });
      }
    }
  }, [pin, connectionState, playerId, connect, manager, navigate]);

  const isArenaActive = Boolean(roomState);

  // Sync body and documentElement background color based on game state (dark for pre-game connection, ivory for player arena)
  useEffect(() => {
    if (isArenaActive) {
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
  }, [isArenaActive]);

  const isConnected = connectionState === 'connected' || manager.state === 'connected';
  if (!isConnected && (connectionState === 'disconnected' || connectionState === 'connecting')) {
    return (
      <div className="min-h-screen dark-arena-bg text-[#FAF7F2] flex items-center justify-center p-4 text-center select-none">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-3 border-[#1FD4A7] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm sm:text-base font-bold text-slate-300">Conectando à arena...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (roomState) {
      case 'LOBBY':
        return <PlayerLobby nickname={nickname} totalPlayers={totalPlayers} />;
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
          />
        );
      case 'QUESTION_REVEAL':
        return (
          <PlayerReveal
            result={personalResult}
            correctOptionId={correctOptionId}
            question={currentQuestion}
          />
        );
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
        return (
          <div className="flex-1 flex items-center justify-center text-slate-300">
            Aguarde o próximo comando da arena...
          </div>
        );
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isArenaActive ? 'gameplay-canvas bg-[#FAF8F3] text-[#122017]' : 'dark-arena-bg text-[#FAF7F2]'
      } flex flex-col relative overflow-x-hidden`}
    >
      {/* P15: Reconnect Overlay (System layer over the battle) */}
      <ReconnectOverlay isReconnecting={connectionState === 'reconnecting'} isGameplay={isArenaActive} />

      {/* P16: Connection Restored Toast */}
      <ConnectionRestoredToast show={showRestoredToast} />

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col min-h-0 w-full">
        {renderContent()}
      </main>
    </div>
  );
}

export default PlayerPage;

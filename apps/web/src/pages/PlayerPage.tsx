import { useEffect } from 'react';
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

  const personalRanking = rankings.find(r => r.playerId === playerId);

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

  const isConnected = connectionState === 'connected' || manager.state === 'connected';
  if (!isConnected && (connectionState === 'disconnected' || connectionState === 'connecting')) {
    return (
      <div className="min-h-screen bg-[#080C11] text-[#FAF7F2] flex items-center justify-center p-4 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-3 border-[#1FD4A7] border-t-transparent rounded-full animate-spin" />
          <p className="text-base font-bold text-slate-300">Conectando ao jogo...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (roomState) {
      case 'LOBBY':
        return <PlayerLobby nickname={nickname} />;
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
        return <PlayerReveal result={personalResult} correctOptionId={correctOptionId} question={currentQuestion} />;
      case 'ROUND_RANKING':
      case 'FINAL_RANKING':
        return <PlayerRanking ranking={personalRanking} isFinal={isFinalRanking} />;
      case 'PODIUM':
        return <PlayerPodium podium={podium} playerId={playerId} />;
      case 'FINISHED':
        return <PlayerFinished ranking={personalRanking} />;
      default:
        return <div className="flex-1 flex items-center justify-center text-white">Aguarde...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#080C11] text-[#FAF7F2] flex flex-col relative overflow-hidden">
      <ReconnectOverlay isReconnecting={connectionState === 'reconnecting'} />
      {roomState !== 'LOBBY' && (
        <header className="p-3 bg-[#0E1522] flex justify-between items-center text-xs sm:text-sm border-b border-white/10">
          <span className="font-mono font-bold text-slate-300">PIN: {pin}</span>
          <span className="font-bold text-[#1FD4A7] bg-[#123829] border border-[#1FD4A7]/30 px-3 py-0.5 rounded-full">
            {nickname || 'Jogador'}
          </span>
        </header>
      )}
      <main className="flex-1 flex flex-col p-4">
        {renderContent()}
      </main>
    </div>
  );
}

export default PlayerPage;

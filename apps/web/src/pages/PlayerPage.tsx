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
import { wsManager } from '../lib/ws.js';

export function PlayerPage() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const { connect, connectionState } = useGameSocket();

  const roomState = useGameStore((s) => s.roomState);
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

    if (connectionState === 'disconnected' && wsManager.state === 'disconnected') {
      const savedToken = localStorage.getItem(`batalha_session_${pin}`);
      if (savedToken) {
        connect(pin, 'player', savedToken);
      } else if (!playerId) {
        navigate(`/join/${pin}`, { replace: true });
      }
    }
  }, [pin, connectionState, playerId, connect, navigate]);

  const isConnected = connectionState === 'connected' || wsManager.state === 'connected';
  if (!isConnected && (connectionState === 'disconnected' || connectionState === 'connecting')) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] text-white flex items-center justify-center p-4 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xl font-bold">Conectando ao jogo...</p>
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
    <div className="min-h-screen bg-[#1e3a5f] text-white flex flex-col relative overflow-hidden">
      <ReconnectOverlay isReconnecting={connectionState === 'reconnecting'} />
      <header className="p-3 bg-black/20 flex justify-between items-center text-sm border-b border-white/10">
        <span className="font-bold text-blue-200">PIN: {pin}</span>
        <span className="font-bold bg-blue-600/40 px-3 py-1 rounded-full">{nickname || 'Jogador'}</span>
      </header>
      <main className="flex-1 flex flex-col p-4">
        {renderContent()}
      </main>
    </div>
  );
}

export default PlayerPage;

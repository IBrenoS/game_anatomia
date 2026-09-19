import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useGameStore } from '../stores/gameStore.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import ScreenLobby from '../components/screen/ScreenLobby.js';
import ScreenQuestion from '../components/screen/ScreenQuestion.js';
import ScreenReveal from '../components/screen/ScreenReveal.js';
import ScreenRanking from '../components/screen/ScreenRanking.js';
import ScreenPodium from '../components/screen/ScreenPodium.js';
import CountdownDisplay from '../components/shared/CountdownDisplay.js';

export function ScreenPage() {
  const { pin: routePin } = useParams<{ pin: string }>();
  const [searchParams] = useSearchParams();
  const pin = routePin || searchParams.get('pin') || '';
  const { connect, connectionState } = useGameSocket('screen');

  const roomState = useGameStore((s) => s.roomState);
  const players = useGameStore((s) => s.players);
  const presences = useGameStore((s) => s.presences);
  const currentQuestionIndex = useGameStore((s) => s.currentQuestionIndex);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const startedAt = useGameStore((s) => s.startedAt);
  const deadlineAt = useGameStore((s) => s.deadlineAt);
  const distribution = useGameStore((s) => s.distribution);
  const correctOptionId = useGameStore((s) => s.correctOptionId);
  const explanation = useGameStore((s) => s.explanation);
  const rankings = useGameStore((s) => s.rankings);
  const isFinalRanking = useGameStore((s) => s.isFinalRanking);
  const podium = useGameStore((s) => s.podium);

  useEffect(() => {
    if (pin) {
      connect(pin);
    }
  }, [pin, connect]);

  if (connectionState === 'disconnected' || connectionState === 'connecting') {
    return (
      <div className="min-h-screen bg-[#1e3a5f] text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-3xl font-black">Conectando ao Telão do Jogo...</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (roomState) {
      case 'LOBBY':
        return <ScreenLobby players={players} presences={presences} pin={pin || ''} />;
      case 'COUNTDOWN':
        return <CountdownDisplay mode="screen" />;
      case 'QUESTION_ACTIVE':
      case 'PAUSED':
        return (
          <ScreenQuestion
            question={currentQuestion}
            currentQuestionIndex={currentQuestionIndex}
            startedAt={startedAt}
            deadlineAt={deadlineAt}
          />
        );
      case 'QUESTION_REVEAL':
        return (
          <ScreenReveal
            question={currentQuestion}
            distribution={distribution}
            correctOptionId={correctOptionId}
            explanation={explanation}
          />
        );
      case 'ROUND_RANKING':
      case 'FINAL_RANKING':
        return <ScreenRanking rankings={rankings} isFinal={isFinalRanking} />;
      case 'PODIUM':
        return <ScreenPodium podium={podium} />;
      case 'FINISHED':
        return (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <h2 className="text-7xl font-black text-white">Fim de Jogo!</h2>
            <p className="text-3xl text-blue-200">Parabéns a todos os participantes!</p>
          </div>
        );
      default:
        return <div className="flex-1 flex items-center justify-center text-white text-2xl">Aguardando...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col overflow-hidden select-none">
      <main className="flex-1 flex flex-col">
        {renderContent()}
      </main>
    </div>
  );
}

export default ScreenPage;

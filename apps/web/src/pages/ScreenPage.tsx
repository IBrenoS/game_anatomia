import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useGameStore } from '../stores/gameStore.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import ScreenLobby from '../components/screen/ScreenLobby.js';
import ScreenQuestion from '../components/screen/ScreenQuestion.js';
import ScreenReveal from '../components/screen/ScreenReveal.js';
import ScreenRanking from '../components/screen/ScreenRanking.js';
import ScreenPodium from '../components/screen/ScreenPodium.js';
import ScreenFinished from '../components/screen/ScreenFinished.js';
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

  const isGameplay = Boolean(roomState && roomState !== 'LOBBY');

  // Synchronize document body and element background colors
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

  const isReconnecting = connectionState === 'disconnected' || connectionState === 'connecting';

  // If disconnected before any game state is received, show full-screen connecting state
  if (isReconnecting && !roomState) {
    return (
      <div className="min-h-screen dark-arena-bg bg-[#080C11] text-[#FAF7F2] flex flex-col items-center justify-center space-y-4 p-8 select-none">
        <div className="w-14 h-14 border-4 border-[#1FD4A7] border-t-transparent rounded-full animate-spin" />
        <h2 className="text-3xl md:text-4xl font-black tracking-tight">Conectando ao Telão da Arena...</h2>
        <p className="text-lg md:text-xl text-slate-400 font-medium">
          Sincronizando com a sala {pin}...
        </p>
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
        return <ScreenRanking rankings={rankings} isFinal={false} />;
      case 'FINAL_RANKING':
        return <ScreenRanking rankings={rankings} isFinal={true} />;
      case 'PODIUM':
        return <ScreenPodium podium={podium} />;
      case 'FINISHED':
        return <ScreenFinished />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center text-center p-8 text-2xl font-bold text-[#555E57]">
            Aguardando próximo comando da arena...
          </div>
        );
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isGameplay
          ? 'gameplay-canvas bg-[#FAF8F3] text-[#122017]'
          : 'dark-arena-bg bg-[#080C11] text-[#FAF7F2]'
      } flex flex-col overflow-hidden select-none relative`}
    >
      {/* Pre-game ambient lighting orbs */}
      {!isGameplay && (
        <>
          <div
            className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#123829]/20 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#D05F36]/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
        </>
      )}

      {/* Non-disruptive reconnection banner during active gameplay */}
      {isReconnecting && roomState && (
        <div
          role="status"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-[#123829] text-[#FAF7F2] border border-[#1FD4A7]/40 px-6 py-2 rounded-full shadow-lg flex items-center gap-3 text-sm lg:text-base font-bold animate-fade-in-scale"
        >
          <span className="w-3 h-3 rounded-full bg-[#1FD4A7] animate-ping" />
          <span>Reconectando ao Telão da Arena...</span>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-0">
        {renderContent()}
      </main>
    </div>
  );
}

export default ScreenPage;

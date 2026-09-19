import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ServerEventType } from '@batalha/protocol';
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
import CountdownDisplay from '../components/shared/CountdownDisplay.js';

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
  const totalPlayers = useGameStore((s) => s.totalPlayers);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
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

  const primaryConnectionState = competitiveView
    ? playerSocket.connectionState
    : hostSocket.connectionState;

  if (primaryConnectionState === 'disconnected' || primaryConnectionState === 'connecting') {
    return <div className="min-h-screen bg-[#1e3a5f] text-white flex items-center justify-center">Conectando à sala...</div>;
  }

  const renderPresenterFinished = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
      <span className="text-6xl">🏁</span>
      <h2 className="text-4xl font-black text-white">Partida Encerrada</h2>
      <p className="text-blue-200 text-lg max-w-md">
        A batalha foi concluída com sucesso. Você pode iniciar uma nova partida ou voltar ao início.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => {
            hostSocket.disconnect();
            useGameStore.getState().resetStore();
            navigate('/host');
          }}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl shadow transition-all cursor-pointer"
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
          className="px-6 py-3 bg-white/10 hover:bg-white/20 font-bold text-white rounded-xl transition-all cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    if (roomState === 'LOBBY') {
      return <HostLobby players={players} presences={presences} pin={pin} />;
    }

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
          return <div className="flex-1 flex items-center justify-center text-white">Aguardando estado do jogo...</div>;
      }
    }

    switch (roomState) {
      case 'COUNTDOWN':
        return <CountdownDisplay mode="host" />;
      case 'QUESTION_ACTIVE':
      case 'PAUSED':
        return <HostQuestion question={currentQuestion} currentQuestionIndex={currentQuestionIndex} startedAt={startedAt} deadlineAt={deadlineAt} />;
      case 'QUESTION_REVEAL':
        return <HostReveal question={currentQuestion} distribution={distribution} correctOptionId={correctOptionId} explanation={explanation} />;
      case 'ROUND_RANKING':
      case 'FINAL_RANKING':
        return <HostRanking rankings={rankings} isFinal={isFinalRanking} />;
      case 'PODIUM':
        return <HostPodium podium={podium} />;
      case 'FINISHED':
        return renderPresenterFinished();
      default:
        return <div className="flex-1 flex items-center justify-center text-white">Aguardando estado do jogo...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col">
      <ReconnectOverlay isReconnecting={competitiveView && playerSocket.connectionState === 'reconnecting'} />
      <header className="p-4 bg-black/20 flex justify-between items-center text-white border-b border-white/10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            {competitiveView ? `Host + Player${nickname ? ` — ${nickname}` : ''}` : 'Apresentador'} — Sala PIN: {pin}
          </h1>
          {pin && (
            <a
              href={`/screen/${pin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-blue-400/30"
              title="Abrir Telão da Arena em nova aba"
            >
              <span>📺</span>
              <span>Abrir Telão</span>
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-blue-200">
          <span className={`w-2.5 h-2.5 rounded-full ${connectedPlayers > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span><strong className="text-white font-bold">{totalPlayers}</strong> participantes • <strong className="text-white font-bold">{connectedPlayers}</strong> conectados</span>
        </div>
      </header>

      {restorationError && (
        <div role="alert" className="m-4 rounded-xl border border-amber-400/50 bg-amber-950/80 p-3 text-center font-bold text-amber-100">
          {restorationError}
        </div>
      )}

      <main className="flex-1 flex flex-col p-6">
        {renderContent()}
      </main>

      <footer className="p-4 bg-black/20 border-t border-white/10">
        <HostControls roomState={roomState} adminConnectionState={hostSocket.connectionState} />
      </footer>
    </div>
  );
}

export default HostPage;

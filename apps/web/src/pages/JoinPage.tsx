import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { checkRoom } from '../lib/api.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { useGameStore } from '../stores/gameStore.js';
import { wsManager } from '../lib/ws.js';
import { ServerEventType, ProtocolError } from '@batalha/protocol';

export function JoinPage() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [isValidRoom, setIsValidRoom] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const { connect } = useGameSocket();
  const playerId = useGameStore(s => s.playerId);
  const connectionState = useGameStore(s => s.connectionState);

  // Check room existence on mount
  useEffect(() => {
    if (!pin) {
      navigate('/');
      return;
    }
    (async () => {
      try {
        const room = await checkRoom(pin);
        if (!room) {
          setError('Sala não encontrada.');
          setIsValidRoom(false);
        } else if (room.status === 'FINISHED') {
          setError('Esta partida já foi encerrada.');
          setIsValidRoom(false);
          localStorage.removeItem(`batalha_session_${pin}`);
        } else {
          setIsValidRoom(true);
          // Auto-reconnect if we have a saved session
          const savedToken = localStorage.getItem(`batalha_session_${pin}`);
          if (savedToken) {
            setIsJoining(true);
            connect(pin, 'player');
            // Once connected, send RESUME_SESSION
            const unsub = wsManager.onStateChange((state) => {
              if (state === 'connected') {
                wsManager.resumeSession(pin, savedToken);
                unsub();
              }
            });
          }
        }
      } catch {
        setError('Erro ao verificar a sala.');
        setIsValidRoom(false);
      } finally {
        setIsChecking(false);
      }
    })();
  }, [pin]);

  // Navigate to play page when session is established
  useEffect(() => {
    if (playerId && (connectionState === 'connected' || wsManager.state === 'connected')) {
      navigate(`/play/${pin}`, { replace: true });
    }
  }, [playerId, connectionState, navigate, pin]);

  // Listen for errors from server
  useEffect(() => {
    const unsub = wsManager.onEvent(ServerEventType.ERROR, (payload) => {
      setIsJoining(false);
      const msg = payload.message || 'Erro ao entrar na sala.';
      if (payload.code === ProtocolError.NICKNAME_TAKEN) {
        setError('Este apelido já está em uso. Escolha outro.');
      } else if (payload.code === ProtocolError.ROOM_FULL) {
        setError('A sala está cheia (máximo 50 jogadores).');
      } else if (payload.code === ProtocolError.ROOM_LOCKED) {
        setError('As entradas estão bloqueadas pelo apresentador.');
      } else {
        setError(msg);
      }
    });
    return unsub;
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    const trimmed = nickname.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError('O apelido deve ter entre 2 e 20 caracteres.');
      return;
    }

    setError('');
    setIsJoining(true);

    // Connect WebSocket, then send JOIN_ROOM once connected
    if (wsManager.state === 'connected') {
      wsManager.joinRoom(pin, trimmed);
    } else {
      connect(pin, 'player');
      const unsub = wsManager.onStateChange((state) => {
        if (state === 'connected') {
          wsManager.joinRoom(pin, trimmed);
          unsub();
        }
      });
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin motion-reduce:animate-none" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1e3a5f] via-[#152a45] to-[#0f1d30] text-white flex flex-col justify-between p-4 md:p-8">
      <header className="w-full max-w-md mx-auto flex justify-center py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-blue-200">
          <span>🐎 Bovino × Equino 🐂</span>
        </div>
      </header>

      <main className="w-full max-w-md mx-auto my-auto flex flex-col items-center">
        <div className="w-full bg-[#152a45] p-6 sm:p-8 rounded-3xl shadow-2xl border border-blue-900/50 flex flex-col items-center space-y-6">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-black mb-1 flex items-center justify-center gap-2">
              <span role="img" aria-label="Anatomia">🦴</span>
              <span>Batalha Anatômica</span>
            </h1>
            <p className="text-xs uppercase tracking-widest text-blue-300 font-bold mb-3">
              PIN da Arena
            </p>
            <div className="text-4xl font-mono font-black tracking-widest text-yellow-300 bg-black/30 py-2 px-4 rounded-xl border border-white/10" aria-label={`PIN: ${pin}`}>
              {pin}
            </div>
          </div>

          {!isValidRoom ? (
            <div className="w-full text-center p-5 bg-red-950/70 border border-red-500/50 rounded-2xl text-red-200 space-y-4" role="alert">
              <p className="font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-2.5 px-4 bg-red-800 hover:bg-red-700 rounded-xl font-bold transition-all shadow cursor-pointer"
              >
                Digitar outro PIN
              </button>
            </div>
          ) : (
          <form onSubmit={handleJoin} className="w-full space-y-6 flex flex-col">
            <p className="text-blue-200 text-sm text-center">
              Seu apelido será visível no telão e apagado após o fim do jogo.
            </p>
            <div className="space-y-2">
              <label htmlFor="nickname" className="block text-blue-100 font-medium">
                Seu Apelido
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setError(''); }}
                placeholder="Ex: João Silva"
                className="w-full p-4 bg-white text-gray-900 rounded-xl text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-500 placeholder-gray-400 shadow-inner"
                minLength={2}
                maxLength={20}
                autoComplete="off"
                required
                aria-describedby={error ? 'nickname-error' : undefined}
              />
              {error && (
                <p id="nickname-error" className="text-red-400 text-sm mt-2" role="alert">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isJoining}
              className="w-full min-h-[52px] py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-slate-700 disabled:to-slate-800 disabled:opacity-50 text-white text-xl font-black rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait"
            >
              {isJoining ? (
                <>
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin motion-reduce:animate-none" aria-label="Conectando" />
                  <span>Entrando na arena...</span>
                </>
              ) : (
                <>
                  <span>Entrar na arena</span>
                  <span>➔</span>
                </>
              )}
            </button>
          </form>
        )}
        </div>
      </main>

      <footer className="w-full max-w-md mx-auto py-6 text-center border-t border-blue-900/40 text-xs text-blue-300/80">
        <p>
          Entrou no PIN errado?{' '}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-white hover:text-yellow-300 font-bold underline transition-colors underline-offset-2"
          >
            Trocar PIN
          </button>
        </p>
      </footer>
    </div>
  );
}

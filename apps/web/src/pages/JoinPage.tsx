import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { checkRoom } from '../lib/api.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { useGameStore } from '../stores/gameStore.js';
import { ServerEventType, ProtocolError } from '@batalha/protocol';

export function JoinPage() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [isValidRoom, setIsValidRoom] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const { manager, connect, connectionState } = useGameSocket('player');
  const playerId = useGameStore(s => s.playerId);

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
            connect(pin, savedToken);
            // Once connected, send RESUME_SESSION
            const unsub = manager.onStateChange((state) => {
              if (state === 'connected') {
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
  }, [connect, manager, navigate, pin]);

  // Navigate to play page when session is established
  useEffect(() => {
    if (playerId && (connectionState === 'connected' || manager.state === 'connected')) {
      navigate(`/play/${pin}`, { replace: true });
    }
  }, [playerId, connectionState, manager, navigate, pin]);

  // Listen for errors from server
  useEffect(() => {
    const unsub = manager.onEvent(ServerEventType.ERROR, (payload) => {
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
  }, [manager]);

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
    if (manager.state === 'connected') {
      manager.joinRoom(pin, trimmed);
    } else {
      connect(pin);
      const unsub = manager.onStateChange((state) => {
        if (state === 'connected') {
          manager.joinRoom(pin, trimmed);
          unsub();
        }
      });
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#080C11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#1FD4A7] border-t-transparent rounded-full animate-spin motion-reduce:animate-none" aria-label="Carregando" />
          <span className="text-xs font-bold text-slate-400">Verificando a sala...</span>
        </div>
      </div>
    );
  }

  const formattedPin = pin && pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;

  return (
    <div className="min-h-screen bg-[#080C11] text-[#FAF7F2] flex flex-col justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden">
      {/* Background ambient light */}
      <div 
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#123829]/20 blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#D05F36]/10 blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between z-10">
        <header className="w-full flex justify-between items-center py-4 select-none">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-black tracking-widest text-white uppercase">
              BATALHA ANATÔMICA
            </span>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-slate-400 uppercase">
              BOVINO <span className="text-[#D05F36]">×</span> EQUINO
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#123829]/60 border border-[#1FD4A7]/30 text-[#1FD4A7] text-xs font-bold font-mono">
            <span>PIN {formattedPin}</span>
          </div>
        </header>

        <main className="w-full my-auto py-8 animate-[fadeInScale_0.3s_ease-out]">
          <div className="space-y-2 mb-6 text-left">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Entrar na batalha
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Digite seu nome ou apelido para participar.
            </p>
          </div>

          {!isValidRoom ? (
            <div className="w-full text-center p-6 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-rose-200 space-y-4" role="alert">
              <p className="text-sm font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => navigate('/?step=join')}
                className="w-full py-3 px-4 bg-[#151F2E] hover:bg-[#1C293D] rounded-xl text-xs font-bold text-white transition-all border border-white/10 cursor-pointer"
              >
                Digitar outro PIN
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="w-full space-y-5 flex flex-col">
              <div className="space-y-2">
                <label htmlFor="nickname" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Seu apelido
                </label>
                <div className="w-full bg-[#FAF7F2] rounded-xl p-3.5 shadow-xl border border-white/20 focus-within:ring-4 focus-within:ring-[#1FD4A7]/50 transition-all">
                  <input
                    id="nickname"
                    type="text"
                    aria-label="Seu apelido"
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); setError(''); }}
                    placeholder="Ex: João Silva"
                    className="w-full bg-transparent text-[#080C11] font-bold text-base sm:text-lg outline-none placeholder:text-slate-400"
                    minLength={2}
                    maxLength={20}
                    autoComplete="off"
                    required
                    autoFocus
                    aria-describedby={error ? 'nickname-error' : undefined}
                  />
                </div>
                {error && (
                  <p id="nickname-error" className="text-xs text-rose-400 font-medium mt-1" role="alert">
                    {error}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Seu nome aparecerá no telão e no ranking da partida.
                </p>
              </div>

              <button
                type="submit"
                aria-label={isJoining ? 'Entrando na arena' : 'Entrar para jogar — Entrar na arena'}
                disabled={isJoining || nickname.trim().length < 2}
                className="w-full py-4 px-6 rounded-xl bg-[#1FD4A7] hover:bg-[#19C298] disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-50 text-[#080C11] font-black text-base tracking-wide shadow-[0_4px_20px_rgba(31,212,167,0.25)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isJoining ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[#080C11] border-t-transparent rounded-full animate-spin motion-reduce:animate-none" aria-label="Conectando" />
                    <span>Entrando na arena...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar para jogar</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/?step=join')}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>←</span>
              <span>Trocar PIN</span>
            </button>
          </div>
        </main>

        <footer className="w-full py-4 text-center text-xs text-slate-500">
          <span>Batalha Anatômica • Medicina Veterinária</span>
        </footer>
      </div>
    </div>
  );
}

export default JoinPage;

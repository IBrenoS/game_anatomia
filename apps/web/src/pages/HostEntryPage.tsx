import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { createRoom } from '../lib/api.js';
import { useGameStore } from '../stores/gameStore.js';
import {
  joinCreatedRoomAsPlayer,
  PlayerJoinError,
  setHostParticipation,
  type HostParticipationMode,
} from '../lib/hostParticipation.js';
import { getWebSocketManager } from '../lib/ws.js';
import BrandHeader from '../components/shared/BrandHeader.js';

export const HostEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<HostParticipationMode | null>('player');
  const [nickname, setNickname] = useState('');
  const [creationStatus, setCreationStatus] = useState<
    'idle' | 'creating-room' | 'joining-player' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<{ pin: string; joinUrl: string } | null>(null);

  const handleStartBattle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creationStatus === 'creating-room' || creationStatus === 'joining-player') return;

    if (!mode) {
      setErrorMessage('Escolha como você vai participar.');
      return;
    }

    const normalizedNickname = nickname.trim().replace(/\s+/g, ' ');
    if (mode === 'player') {
      if (normalizedNickname.length < 2 || normalizedNickname.length > 20) {
        setErrorMessage('O apelido deve ter entre 2 e 20 caracteres.');
        return;
      }
    }

    setErrorMessage(null);

    try {
      setCreationStatus(createdRoom ? 'joining-player' : 'creating-room');
      const room = createdRoom ?? (await createRoom());
      if (!createdRoom) setCreatedRoom(room);

      useGameStore.getState().setHostData(room);

      if (mode === 'player') {
        setCreationStatus('joining-player');
        await joinCreatedRoomAsPlayer(room.pin, normalizedNickname, getWebSocketManager('player'));
      }

      setHostParticipation(room.pin, mode);

      navigate(`/host/${room.pin}`);
    } catch (err) {
      console.error('Falha ao iniciar batalha:', err);
      setCreationStatus('error');
      setErrorMessage(
        err instanceof PlayerJoinError
          ? err.message
          : err instanceof Error && err.message
          ? err.message
          : 'Não foi possível conectar ao servidor para criar a sala. Verifique sua conexão e tente novamente.',
      );
    }
  };

  const isSubmitting = creationStatus === 'creating-room' || creationStatus === 'joining-player';

  return (
    <div className="min-h-screen bg-[#080C11] text-[#FAF7F2] flex flex-col justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden">
      {/* Ambient background lighting */}
      <div 
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#123829]/20 blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#D05F36]/10 blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between z-10">
        {/* Brand Header */}
        <BrandHeader showArenaStatus={false} />

        {/* Main Creation Flow (Tela 4) */}
        <main className="w-full max-w-2xl mx-auto my-auto py-8 sm:py-12 animate-[fadeInScale_0.3s_ease-out]">
          <div className="space-y-2 mb-8 text-left">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
              Criar nova batalha
            </h1>
            <p className="text-sm sm:text-base text-slate-400">
              Como você vai participar?
            </p>
          </div>

          <form onSubmit={handleStartBattle} className="space-y-6">
            {errorMessage && (
              <div 
                role="alert" 
                className="w-full p-4 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-200 text-xs sm:text-sm"
              >
                {errorMessage}
              </div>
            )}

            {/* Participation Mode Selection Blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Também vou jogar */}
              <button
                type="button"
                aria-pressed={mode === 'player'}
                onClick={() => {
                  setMode('player');
                  setErrorMessage(null);
                }}
                className={`w-full p-5 rounded-2xl border text-left transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-col justify-between min-h-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C11] ${
                  mode === 'player'
                    ? 'border-[#1FD4A7] bg-[#123829]/40 ring-1 ring-[#1FD4A7]/50 shadow-[0_0_20px_rgba(31,212,167,0.15)]'
                    : 'border-white/10 bg-[#0E1522] hover:bg-[#151F2E] hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Também vou jogar
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1">
                      Você cria e compete.
                    </p>
                  </div>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                    mode === 'player' ? 'border-[#1FD4A7] bg-[#1FD4A7] text-[#080C11]' : 'border-white/30 bg-white/5'
                  }`}>
                    {mode === 'player' && (
                      <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                </div>

                {mode === 'player' ? (
                  <span className="self-start mt-3 text-[10px] font-black uppercase tracking-wider text-[#1FD4A7] bg-[#1FD4A7]/15 px-2.5 py-0.5 rounded flex items-center gap-1">
                    <span>✓</span> SELECIONADO
                  </span>
                ) : (
                  <span className="self-start mt-3 text-[10px] font-medium text-slate-400">
                    Selecionar
                  </span>
                )}
              </button>

              {/* Option 2: Só vou apresentar */}
              <button
                type="button"
                aria-pressed={mode === 'presenter'}
                onClick={() => {
                  setMode('presenter');
                  setErrorMessage(null);
                }}
                className={`w-full p-5 rounded-2xl border text-left transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-col justify-between min-h-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C11] ${
                  mode === 'presenter'
                    ? 'border-[#1FD4A7] bg-[#123829]/40 ring-1 ring-[#1FD4A7]/50 shadow-[0_0_20px_rgba(31,212,167,0.15)]'
                    : 'border-white/10 bg-[#0E1522] hover:bg-[#151F2E] hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Só vou apresentar
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1">
                      Você controla sem competir.
                    </p>
                  </div>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                    mode === 'presenter' ? 'border-[#1FD4A7] bg-[#1FD4A7] text-[#080C11]' : 'border-white/30 bg-white/5'
                  }`}>
                    {mode === 'presenter' && (
                      <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                </div>

                {mode === 'presenter' ? (
                  <span className="self-start mt-3 text-[10px] font-black uppercase tracking-wider text-[#1FD4A7] bg-[#1FD4A7]/15 px-2.5 py-0.5 rounded flex items-center gap-1">
                    <span>✓</span> SELECIONADO
                  </span>
                ) : (
                  <span className="self-start mt-3 text-[10px] font-medium text-slate-400">
                    Selecionar
                  </span>
                )}
              </button>
            </div>

            {/* Name input (only when "Também vou jogar" is active) */}
            {mode === 'player' && (
              <div className="space-y-2 pt-2 animate-[fadeInScale_0.2s_ease-out]">
                <label 
                  htmlFor="host-nickname" 
                  className="block text-xs font-bold uppercase tracking-wider text-slate-300"
                >
                  Seu nome
                </label>

                <div className="w-full bg-[#FAF7F2] rounded-xl p-3.5 shadow-xl border border-white/20 focus-within:ring-4 focus-within:ring-[#1FD4A7]/50 focus-within:border-[#1FD4A7] transition-all duration-200">
                  <input
                    id="host-nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => {
                      setNickname(e.target.value);
                      setErrorMessage(null);
                    }}
                    minLength={2}
                    maxLength={20}
                    autoComplete="nickname"
                    placeholder="Ex.: Breno"
                    required
                    className="w-full bg-transparent text-[#080C11] font-bold text-base sm:text-lg outline-none placeholder:text-slate-400"
                  />
                </div>

                <p className="text-xs text-slate-400">
                  Seu nome aparecerá no ranking e no pódio.
                </p>
              </div>
            )}

            {/* Action CTA Button */}
            <div className="pt-4">
              <button
                type="submit"
                aria-label="Criar partida"
                disabled={isSubmitting || !mode || (mode === 'player' && nickname.trim().length < 2)}
                className="w-full py-4 px-6 rounded-xl bg-[#1FD4A7] hover:bg-[#19C298] disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-50 text-[#080C11] font-black text-base tracking-wide shadow-[0_4px_20px_rgba(31,212,167,0.25)] transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C11]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[#080C11] border-t-transparent rounded-full animate-spin" />
                    <span>
                      {creationStatus === 'joining-player' ? 'Entrando na sala...' : 'Criando a sala...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>Criar partida</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Back Navigation */}
          <div className="mt-12 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/?step=choice')}
              className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1FD4A7] rounded px-1"
            >
              <span>←</span>
              <span>Voltar</span>
            </button>
          </div>
        </main>

      </div>
    </div>
  );
};

export default HostEntryPage;

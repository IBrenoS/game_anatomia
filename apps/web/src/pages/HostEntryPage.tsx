import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { createRoom } from '../lib/api.js';
import { useGameStore } from '../stores/gameStore.js';

export const HostEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const [creationStatus, setCreationStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartBattle = async () => {
    if (creationStatus === 'creating') return;

    setCreationStatus('creating');
    setErrorMessage(null);

    try {
      const { pin, joinUrl } = await createRoom();
      
      useGameStore.getState().setHostData({ joinUrl, pin });

      // Navigate to host management room
      navigate(`/host/${pin}`);
    } catch (err) {
      console.error('Falha ao iniciar batalha:', err);
      setCreationStatus('error');
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível conectar ao servidor para criar a arena. Verifique sua conexão e tente novamente.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1e3a5f] via-[#152a45] to-[#0f1d30] text-white flex flex-col justify-between p-4 md:p-8">
      {/* Header */}
      <header className="w-full max-w-4xl mx-auto flex justify-between items-center py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label="Anatomia">🦴</span>
          <div>
            <span className="text-xs uppercase tracking-widest text-blue-300 font-bold block">
              Ambiente do Apresentador
            </span>
            <span className="text-lg font-black tracking-tight text-white">
              Batalha Anatômica
            </span>
          </div>
        </div>
        <Link
          to="/"
          className="text-xs sm:text-sm font-semibold text-blue-200 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg"
        >
          Modo Participante
        </Link>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto my-auto py-8 flex flex-col items-center">
        {/* Arena Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs sm:text-sm font-bold uppercase tracking-wider mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Arena Pronta para Transmissão
        </div>

        {/* Confrontation Title */}
        <div className="text-center space-y-4 max-w-2xl mb-10">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-lg">
            Bovino <span className="text-yellow-400 text-3xl sm:text-4xl md:text-5xl">×</span> Equino
          </h1>
          <p className="text-lg sm:text-xl text-blue-200 font-medium leading-relaxed">
            Duelo anatomofisiológico comparado: músculos dorsais, ventrais e aplicações veterinárias funcionais.
          </p>
        </div>

        {/* Battle Attributes Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-10">
          <div className="bg-[#152a45]/80 backdrop-blur-sm border border-blue-900/50 rounded-2xl p-4 text-center shadow-lg hover:border-blue-700/50 transition-all">
            <div className="text-2xl sm:text-3xl mb-1">🎯</div>
            <div className="text-xl sm:text-2xl font-black text-white">10</div>
            <div className="text-xs sm:text-sm text-blue-300 font-medium">Questões Técnicas</div>
          </div>

          <div className="bg-[#152a45]/80 backdrop-blur-sm border border-blue-900/50 rounded-2xl p-4 text-center shadow-lg hover:border-blue-700/50 transition-all">
            <div className="text-2xl sm:text-3xl mb-1">👥</div>
            <div className="text-xl sm:text-2xl font-black text-white">Até 50</div>
            <div className="text-xs sm:text-sm text-blue-300 font-medium">Competidores</div>
          </div>

          <div className="bg-[#152a45]/80 backdrop-blur-sm border border-blue-900/50 rounded-2xl p-4 text-center shadow-lg hover:border-blue-700/50 transition-all">
            <div className="text-2xl sm:text-3xl mb-1">⏱</div>
            <div className="text-xl sm:text-2xl font-black text-white">10–15</div>
            <div className="text-xs sm:text-sm text-blue-300 font-medium">Minutos de Partida</div>
          </div>

          <div className="bg-[#152a45]/80 backdrop-blur-sm border border-blue-900/50 rounded-2xl p-4 text-center shadow-lg hover:border-blue-700/50 transition-all">
            <div className="text-2xl sm:text-3xl mb-1">⚡</div>
            <div className="text-xl sm:text-2xl font-black text-yellow-300">Tempo Real</div>
            <div className="text-xs sm:text-sm text-blue-300 font-medium">Precisão & Velocidade</div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="w-full max-w-md bg-[#152a45] p-6 sm:p-8 rounded-3xl shadow-2xl border border-blue-800/40 flex flex-col items-center space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-white">Lançar Nova Partida</h2>
            <p className="text-sm text-blue-300">
              Gera a sala, o PIN de 6 dígitos e o QR Code oficial para a turma.
            </p>
          </div>

          {errorMessage && (
            <div 
              role="alert" 
              className="w-full p-4 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-sm text-center"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleStartBattle}
            disabled={creationStatus === 'creating'}
            className="w-full min-h-[56px] py-4 px-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-700 disabled:to-slate-800 disabled:opacity-75 text-white text-xl font-black rounded-2xl shadow-xl shadow-green-950/40 transition-all active:scale-95 cursor-pointer disabled:cursor-wait flex items-center justify-center gap-3"
          >
            {creationStatus === 'creating' ? (
              <>
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
                <span>Preparando a arena...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Iniciar Batalha</span>
              </>
            )}
          </button>

          <p className="text-xs text-blue-400/80 text-center">
            Ao iniciar, você terá acesso ao painel de controle e ao link do telão para projeção.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto py-4 text-center border-t border-white/10 text-xs text-blue-400">
        <p>
          Batalha Anatômica — Bovino × Equino • Modo Apresentador
        </p>
        <p className="mt-1">
          Quer jogar como participante?{' '}
          <Link to="/" className="text-blue-300 hover:text-white underline font-medium">
            Entrar com PIN
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default HostEntryPage;

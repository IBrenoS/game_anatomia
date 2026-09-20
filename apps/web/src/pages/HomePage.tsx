import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import BrandHeader from '../components/shared/BrandHeader.js';
import BovinoEquinoEmblem from '../components/shared/BovinoEquinoEmblem.js';
import QrScannerView from '../components/shared/QrScannerView.js';

type HomeStep = 'welcome' | 'choice' | 'join';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Determine initial step from URL params or pathname
  const initialStep = (): HomeStep => {
    const stepParam = searchParams.get('step');
    if (stepParam === 'choice' || stepParam === 'join') return stepParam;
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/join')) return 'join';
    return 'welcome';
  };

  const [step, setStep] = useState<HomeStep>(initialStep);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Sync state with URL search params
  const navigateToStep = (nextStep: HomeStep) => {
    setStep(nextStep);
    setPinError(null);
    setIsCameraOpen(false);
    if (nextStep === 'welcome') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        navigate('/');
      } else {
        setSearchParams({});
      }
    } else {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        navigate(`/?step=${nextStep}`);
      } else {
        setSearchParams({ step: nextStep });
      }
    }
  };

  // Sync step if search params change via browser back/forward
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam === 'choice') setStep('choice');
    else if (stepParam === 'join') setStep('join');
    else if (!stepParam && window.location.pathname === '/') setStep('welcome');
  }, [searchParams]);

  // Format PIN with space in middle: "529 734"
  const handlePinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPinError(null);
    if (rawDigits.length > 3) {
      setPinValue(`${rawDigits.slice(0, 3)} ${rawDigits.slice(3)}`);
    } else {
      setPinValue(rawDigits);
    }
  };

  const handlePastePin = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').trim();
    if (!text) return;
    setPinError(null);
    const urlMatch = text.match(/join\/(\d{6})/i);
    const pinMatch = urlMatch
      ? urlMatch[1]
      : (text.match(/\b(\d{6})\b/) ? text.match(/\b(\d{6})\b/)![1] : text.replace(/\D/g, '').slice(0, 6));
    if (pinMatch.length > 3) {
      setPinValue(`${pinMatch.slice(0, 3)} ${pinMatch.slice(3)}`);
    } else {
      setPinValue(pinMatch);
    }
  };

  const cleanPin = pinValue.replace(/\s+/g, '');
  const isPinReady = cleanPin.length === 6;

  const handleJoinByPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isPinReady) {
      setPinError('Digite o PIN de 6 dígitos da sala.');
      return;
    }
    navigate(`/join/${cleanPin}`);
  };

  const handleScanSuccess = (scannedPin: string) => {
    navigate(`/join/${scannedPin}`);
  };

  return (
    <div className="min-h-screen bg-[#080C11] text-[#FAF7F2] flex flex-col justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div 
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#123829]/20 blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#D05F36]/10 blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-between z-10">
        {/* Brand Top Header */}
        <BrandHeader showArenaStatus={false} />

        {/* ========================================================
            TELA 1 — ABERTURA
           ======================================================== */}
        {step === 'welcome' && (
          <main className="w-full my-auto py-3 sm:py-6 lg:py-10 animate-[fadeInScale_0.3s_ease-out]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
              {/* Left Column: Hero Text & Main CTA */}
              <div className="lg:col-span-7 flex flex-col items-start space-y-4 sm:space-y-6">
                {/* Veterinary label */}
                <span className="text-xs font-bold uppercase tracking-wider text-[#1FD4A7]">
                  ANATOMIA VETERINÁRIA
                </span>

                {/* Main Display Title */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
                  Conhecimento<br />
                  em modo<br />
                  <span className="text-white">batalha.</span>
                </h1>

                {/* Subtitle */}
                <p className="text-sm sm:text-base text-slate-300 max-w-md font-normal leading-relaxed">
                  Bovino × Equino em uma disputa rápida para jogar em grupo.
                </p>

                {/* Mobile Emblem position */}
                <div className="lg:hidden w-full flex justify-center py-2">
                  <BovinoEquinoEmblem size="sm" />
                </div>

                {/* Dominant Action CTA */}
                <div className="w-full sm:w-auto flex flex-col items-start space-y-3 pt-1 sm:pt-2">
                  <button
                    type="button"
                    onClick={() => navigateToStep('choice')}
                    className="w-full sm:w-auto min-w-[200px] py-3.5 sm:py-4 px-8 sm:px-10 rounded-xl bg-[#1FD4A7] hover:bg-[#19C298] text-[#080C11] font-black text-base sm:text-lg tracking-wide shadow-[0_0_24px_rgba(31,212,167,0.25)] hover:shadow-[0_0_32px_rgba(31,212,167,0.4)] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C11]"
                  >
                    Iniciar
                  </button>

                </div>
              </div>

              {/* Right Column: Free-Floating Graphic Hero Panel (Desktop) */}
              <div className="hidden lg:flex lg:col-span-5 justify-end">
                <BovinoEquinoEmblem size="lg" />
              </div>
            </div>
          </main>
        )}

        {/* ========================================================
            TELA 2 — ESCOLHA DE CAMINHO
           ======================================================== */}
        {step === 'choice' && (
          <main className="w-full my-auto py-8 sm:py-12 animate-[fadeInScale_0.3s_ease-out]">
            <div className="space-y-3 mb-8 sm:mb-12 text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
                Como você quer começar?
              </h1>
            </div>

            {/* Path Selection: Side-by-side on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-stretch">
              {/* CAMINHO 1: JOGAR */}
              <section 
                aria-labelledby="heading-jogar"
                className="flex flex-col justify-between space-y-6 md:border-r md:border-white/10 md:pr-12 border-b md:border-b-0 border-white/10 pb-8 md:pb-0 text-left"
              >
                <div className="space-y-3">
                  <span className="text-xs font-black uppercase tracking-wider text-[#1FD4A7] block">
                    JOGAR
                  </span>
                  <h2 id="heading-jogar" className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Entrar em uma partida
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300">
                    Tenho um PIN ou QR Code.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigateToStep('join')}
                    className="w-full sm:w-auto min-w-[220px] py-3.5 px-6 rounded-xl bg-[#1FD4A7] hover:bg-[#19C298] text-[#080C11] font-bold text-base tracking-wide shadow-[0_4px_16px_rgba(31,212,167,0.2)] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C11]"
                  >
                    <span>Entrar para jogar</span>
                    <span>→</span>
                  </button>
                </div>
              </section>

              {/* CAMINHO 2: CRIAR */}
              <section 
                aria-labelledby="heading-criar"
                className="flex flex-col justify-between space-y-6 text-left"
              >
                <div className="space-y-3">
                  <span className="text-xs font-black uppercase tracking-wider text-[#D05F36] block">
                    CRIAR
                  </span>
                  <h2 id="heading-criar" className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Criar uma nova batalha
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300">
                    Vou organizar e controlar a sala.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/host')}
                    className="w-full sm:w-auto min-w-[220px] py-3.5 px-6 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-white font-bold text-base tracking-wide border border-white/15 hover:border-white/30 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C11]"
                  >
                    <span>Criar partida</span>
                    <span>→</span>
                  </button>
                </div>
              </section>
            </div>

            {/* Back to welcome navigation */}
            <div className="mt-12 pt-6 border-t border-white/10 text-left">
              <button
                type="button"
                onClick={() => navigateToStep('welcome')}
                className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1FD4A7] rounded px-1"
              >
                <span>←</span>
                <span>Voltar</span>
              </button>
            </div>
          </main>
        )}

        {/* ========================================================
            TELA 3 — ENTRAR NA BATALHA (PLAYER PIN & QR)
           ======================================================== */}
        {step === 'join' && (
          <main className="w-full max-w-md mx-auto my-auto py-8 sm:py-12 animate-[fadeInScale_0.3s_ease-out]">
            <div className="space-y-2 mb-6 text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
                Entrar na batalha
              </h1>
              <p className="text-sm sm:text-base text-slate-400">
                Digite o PIN da sala.
              </p>
            </div>

            {/* PIN Entry Form (Primary Action) */}
            <form onSubmit={handleJoinByPin} className="space-y-4">
              <div>
                {/* Prominent White/Ivory Rounded Box */}
                <div className="w-full bg-[#FAF7F2] rounded-2xl p-4 sm:p-5 shadow-2xl border border-white/20 focus-within:ring-4 focus-within:ring-[#1FD4A7]/50 focus-within:border-[#1FD4A7] transition-all duration-200 flex items-center justify-center">
                  <input
                    id="pin-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    placeholder="000 000"
                    value={pinValue}
                    onChange={handlePinInput}
                    onPaste={handlePastePin}
                    maxLength={7}
                    autoFocus
                    aria-label="PIN da sala"
                    className="w-full bg-transparent text-[#080C11] font-mono font-black text-3xl sm:text-4xl text-center tracking-[0.25em] outline-none placeholder:text-slate-400/50"
                  />
                </div>

                <div className="min-h-[1.5rem] mt-1.5 flex items-center">
                  {pinError && (
                    <p className="text-xs text-rose-400 font-medium text-left animate-[fadeInScale_0.15s_ease-out]" role="alert">
                      {pinError}
                    </p>
                  )}
                </div>
              </div>

              {/* Dominant CTA Button */}
              <button
                type="submit"
                disabled={!isPinReady}
                className="w-full py-4 rounded-xl bg-[#1FD4A7] hover:bg-[#19C298] disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-50 text-[#080C11] font-black text-base tracking-wide shadow-[0_4px_20px_rgba(31,212,167,0.25)] transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C11]"
              >
                <span>Entrar</span>
                <span>→</span>
              </button>
            </form>

            {/* Separator Below */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                OU ENTRE PELA CÂMERA
              </span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* QR Scanner Alternative (Discrete, non-competing) */}
            <div className="w-full">
              {!isCameraOpen ? (
                <div className="w-full bg-[#0E1522] rounded-2xl p-4 sm:p-5 border border-white/10 flex items-center justify-between shadow-lg">
                  <div className="space-y-1 text-left">
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Escanear QR Code
                    </h3>
                    <p className="text-xs text-slate-300">
                      Aponte para o código da sala.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="py-2.5 px-4 rounded-xl bg-[#151F2E] hover:bg-[#1C293D] text-white font-bold text-xs tracking-wide border border-white/15 hover:border-white/30 transition-all active:scale-95 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FD4A7]"
                  >
                    Abrir câmera
                  </button>
                </div>
              ) : (
                <QrScannerView 
                  onScanSuccess={handleScanSuccess} 
                  onClose={() => setIsCameraOpen(false)} 
                />
              )}
            </div>

            {/* Back Navigation */}
            <div className="mt-8 pt-6 border-t border-white/10 text-left">
              <button
                type="button"
                onClick={() => navigateToStep('choice')}
                className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>←</span>
                <span>Voltar</span>
              </button>
            </div>
          </main>
        )}

        {/* Footer info */}
        <footer className="w-full py-4 text-center text-xs text-slate-500">
          <span>Batalha Anatômica • Medicina Veterinária</span>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;

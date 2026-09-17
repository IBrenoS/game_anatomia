import React, { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [pinDigits, setPinDigits] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handlePinChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!/^\d?$/.test(value)) return;
    
    const newPin = [...pinDigits];
    newPin[index] = value;
    setPinDigits(newPin);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newPin = [...pinDigits];
    for (let i = 0; i < 6; i++) {
      newPin[i] = pastedData[i] || '';
    }
    setPinDigits(newPin);

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pinDigits.join('');
    if (pin.length === 6) {
      navigate(`/join/${pin}`);
    }
  };

  const isPinComplete = pinDigits.join('').length === 6;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1e3a5f] via-[#152a45] to-[#0f1d30] text-white flex flex-col justify-between p-4 md:p-8">
      {/* Top Brand Bar */}
      <header className="w-full max-w-md mx-auto flex justify-center py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-blue-200">
          <span>🐎 Bovino × Equino 🐂</span>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="w-full max-w-md mx-auto my-auto flex flex-col items-center space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md flex items-center justify-center gap-3">
            <span role="img" aria-label="Osso">🦴</span>
            <span>Batalha Anatômica</span>
          </h1>
          <p className="text-xl sm:text-2xl text-blue-200 font-bold">
            Bovino <span className="text-yellow-400">×</span> Equino
          </p>
          <p className="text-sm text-blue-300/80">
            Digite o PIN fornecido no telão para entrar na arena
          </p>
        </div>

        <form 
          onSubmit={handleJoin} 
          className="w-full bg-[#152a45] p-6 sm:p-8 rounded-3xl shadow-2xl border border-blue-900/50 flex flex-col items-center space-y-8"
        >
          <div className="space-y-4 w-full">
            <label 
              htmlFor="pin-input-0" 
              className="block text-center text-blue-100 font-bold text-lg tracking-wide uppercase"
            >
              PIN da Partida
            </label>
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {pinDigits.map((digit, i) => (
                <input
                  key={i}
                  id={`pin-input-${i}`}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl font-black bg-white text-gray-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-transparent transition-all uppercase shadow-inner"
                  aria-label={`Dígito ${i + 1} do PIN`}
                  autoFocus={i === 0}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!isPinComplete}
            className="w-full min-h-[52px] py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-slate-700 disabled:to-slate-800 disabled:opacity-50 text-white text-xl font-black rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>Entrar na batalha</span>
            <span>➔</span>
          </button>
        </form>
      </main>

      {/* Discrete Presenter Footer */}
      <footer className="w-full max-w-md mx-auto py-6 text-center border-t border-blue-900/40 text-xs sm:text-sm text-blue-300/80">
        <p>
          É o apresentador?{' '}
          <Link 
            to="/host" 
            className="text-white hover:text-yellow-300 font-bold underline transition-colors underline-offset-2"
          >
            Abrir painel
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default HomePage;

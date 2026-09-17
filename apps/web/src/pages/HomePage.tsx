import React, { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { createRoom } from '../lib/api.js';
import { useGameStore } from '../stores/gameStore.js';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const { pin, joinUrl, hostToken } = await createRoom();
      useGameStore.getState().setHostData({ hostToken, joinUrl, pin });
      navigate(`/host/${pin}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar sala. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  };

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

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pinDigits.join('');
    if (pin.length === 6) {
      navigate(`/join/${pin}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e3a5f] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-12">
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
            <span role="img" aria-label="Osso">🦴</span> Batalha Anatômica
          </h1>
          <p className="text-xl md:text-2xl text-blue-200 font-medium">
            Bovino e Equino
          </p>
        </div>

        <form onSubmit={handleJoin} className="w-full bg-[#152a45] p-8 rounded-3xl shadow-2xl border border-blue-900/50 flex flex-col items-center space-y-8">
          <div className="space-y-4 w-full">
            <label className="block text-center text-blue-100 font-medium mb-4 text-lg">
              PIN do Jogo
            </label>
            <div className="flex justify-center gap-2 sm:gap-3">
              {pinDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold bg-white text-gray-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-transparent transition-all uppercase shadow-inner"
                  aria-label={`Dígito ${i + 1} do PIN`}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={pinDigits.join('').length !== 6}
            className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:opacity-50 text-white text-xl font-bold rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            Entrar
          </button>
        </form>

        <div className="w-full flex flex-col items-center space-y-4 pt-8 border-t border-blue-800">
          <p className="text-blue-300">Professor ou Apresentador?</p>
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full max-w-[200px] py-3 bg-transparent border-2 border-blue-400 text-blue-300 hover:bg-blue-400 hover:text-[#1e3a5f] rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {isCreating ? 'Criando...' : 'Criar Jogo'}
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';

export default function ScreenFinished() {
  return (
    <div className="flex-1 flex flex-col justify-between items-center text-center p-6 md:p-10 lg:p-12 select-none w-full max-w-5xl 2xl:max-w-6xl mx-auto animate-fade-in-scale">
      {/* Brand Header */}
      <header className="flex flex-col items-center mb-4 shrink-0">
        <span className="text-xs sm:text-sm font-black tracking-widest text-[#123829] uppercase mb-1">
          BATALHA ANATÔMICA
        </span>
        <span className="text-[10px] sm:text-xs font-bold tracking-wider text-[#648B68] uppercase">
          BOVINO <span className="text-[#D05F36]">×</span> EQUINO
        </span>
      </header>

      {/* Centerpiece */}
      <main className="my-auto flex flex-col items-center justify-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#EAF5EC] border-2 border-[#2D8058]/30 text-[#2D8058] flex items-center justify-center text-4xl sm:text-5xl shadow-md mb-6 animate-scale-in">
          🏁
        </div>

        <div className="inline-flex items-center gap-2 px-6 py-1.5 rounded-full bg-[#EAF5EC] border border-[#2D8058]/30 text-[#2D8058] text-xs sm:text-sm lg:text-base font-black tracking-widest uppercase mb-4 shadow-xs">
          <span>Partida Finalizada</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#122017] tracking-tight mb-4">
          Fim de Jogo!
        </h1>

        <p className="text-xl sm:text-2xl lg:text-3xl text-[#526B59] font-bold max-w-2xl leading-relaxed mb-8">
          Parabéns a todos os participantes pela dedicação e excelente desempenho na arena!
        </p>

        <div className="bg-white border-2 border-[#E2DDD2] rounded-3xl p-6 lg:p-8 max-w-xl w-full shadow-md text-center">
          <span className="text-xs sm:text-sm uppercase font-black tracking-widest text-[#123829] block mb-2">
            Medicina Veterinária • Anatomia Comparada
          </span>
          <p className="text-sm sm:text-base text-[#555E57] font-medium leading-normal">
            A Batalha Anatômica foi encerrada pelo apresentador. Obrigado pela participação de todos!
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center mt-4 shrink-0">
        <span className="text-xs lg:text-sm font-bold text-[#648B68] uppercase tracking-wider">
          Batalha Anatômica • Medicina Veterinária
        </span>
      </footer>
    </div>
  );
}

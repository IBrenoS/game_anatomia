import React from 'react';

interface ConnectionRestoredToastProps {
  show: boolean;
}

export const ConnectionRestoredToast: React.FC<ConnectionRestoredToastProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-[slideFadeIn_0.25s_ease-out] select-none pointer-events-none"
    >
      <div className="bg-[#FAF8F3] border-2 border-[#2D8058] rounded-2xl p-3 sm:p-3.5 shadow-2xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#2D8058] text-white flex items-center justify-center shrink-0 font-black text-sm shadow-sm animate-check-pop">
          ✓
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs sm:text-sm font-black text-[#122017] tracking-tight">
            Você voltou à partida
          </span>
          <span className="text-[11px] sm:text-xs text-[#555E57] font-medium truncate">
            Tudo sincronizado. Continue de onde parou.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConnectionRestoredToast;

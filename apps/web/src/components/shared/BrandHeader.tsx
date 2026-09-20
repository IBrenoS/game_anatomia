import React from 'react';

interface BrandHeaderProps {
  showArenaStatus?: boolean;
  className?: string;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  showArenaStatus = true,
  className = '',
}) => {
  return (
    <header className={`w-full flex justify-between items-center py-2.5 sm:py-4 select-none ${className}`}>
      <div className="flex flex-col">
        <span className="text-xs sm:text-sm font-black tracking-widest text-white uppercase">
          BATALHA ANATÔMICA
        </span>
        <span className="text-[10px] sm:text-xs font-bold tracking-wider text-slate-400 uppercase">
          BOVINO <span className="text-[#D05F36]">×</span> EQUINO
        </span>
      </div>

      {showArenaStatus && (
        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#123829]/50 border border-[#1FD4A7]/25 text-[#1FD4A7] text-[11px] font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-[#1FD4A7] animate-pulse" aria-hidden="true" />
          <span>Arena online</span>
        </div>
      )}
    </header>
  );
};

export default BrandHeader;

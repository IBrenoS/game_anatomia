import React from 'react';

interface BovinoEquinoEmblemProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const BovinoEquinoEmblem: React.FC<BovinoEquinoEmblemProps> = ({
  className = '',
  size = 'md',
  showSubtitle = false,
}) => {
  const sizeMap = {
    sm: 'w-28 h-28 sm:w-36 sm:h-36',
    md: 'w-52 h-52 sm:w-64 sm:h-64 lg:w-72 lg:h-72',
    lg: 'w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80',
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <img
        src="/brand/batalha-anatomica-logo.png"
        alt="Batalha Anatômica — Bovino versus Equino"
        width={1254}
        height={1254}
        draggable={false}
        className={`${currentSize} object-contain animate-[fadeInScale_0.35s_ease-out] motion-safe:animate-ambient-float motion-reduce:animate-none`}
      />

      {showSubtitle && (
        <span className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide mt-2">
          10 desafios · até 50 jogadores
        </span>
      )}
    </div>
  );
};

export default BovinoEquinoEmblem;

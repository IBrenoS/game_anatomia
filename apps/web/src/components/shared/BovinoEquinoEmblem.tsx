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
    sm: { container: 'w-40 h-40 sm:w-48 sm:h-48', svg: 'w-36 h-36 sm:w-44 sm:h-44', fontSize: 'text-xs sm:text-sm', xSize: 'text-sm sm:text-base' },
    md: { container: 'w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80', svg: 'w-52 h-52 sm:w-64 sm:h-64 lg:w-72 lg:h-72', fontSize: 'text-lg sm:text-xl lg:text-2xl', xSize: 'text-lg sm:text-xl lg:text-2xl' },
    lg: { container: 'w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96', svg: 'w-60 h-60 sm:w-72 sm:h-72 lg:w-88 lg:h-88', fontSize: 'text-xl sm:text-2xl lg:text-3xl', xSize: 'text-xl sm:text-2xl lg:text-3xl' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      <div className={`relative flex items-center justify-center ${currentSize.container}`}>
        {/* Ambient subtle glow background */}
        <div 
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#123829]/25 via-[#1FD4A7]/10 to-[#D05F36]/15 blur-2xl pointer-events-none"
          aria-hidden="true" 
        />

        {/* Concentric Intersecting Orbital Rings */}
        <svg 
          className={`absolute inset-0 m-auto ${currentSize.svg} pointer-events-none`} 
          viewBox="0 0 300 300" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Gradients for rings */}
            <linearGradient id="ringTeal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1FD4A7" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#648B68" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#123829" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="ringTerracotta" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#D05F36" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#C85A32" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#D05F36" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Teal Outer Orbital Arc */}
          <g className="animate-ring-orbit motion-reduce:transform-none">
            <ellipse 
              cx="150" 
              cy="150" 
              rx="132" 
              ry="128" 
              stroke="url(#ringTeal)" 
              strokeWidth="2" 
              strokeDasharray="18 10 90 12 140 16"
              strokeLinecap="round"
            />
          </g>

          {/* Terracotta Inner Offset Orbital Arc */}
          <g className="animate-ring-orbit-reverse motion-reduce:transform-none">
            <ellipse 
              cx="150" 
              cy="150" 
              rx="118" 
              ry="122" 
              stroke="url(#ringTerracotta)" 
              strokeWidth="1.8" 
              strokeDasharray="12 12 60 14 110 18"
              strokeLinecap="round"
              transform="rotate(24 150 150)"
            />
          </g>

          {/* Subtle connecting decorative nodes */}
          <circle cx="150" cy="18" r="3" fill="#1FD4A7" opacity="0.8" />
          <circle cx="268" cy="150" r="2.5" fill="#D05F36" opacity="0.8" />
        </svg>

        {/* Center Confrontation Typography */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
          <span 
            className={`font-black tracking-[0.18em] text-white uppercase drop-shadow-md transition-all duration-300 ${currentSize.fontSize}`}
          >
            BOVINO
          </span>
          <span 
            className={`font-black text-[#D05F36] my-0.5 sm:my-1 inline-block animate-cross-pulse motion-reduce:transform-none ${currentSize.xSize}`}
            aria-label="versus"
          >
            ×
          </span>
          <span 
            className={`font-black tracking-[0.18em] text-white uppercase drop-shadow-md transition-all duration-300 ${currentSize.fontSize}`}
          >
            EQUINO
          </span>
        </div>
      </div>

      {showSubtitle && (
        <span className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide mt-2">
          10 desafios · até 50 jogadores
        </span>
      )}
    </div>
  );
};

export default BovinoEquinoEmblem;

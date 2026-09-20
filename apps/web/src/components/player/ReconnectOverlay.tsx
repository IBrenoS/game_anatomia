import { useGameStore } from '../../stores/gameStore.js';

interface ReconnectOverlayProps {
  isReconnecting?: boolean;
  isGameplay?: boolean;
}

export default function ReconnectOverlay({ isReconnecting, isGameplay: propIsGameplay }: ReconnectOverlayProps) {
  const active = isReconnecting ?? false;
  const storeRoomState = useGameStore((s) => s.roomState);
  const isGameplay = propIsGameplay ?? (storeRoomState !== 'LOBBY' && storeRoomState !== null);

  if (!active) return null;

  return (
    <div
      className={`fixed inset-0 ${
        isGameplay ? 'bg-[#123829]/30 backdrop-blur-xs' : 'bg-[#080C11]/80 backdrop-blur-sm'
      } z-50 flex items-center justify-center p-4 select-none`}
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-[#FAF8F3] border border-[#E2DDD2] rounded-3xl p-7 sm:p-8 max-w-sm w-full mx-auto shadow-2xl flex flex-col items-center text-center animate-scale-in">
        {/* Veterinary deep green spinner ring */}
        <div
          className="w-14 h-14 border-4 border-[#E2DDD2] border-t-[#123829] rounded-full animate-spin mb-4 shadow-inner"
          aria-hidden="true"
        />

        <h2 className="text-xl sm:text-2xl font-black text-[#122017] mb-1 tracking-tight">
          Reconectando à partida...
        </h2>
        <p className="text-xs sm:text-sm text-[#555E57] font-medium leading-relaxed max-w-[260px]">
          Seu progresso está seguro. Voltamos assim que a conexão responder.
        </p>
      </div>
    </div>
  );
}

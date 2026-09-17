import { useGameStore } from '../../stores/gameStore.js';

interface ReconnectOverlayProps {
  isReconnecting?: boolean;
}

export default function ReconnectOverlay({ isReconnecting }: ReconnectOverlayProps) {
  const storeState = useGameStore(s => s.connectionState);
  const active = isReconnecting !== undefined ? isReconnecting : storeState === 'reconnecting';

  if (!active) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center text-white backdrop-blur-sm" role="alert" aria-live="assertive">
      <div className="bg-[#1e3a5f] p-8 rounded-2xl border border-white/20 flex flex-col items-center max-w-sm w-full mx-4 shadow-2xl">
        <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-6" aria-hidden="true" />
        <h2 className="text-2xl font-bold mb-2">Reconectando...</h2>
        <p className="text-center text-blue-200">Aguarde enquanto restabelecemos sua conexão com a sala.</p>
      </div>
    </div>
  );
}

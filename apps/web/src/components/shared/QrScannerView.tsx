import React, { useEffect, useRef, useState } from 'react';

interface QrScannerViewProps {
  onScanSuccess: (pin: string) => void;
  onClose: () => void;
}

// Minimal interface for native BarcodeDetector API
interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement | ImageBitmap | HTMLCanvasElement) => Promise<DetectedBarcode[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): BarcodeDetectorInstance;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

export const QrScannerView: React.FC<QrScannerViewProps> = ({ onScanSuccess, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;

    async function startCamera() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Câmera não suportada neste navegador. Digite o PIN manualmente.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });

        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsLoading(false);

        // Check if BarcodeDetector is available
        if ('BarcodeDetector' in window && window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          
          scanIntervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const raw = barcodes[0].rawValue.trim();
                // Match either URL ending with /join/:pin or 6-digit PIN directly
                const matchPin = raw.match(/join\/(\d{6})/i) || raw.match(/\b(\d{6})\b/);
                if (matchPin && matchPin[1]) {
                  stopCamera();
                  onScanSuccess(matchPin[1]);
                }
              }
            } catch {
              // Ignore single frame detect errors
            }
          }, 250);
        } else {
          // BarcodeDetector not available
          setErrorMessage(
            'Leitura automática de QR Code não suportada neste navegador. Aponte a câmera ou digite o PIN.',
          );
        }
      } catch (err) {
        console.warn('Câmera falhou:', err);
        setIsLoading(false);
        setErrorMessage(
          'Permissão de câmera não concedida ou dispositivo indisponível. Digite o PIN da sala.',
        );
      }
    }

    startCamera();

    return () => {
      isActive = false;
      stopCamera();
    };
  }, [onScanSuccess]);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  return (
    <div className="w-full bg-[#0E1522] border border-white/10 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden animate-[fadeInScale_0.2s_ease-out]">
      <div className="w-full flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1FD4A7]">
            Escanear QR Code
          </span>
          {!isLoading && !errorMessage && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#123829] border border-[#1FD4A7]/30 text-[#1FD4A7] text-[10px] font-semibold animate-[fadeInScale_0.2s_ease-out]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1FD4A7] animate-pulse" aria-hidden="true" />
              <span>Câmera ativa</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1FD4A7]"
        >
          Fechar câmera
        </button>
      </div>

      <div className="relative w-full max-w-[280px] h-[240px] bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/10 shadow-inner">
        {isLoading && (
          <div className="flex flex-col items-center gap-2 text-slate-300 text-xs">
            <div className="w-8 h-8 border-2 border-[#1FD4A7] border-t-transparent rounded-full animate-spin" />
            <span>Iniciando câmera...</span>
          </div>
        )}

        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${isLoading ? 'hidden' : 'block'}`}
        />

        {/* Viewfinder Target Graphic */}
        {!isLoading && !errorMessage && (
          <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
            <div className="flex justify-between">
              <div className="w-6 h-6 border-t-2 border-l-2 border-[#1FD4A7]" />
              <div className="w-6 h-6 border-t-2 border-r-2 border-[#1FD4A7]" />
            </div>
            {/* Animated Laser Beam */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#1FD4A7] to-transparent relative animate-[scanBeam_2.5s_ease-in-out_infinite]" />
            <div className="flex justify-between">
              <div className="w-6 h-6 border-b-2 border-l-2 border-[#1FD4A7]" />
              <div className="w-6 h-6 border-b-2 border-r-2 border-[#1FD4A7]" />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="absolute inset-0 bg-black/85 p-4 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-amber-300 font-medium mb-3">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="text-xs font-bold py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              Usar PIN
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-2 text-center">
        Aponte a câmera para o QR Code projetado no telão
      </p>
    </div>
  );
};

export default QrScannerView;

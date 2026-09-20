import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QrPanelProps {
  pin: string;
}

export default function QrPanel({ pin }: QrPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${pin}` : '';

  useEffect(() => {
    if (joinUrl) {
      QRCode.toDataURL(joinUrl, {
        width: 360,
        margin: 2,
        color: {
          dark: '#080C11',
          light: '#FAF7F2',
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [joinUrl]);

  return (
    <div className="bg-[#FAF7F2] p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-white/20">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`QR Code para entrar na sala ${pin}`}
          className="w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80 object-contain rounded-2xl mb-4 shadow-sm"
        />
      ) : (
        <div className="w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80 bg-slate-200 flex items-center justify-center rounded-2xl mb-4">
          <span className="text-base text-slate-600 font-semibold">Gerando QR Code...</span>
        </div>
      )}
      <p className="text-[#080C11] font-black text-base sm:text-lg lg:text-xl uppercase tracking-wider text-center">
        Aponte a câmera para entrar
      </p>
    </div>
  );
}

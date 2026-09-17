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
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(setQrDataUrl).catch(console.error);
    }
  }, [joinUrl]);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center border border-white/20">
      {qrDataUrl ? (
        <img 
          src={qrDataUrl} 
          alt={`QR Code para entrar na sala ${pin}`} 
          className="w-56 h-56 rounded-xl mb-3 shadow-inner" 
        />
      ) : (
        <div className="w-56 h-56 bg-slate-100 flex items-center justify-center rounded-xl mb-3">
          <span className="text-sm text-slate-500 font-semibold">Gerando QR Code...</span>
        </div>
      )}
      <p className="text-slate-900 font-black text-base uppercase tracking-wider">Aponte a câmera para entrar</p>
    </div>
  );
}

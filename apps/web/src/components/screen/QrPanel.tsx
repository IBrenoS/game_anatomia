import React from 'react';

interface QrPanelProps {
  pin: string;
}

export default function QrPanel({ pin }: QrPanelProps) {
  // In a real app, generate QR code pointing to domain.com/join?pin=XXXXXX
  return (
    <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center">
      <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500 mb-4 font-bold text-xl border-4 border-gray-300 border-dashed rounded-lg">
        QR CODE
      </div>
      <p className="text-black font-bold text-lg">Scan to join</p>
    </div>
  );
}

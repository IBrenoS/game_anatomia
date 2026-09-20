import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isDestructive = false,
}) => {
  const titleId = useId();
  const messageId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    cancelButtonRef.current?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const dialog = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeInScale_0.2s_ease-out]"
    >
      <div className="bg-[#0E1522] rounded-2xl shadow-2xl border border-white/15 w-full max-w-md overflow-hidden select-none">
        <div className="p-6">
          <h3 id={titleId} className="text-lg sm:text-xl font-black text-white mb-2">{title}</h3>
          <p id={messageId} className="text-sm text-slate-300 leading-relaxed">{message}</p>
        </div>
        <div className="bg-black/30 px-6 py-4 flex justify-end gap-3 border-t border-white/10">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-white transition-all cursor-pointer shadow-md active:scale-95 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#1FD4A7] hover:bg-[#19C298] text-[#080C11]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
};

export default ConfirmDialog;

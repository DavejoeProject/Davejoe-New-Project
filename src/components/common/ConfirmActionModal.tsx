import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  isBusy = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, onCancel]);

  if (!isOpen) return null;

  const iconWrapperClass =
    variant === 'danger'
      ? 'bg-red-50 text-red-600 border-red-200'
      : variant === 'warning'
      ? 'bg-amber-50 text-amber-600 border-amber-200'
      : 'bg-emerald-50 text-[#18b892] border-[#18b892]/25';

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-[#18b892] hover:bg-[#139c7b] text-white';

  const Icon =
    variant === 'danger'
      ? ShieldAlert
      : variant === 'warning'
      ? AlertTriangle
      : CheckCircle2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
      onClick={() => {
        if (!isBusy) onCancel();
      }}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconWrapperClass}`}
            >
              <Icon className="w-4.5 h-4.5" />
            </div>
            <h3
              id="confirm-action-title"
              className="text-base font-bold text-slate-900 truncate"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 ${confirmButtonClass}`}
            >
              {isBusy ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

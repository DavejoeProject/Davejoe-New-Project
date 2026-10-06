import React from 'react';
import { usePWAUpdate } from '../../hooks/usePWAUpdate';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export const PWAUpdateToast: React.FC = () => {
  const { needRefresh, update, closeUpdate } = usePWAUpdate();

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 sm:right-6 z-50 bg-white border border-emerald-200/90 rounded-2xl shadow-[0_10px_25px_-5px_rgba(1,135,95,0.15)] p-4 max-w-sm w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-top-3 duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#01875F] flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <h4 className="text-xs font-bold text-slate-900 tracking-tight">
            Update available
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
            A new version of Davejoe is ready with the latest improvements.
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={update}
              className="h-7 px-3 rounded-md bg-[#01875F] hover:bg-[#00704e] text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Update Now
            </button>
            <button
              type="button"
              onClick={closeUpdate}
              className="h-7 px-2.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-[11px] font-medium transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={closeUpdate}
          aria-label="Dismiss update notification"
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

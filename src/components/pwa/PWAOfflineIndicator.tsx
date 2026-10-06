import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const PWAOfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-slate-900/95 text-white px-3.5 py-2 rounded-xl text-xs font-medium shadow-lg backdrop-blur-xs border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Working offline &mdash; using cached workspace data</span>
    </div>
  );
};

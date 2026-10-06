import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Share, PlusSquare, X, Download, Smartphone, Monitor } from 'lucide-react';

interface PWAInstallPromptProps {
  /**
   * Optional variant: 'banner' (default bottom floating card) | 'inline' (compact card for embed)
   */
  variant?: 'banner' | 'inline';
  className?: string;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  variant = 'banner',
  className = '',
}) => {
  const {
    isStandalone,
    isInstalled,
    isIOS,
    isMobile,
    isDismissed,
    canShowPrompt,
    install,
    dismiss,
  } = usePWAInstall();

  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed, standalone, or user chose "Not now", do not render
  if (isStandalone || isInstalled || (!canShowPrompt && !showIOSModal)) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    dismiss(false);
    setShowIOSModal(false);
  };

  const deviceLabel = isMobile ? 'phone' : 'device';
  const subtitleText = isMobile
    ? 'Install Davejoe Management Tool on your phone for faster access.'
    : 'Install Davejoe Management Tool on your computer for instant access.';

  return (
    <>
      {/* 1. Main Install Card / Banner */}
      <aside
        role="region"
        aria-label="Install Davejoe Management Tool"
        className={
          variant === 'banner'
            ? `fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] z-50 bg-white border border-slate-200/90 rounded-2xl shadow-[0_10px_30px_-5px_rgba(15,23,42,0.12)] p-4.5 transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 ${className}`
            : `w-full bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs ${className}`
        }
      >
        <div className="flex items-start gap-3.5">
          {/* Brand Emblem */}
          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-xs border border-slate-100 bg-white">
            <img
              src="/pwa-192x192.png"
              alt="Davejoe Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Install Davejoe
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-medium text-[#01875F] bg-[#01875F]/10 rounded">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              {subtitleText}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="flex-1 h-9 px-3.5 rounded-lg bg-[#01875F] hover:bg-[#00704e] active:bg-[#005a3f] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isMobile ? (
              <Smartphone className="w-3.5 h-3.5" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isInstalling ? 'Installing...' : 'Install'}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="h-9 px-3.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            Not now
          </button>
        </div>
      </aside>

      {/* 2. iOS Safari Step-by-Step Guidance Modal */}
      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-5 relative">
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-100 bg-white shadow-2xs">
                <img
                  src="/pwa-192x192.png"
                  alt="Davejoe Logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 id="ios-modal-title" className="text-sm font-bold text-slate-900">
                  Install Davejoe on your iPhone
                </h3>
                <p className="text-xs text-slate-500">
                  Safari Web App Installation
                </p>
              </div>
            </div>

            <div className="space-y-3 my-4 bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1">
                  Tap the <strong className="text-slate-900">Share</strong> button in Safari's bottom toolbar.
                  <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                    <Share className="w-3.5 h-3.5 text-[#01875F]" />
                    <span>Usually located at the bottom of the screen</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1">
                  Scroll down and select <strong className="text-slate-900">Add to Home Screen</strong>.
                  <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                    <PlusSquare className="w-3.5 h-3.5 text-[#01875F]" />
                    <span>Look for the square icon with a plus sign</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0 mt-0.5">
                  3
                </div>
                <div className="flex-1">
                  Tap <strong className="text-slate-900">Add</strong> in the top-right corner to complete.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIOSModal(false);
                dismiss(false);
              }}
              className="w-full h-9 rounded-lg bg-[#01875F] hover:bg-[#00704e] text-white text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

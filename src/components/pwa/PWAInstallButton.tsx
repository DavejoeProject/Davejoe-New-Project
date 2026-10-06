import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'outline' | 'solid' | 'minimal';
  size?: 'sm' | 'md';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'outline',
  size = 'sm',
}) => {
  const {
    isStandalone,
    isInstalled,
    isIOS,
    isMobile,
    isInstallableNative,
    install,
  } = usePWAInstall();

  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running standalone or installed, hide completely
  if (isStandalone || isInstalled) {
    return null;
  }

  // If native prompt is not available and not iOS Safari, cannot trigger install
  if (!isInstallableNative && !isIOS) {
    return null;
  }

  const handleClick = async () => {
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

  const baseStyle =
    'inline-flex items-center gap-1.5 font-semibold rounded-lg transition-colors cursor-pointer shrink-0';
  const sizeStyle =
    size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-xs';

  let variantStyle = 'border border-slate-200 text-slate-700 hover:bg-slate-50';
  if (variant === 'solid') {
    variantStyle = 'bg-[#01875F] text-white hover:bg-[#00704e] shadow-xs';
  } else if (variant === 'minimal') {
    variantStyle = 'text-slate-600 hover:text-[#01875F] hover:bg-emerald-50/50';
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isInstalling}
        title="Install Davejoe App"
        aria-label="Install Davejoe App"
        className={`${baseStyle} ${sizeStyle} ${variantStyle} ${className}`}
      >
        {isMobile ? (
          <Smartphone className="w-3.5 h-3.5 text-current" />
        ) : (
          <Download className="w-3.5 h-3.5 text-current" />
        )}
        <span>{isInstalling ? 'Installing...' : 'Install App'}</span>
      </button>

      {/* iOS Modal */}
      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
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
              <div className="w-10 h-10 rounded-xl bg-[#01875F] flex items-center justify-center text-white shrink-0 font-extrabold text-base">
                D
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Install Davejoe on iOS
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
                  Tap the <strong className="text-slate-900">Share</strong> button in Safari's toolbar.
                  <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                    <Share className="w-3.5 h-3.5 text-[#01875F]" />
                    <span>Bottom bar on iPhone, top on iPad</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1">
                  Choose <strong className="text-slate-900">Add to Home Screen</strong>.
                  <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                    <PlusSquare className="w-3.5 h-3.5 text-[#01875F]" />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0 mt-0.5">
                  3
                </div>
                <div className="flex-1">
                  Tap <strong className="text-slate-900">Add</strong> to complete installation.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full h-9 rounded-lg bg-[#01875F] hover:bg-[#00704e] text-white text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSAL_KEY = 'davejoe_pwa_install_dismissed_until';
// Suppress repeated prompt for 5 days after user taps "Not now"
const DISMISSAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Detect Standalone / Installed mode
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone =
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const standalone = isDisplayStandalone || isNavigatorStandalone;
      setIsStandalone(standalone);
      if (standalone) {
        setIsInstalled(true);
      }
    };

    checkStandalone();

    // 2. Platform detection
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const mobileDevice = /android|iphone|ipad|ipod|windows phone|mobile/.test(ua);
    setIsIOS(iosDevice);
    setIsMobile(mobileDevice);

    // 3. Persistent dismissal check
    try {
      const dismissedUntil = localStorage.getItem(DISMISSAL_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setIsDismissed(true);
      } else if (dismissedUntil) {
        localStorage.removeItem(DISMISSAL_KEY);
      }
    } catch {
      // localStorage may be blocked in strict private browsing
    }

    // 4. Listen to native browser beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 5. Listen to appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Prompt execution error:', err);
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback((permanent = false) => {
    setIsDismissed(true);
    try {
      const duration = permanent ? 30 * 24 * 60 * 60 * 1000 : DISMISSAL_DURATION_MS;
      localStorage.setItem(DISMISSAL_KEY, (Date.now() + duration).toString());
    } catch {
      // ignore storage failure
    }
  }, []);

  const clearDismissal = useCallback(() => {
    setIsDismissed(false);
    try {
      localStorage.removeItem(DISMISSAL_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    isStandalone,
    isInstalled,
    isIOS,
    isMobile,
    isDismissed,
    isInstallableNative: !!deferredPrompt,
    canShowPrompt: !isStandalone && !isInstalled && !isDismissed && (!!deferredPrompt || isIOS),
    install,
    dismiss,
    clearDismissal,
  };
}

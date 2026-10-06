import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates every 60 minutes
        setInterval(() => {
          r.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Service worker registration error:', error);
    },
  });

  const update = async () => {
    await updateServiceWorker(true);
  };

  const closeUpdate = () => {
    setNeedRefresh(false);
  };

  const closeOfflineReady = () => {
    setOfflineReady(false);
  };

  return {
    needRefresh,
    offlineReady,
    update,
    closeUpdate,
    closeOfflineReady,
  };
}

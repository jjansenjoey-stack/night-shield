import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

/** Keeps the store's `isOnline` in step with the browser (prompt 43). */
export function useOnlineStatus(): boolean {
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setOnline]);

  return isOnline;
}

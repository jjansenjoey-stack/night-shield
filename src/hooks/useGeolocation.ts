import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * Prompt 42 — asks once for location, keeps the blue dot fresh while the user
 * is on a page that watches (route navigation), and records a refusal so the
 * UI can explain what is missing instead of silently showing no distances.
 */
export function useGeolocation({ watch = false }: { watch?: boolean } = {}) {
  const userLocation = useAppStore((s) => s.userLocation);
  const locationDenied = useAppStore((s) => s.locationDenied);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setLocationDenied = useAppStore((s) => s.setLocationDenied);
  const watchId = useRef<number | null>(null);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => setLocationDenied(true),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [setUserLocation, setLocationDenied]);

  useEffect(() => {
    if (!watch || !('geolocation' in navigator)) return undefined;

    watchId.current = navigator.geolocation.watchPosition(
      (position) =>
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => setLocationDenied(true),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [watch, setUserLocation, setLocationDenied]);

  return { userLocation, locationDenied, request };
}

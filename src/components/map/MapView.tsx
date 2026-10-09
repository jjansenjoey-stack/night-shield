import { Component, lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { markWebglBroken, webglAvailable } from '@/lib/webgl';
import type { MapViewProps } from './mapContent';

/*
 * The map, in whichever engine this browser can run.
 *
 * MapLibre draws with WebGL. On a machine with hardware acceleration switched
 * off, a blocklisted GPU, or a GPU process that keeps crashing, there is no
 * WebGL — and the map used to be a blank box. Now:
 *
 *   - if a WebGL context cannot be had at all, Leaflet is used from the start;
 *   - if MapLibre throws while creating the map, or reports a WebGL error, or
 *     loses its context later, the map swaps to Leaflet in place.
 *
 * Both engines are lazy chunks, so a browser only downloads the one it uses.
 * To see the fallback on a machine where WebGL works, open any page with
 * `?nowebgl=1` (details in src/lib/webgl.ts).
 */

const MapLibreView = lazy(() =>
  import('./MapLibreView').then((m) => ({ default: m.MapLibreView })),
);
const LeafletMapView = lazy(() =>
  import('./leaflet/LeafletMapView').then((m) => ({ default: m.LeafletMapView })),
);

type Engine = 'webgl' | 'leaflet';

/**
 * Catches a map engine that throws while rendering or in an effect — MapLibre
 * throws "Failed to initialize WebGL" from its constructor — and reports it,
 * instead of letting it take the whole page down.
 */
export class MapEngineBoundary extends Component<
  { onError: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Which engine to start with, and a way to fall back from WebGL for good. */
export function useMapEngine() {
  const [engine, setEngine] = useState<Engine>(() => (webglAvailable() ? 'webgl' : 'leaflet'));
  const fallBack = useCallback((error: unknown) => {
    console.warn('WebGL map unavailable, switching to the simple map.', error);
    markWebglBroken();
    setEngine('leaflet');
  }, []);
  return { engine, fallBack };
}

export function MapLoading() {
  return <div className="map-canvas map-canvas--loading" aria-hidden="true" />;
}

export function MapView(props: MapViewProps) {
  const { engine, fallBack } = useMapEngine();

  return (
    <Suspense fallback={<MapLoading />}>
      {engine === 'webgl' ? (
        <MapEngineBoundary onError={fallBack}>
          <MapLibreView {...props} onWebglError={fallBack} />
        </MapEngineBoundary>
      ) : (
        <LeafletMapView {...props} />
      )}
    </Suspense>
  );
}

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  ScaleControl,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import { useAppStore } from '@/store/appStore';
import { MAP_STYLES } from './mapStyles';
import { BigPin, MapMarkerButton, UserDot, useMapContent, type MapViewProps } from './mapContent';
import type { MapItem } from '@/types';

interface Props extends MapViewProps {
  /**
   * Called when MapLibre cannot get, or loses, its WebGL context. MapView
   * answers by swapping in the Leaflet map.
   */
  onWebglError?: (error: unknown) => void;
}

/** The WebGL map. Rendered by MapView whenever the browser can draw WebGL. */
export function MapLibreView({
  items,
  routesOverride,
  interactive = true,
  showUser = true,
  onSelect,
  pin,
  onWebglError,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Set when the map itself reported the move, so we don't animate back to it.
  const selfMoved = useRef(false);
  const mapCenter = useAppStore((s) => s.mapCenter);
  const zoom = useAppStore((s) => s.zoom);
  const userLocation = useAppStore((s) => s.userLocation);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const setMapCenter = useAppStore((s) => s.setMapCenter);

  const { visibleItems, routeLines: lines, safety, foundCacheIds, markerSize, styleId } =
    useMapContent({ items, routesOverride });

  const select = useCallback(
    (item: MapItem) => {
      if (onSelect) onSelect(item);
      else setSelectedItem(item);
      mapRef.current?.easeTo({
        center: [item.location.longitude, item.location.latitude],
        duration: 550,
      });
    },
    [onSelect, setSelectedItem],
  );

  // Recentre when something *else* moved the map — a search result, the nearby
  // list, "view on map". A pan by the user is skipped, so the two never fight.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selfMoved.current) {
      selfMoved.current = false;
      return;
    }

    const move = () =>
      map.easeTo({ center: [mapCenter.longitude, mapCenter.latitude], zoom, duration: 600 });

    // Animating before the style is up can leave MapLibre without a tile
    // request, which shows as an empty canvas.
    if (map.isStyleLoaded()) move();
    else map.once('load', move);
  }, [mapCenter, zoom]);

  /*
   * Keep the GL canvas the same size as its box.
   *
   * The map is laid out by flexbox, so the container can settle *after*
   * MapLibre has measured it — leaving a canvas with a stale size that paints
   * nothing at all. Three overlapping mechanisms, because no single one is
   * reliable everywhere: a ResizeObserver (the right tool, but absent or inert
   * in some embedded renderers), the window resize event, and a couple of
   * catch-up calls on the frames just after mount.
   */
  useEffect(() => {
    const container = containerRef.current;
    const resize = () => mapRef.current?.resize();

    let cancelled = false;
    let pending = 0;
    let observer: ResizeObserver | undefined;

    /*
     * The ref populates on mount but the style loads later, and a resize issued
     * before the style lands does not make MapLibre ask for tiles. So nudge it
     * again on `load` and on the first `idle` — that is what actually turns a
     * blank canvas into a map.
     */
    const attach = () => {
      if (cancelled) return;
      const map = mapRef.current;
      if (!map) {
        pending = window.setTimeout(attach, 50);
        return;
      }

      if (import.meta.env.DEV) {
        // Dev-only handle for inspecting map state from the console.
        (window as unknown as { nsMap?: unknown }).nsMap = map;
      }

      resize();
      map.once('load', resize);
      map.once('idle', resize);

      if (container && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize);
        observer.observe(container);
      }
    };

    attach();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    return () => {
      cancelled = true;
      window.clearTimeout(pending);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      observer?.disconnect();
    };
  }, []);

  const routeLines = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: lines.map((line) => ({
        type: 'Feature' as const,
        properties: { color: line.color, id: line.id },
        geometry: {
          type: 'LineString' as const,
          coordinates: line.points.map((p) => [p.longitude, p.latitude]),
        },
      })),
    }),
    [lines],
  );

  /*
   * A fresh copy of the style per map instance.
   *
   * MapLibre takes ownership of the style object it is handed and mutates it
   * while loading. Passing the shared MAP_STYLES entry means the *second* map
   * mounted in a document — navigate from Discover to route navigation and
   * back — receives an already-consumed style and silently renders no basemap
   * at all. Cloning keeps each instance independent.
   */
  const mapStyle = useMemo(() => structuredClone(MAP_STYLES[styleId]), [styleId]);

  // Read through a ref so the load handler below never holds a stale callback.
  const onWebglErrorRef = useRef(onWebglError);
  onWebglErrorRef.current = onWebglError;

  return (
    <div className="map-canvas" ref={containerRef}>
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: mapCenter.latitude,
          longitude: mapCenter.longitude,
          zoom,
        }}
        mapStyle={mapStyle}
        interactive={interactive}
        onLoad={(event) => {
          event.target.resize();
          /*
           * A GPU that gives up mid-session (driver reset, a crashed GPU
           * process) loses the context and leaves a frozen or black canvas.
           * Hand over to the Leaflet map instead.
           */
          event.target.on('webglcontextlost', () =>
            onWebglErrorRef.current?.(new Error('WebGL context lost')),
          );
        }}
        onError={(event) => {
          // Tile and network errors also arrive here; only WebGL ones matter.
          const message = event.error?.message ?? '';
          if (/webgl|context/i.test(message)) onWebglErrorRef.current?.(event.error);
        }}
        onMoveEnd={(event) => {
          const { latitude, longitude, zoom: nextZoom } = event.viewState;
          // Keep the store roughly in sync without fighting the effect above.
          // Zoom travels with the centre, otherwise remounting the map (a tab
          // change, opening route navigation) would throw the user's zoom away.
          if (
            Math.abs(latitude - mapCenter.latitude) > 0.0005 ||
            Math.abs(longitude - mapCenter.longitude) > 0.0005 ||
            Math.abs(nextZoom - zoom) > 0.01
          ) {
            selfMoved.current = true;
            setMapCenter({ latitude, longitude }, nextZoom);
          }
        }}
        style={{ width: '100%', height: '100%' }}
        attributionControl
      >
        {interactive ? <NavigationControl position="bottom-right" showCompass={false} /> : null}
        {interactive ? <ScaleControl position="bottom-left" unit="metric" /> : null}

        <Source id="ns-routes" type="geojson" data={routeLines}>
          <Layer
            id="ns-routes-casing"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#0b0b18', 'line-width': 7, 'line-opacity': 0.55 }}
          />
          <Layer
            id="ns-routes-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 3.5,
              'line-opacity': 0.95,
            }}
          />
        </Source>

        {visibleItems.map((item) => (
          <Marker
            key={`${item.type}-${item.id}`}
            latitude={item.location.latitude}
            longitude={item.location.longitude}
            anchor="center"
          >
            <MapMarkerButton
              item={item}
              safety={safety}
              foundCacheIds={foundCacheIds}
              markerSize={markerSize}
              onSelect={select}
            />
          </Marker>
        ))}

        {showUser && userLocation ? (
          <Marker
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            anchor="center"
          >
            <UserDot />
          </Marker>
        ) : null}

        {pin ? (
          <Marker latitude={pin.latitude} longitude={pin.longitude} anchor="bottom">
            <BigPin />
          </Marker>
        ) : null}
      </Map>
    </div>
  );
}

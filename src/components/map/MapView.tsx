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
import { Brush, CalendarDays, Coffee, Route as RouteIcon, Search } from 'lucide-react';
import type { FeatureCollection } from 'geojson';
import { useAppStore } from '@/store/appStore';
import { useFilteredItems, type DecoratedItem } from '@/hooks/useFilteredItems';
import { useSnappedRoutes } from '@/hooks/useSnappedRoutes';
import { ROUTE_LINE_COLORS, routePath } from '@/services/routeService';
import { hasEnoughReports, SAFETY_BAND_META, safetyBand } from '@/services/feedbackService';
import { formatDistance } from '@/lib/geo';
import { itemTypeLabel } from '@/lib/format';
import { MAP_STYLES, MARKER_SIZE_CLASS } from './mapStyles';
import type { DiscoveryRoute, ItemType, MapItem } from '@/types';

const TYPE_ICONS: Record<ItemType, typeof Brush> = {
  installation: Brush,
  event: CalendarDays,
  route: RouteIcon,
  third_space: Coffee,
  cache: Search,
};

interface Props {
  /** Overrides the store's filtered set — used by the route navigation page. */
  items?: DecoratedItem[];
  routesOverride?: DiscoveryRoute[];
  interactive?: boolean;
  showUser?: boolean;
  onSelect?: (item: MapItem) => void;
  children?: React.ReactNode;
}

export function MapView({
  items,
  routesOverride,
  interactive = true,
  showUser = true,
  onSelect,
  children,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Set when the map itself reported the move, so we don't animate back to it.
  const selfMoved = useRef(false);
  const data = useAppStore((s) => s.data);
  const prefs = useAppStore((s) => s.prefs);
  const mapCenter = useAppStore((s) => s.mapCenter);
  const zoom = useAppStore((s) => s.zoom);
  const userLocation = useAppStore((s) => s.userLocation);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const setMapCenter = useAppStore((s) => s.setMapCenter);
  const cacheFinds = useAppStore((s) => s.cacheFinds);

  const filtered = useFilteredItems();
  const visibleItems = items ?? filtered.items;

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

  // Route polylines (prompt 33). Only drawn when the route layer is on.
  const visibleRoutes = useMemo<DiscoveryRoute[]>(() => {
    const routes =
      routesOverride ??
      (prefs.layers.route && filtered.items.some((i) => i.type === 'route')
        ? (data?.routes ?? [])
        : []);

    const visibleRouteIds = routesOverride
      ? new Set(routesOverride.map((r) => r.id))
      : new Set(filtered.items.filter((i) => i.type === 'route').map((i) => i.id));

    return routes.filter((route) => visibleRouteIds.has(route.id));
  }, [routesOverride, prefs.layers.route, data?.routes, filtered.items]);

  /*
   * Real pedestrian geometry, when the router can supply it.
   *
   * A route is a handful of stops; joining them with straight lines draws
   * through buildings and across the ring road. This arrives a moment after
   * first paint and replaces those lines with the pavements people actually
   * walk. Until then — and forever, if the router is unreachable — the
   * straight lines below are what shows.
   */
  const snapped = useSnappedRoutes(visibleRoutes);

  const routeLines = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: visibleRoutes.map((route) => ({
        type: 'Feature' as const,
        properties: { color: ROUTE_LINE_COLORS[route.type], id: route.id },
        geometry: {
          type: 'LineString' as const,
          coordinates: (snapped.get(route.id)?.points ?? routePath(route)).map((p) => [
            p.longitude,
            p.latitude,
          ]),
        },
      })),
    }),
    [visibleRoutes, snapped],
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
  const mapStyle = useMemo(
    () => structuredClone(MAP_STYLES[prefs.style]),
    [prefs.style],
  );

  const safety = data?.safety;
  const foundCacheIds = useMemo(
    () => new Set(cacheFinds.map((f) => f.cache_id)),
    [cacheFinds],
  );

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
        onLoad={(event) => event.target.resize()}
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

        {visibleItems.map((item) => {
          const Icon = TYPE_ICONS[item.type];
          const summary = safety?.get(item.id);
          // Same three-report floor the detail sheets use — one bad night must
          // not paint a place red on the map.
          const band = hasEnoughReports(summary) && summary ? safetyBand(summary.average) : null;
          const distance = 'distance' in item ? (item as DecoratedItem).distance : null;

          const label = [
            itemTypeLabel(item.type),
            `: ${item.title}`,
            item.subtitle ? ` by ${item.subtitle}` : '',
            distance != null ? `, ${formatDistance(distance)} away` : '',
            band ? `, ${SAFETY_BAND_META[band].label}` : '',
            item.type === 'cache'
              ? foundCacheIds.has(item.id)
                ? ', already found'
                : ', not found yet'
              : '',
          ].join('');

          return (
            <Marker
              key={`${item.type}-${item.id}`}
              latitude={item.location.latitude}
              longitude={item.location.longitude}
              anchor="center"
            >
              <button
                type="button"
                className={[
                  'map-marker',
                  `map-marker--${item.type}`,
                  MARKER_SIZE_CLASS[prefs.markerSize],
                  // A found cache fills in; an unfound one stays dashed.
                  item.type === 'cache' && foundCacheIds.has(item.id) ? 'is-found' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={(event) => {
                  event.stopPropagation();
                  select(item);
                }}
                aria-label={label}
                title={item.title}
              >
                <Icon size={prefs.markerSize === 'small' ? 11 : 15} aria-hidden="true" />
                {band ? (
                  <span
                    className="map-marker__safety"
                    style={{ background: SAFETY_BAND_META[band].color }}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </Marker>
          );
        })}

        {showUser && userLocation ? (
          <Marker
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            anchor="center"
          >
            <div className="user-dot" role="img" aria-label="Your location" />
          </Marker>
        ) : null}

        {children}
      </Map>
    </div>
  );
}

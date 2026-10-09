import { useMemo } from 'react';
import { Brush, CalendarDays, Coffee, MapPin, Route as RouteIcon, Search } from 'lucide-react';
import { useAppStore, type MarkerSize } from '@/store/appStore';
import { useFilteredItems, type DecoratedItem } from '@/hooks/useFilteredItems';
import { useSnappedRoutes } from '@/hooks/useSnappedRoutes';
import { ROUTE_LINE_COLORS, routePath } from '@/services/routeService';
import { hasEnoughReports, SAFETY_BAND_META, safetyBand } from '@/services/feedbackService';
import { formatDistance } from '@/lib/geo';
import { itemTypeLabel } from '@/lib/format';
import { MARKER_SIZE_CLASS } from './mapStyles';
import type { DiscoveryRoute, ItemType, LatLng, MapItem } from '@/types';

/*
 * What a map shows, separated from how it is drawn.
 *
 * The app has two map engines: MapLibre (WebGL) and, for browsers where WebGL
 * is switched off or broken, Leaflet (plain DOM and <img> tiles). Everything
 * that decides *what* is on the map — which markers, which route lines, what
 * a marker says to a screen reader — lives here, so the two can never drift.
 */

/** Props every map engine accepts. MapView picks the engine. */
export interface MapViewProps {
  /** Overrides the store's filtered set — used by the route navigation page. */
  items?: DecoratedItem[];
  routesOverride?: DiscoveryRoute[];
  interactive?: boolean;
  showUser?: boolean;
  onSelect?: (item: MapItem) => void;
  /** A large pin, e.g. the next stop while walking a route. */
  pin?: LatLng | null;
  /**
   * Where the Leaflet fallback says it is the simple map: a small pill at the
   * top, or folded into the attribution line when the page already has
   * overlays along the top and bottom (Discover). MapLibre ignores it.
   */
  fallbackNote?: 'top' | 'attribution';
}

const TYPE_ICONS: Record<ItemType, typeof Brush> = {
  installation: Brush,
  event: CalendarDays,
  route: RouteIcon,
  third_space: Coffee,
  cache: Search,
};

export interface RouteLine {
  id: string;
  color: string;
  points: LatLng[];
}

export function useMapContent({
  items,
  routesOverride,
}: Pick<MapViewProps, 'items' | 'routesOverride'>) {
  const data = useAppStore((s) => s.data);
  const prefs = useAppStore((s) => s.prefs);
  const cacheFinds = useAppStore((s) => s.cacheFinds);

  const filtered = useFilteredItems();
  const visibleItems = items ?? filtered.items;

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
   * straight lines are what shows.
   */
  const snapped = useSnappedRoutes(visibleRoutes);

  const routeLines = useMemo<RouteLine[]>(
    () =>
      visibleRoutes.map((route) => ({
        id: route.id,
        color: ROUTE_LINE_COLORS[route.type],
        points: snapped.get(route.id)?.points ?? routePath(route),
      })),
    [visibleRoutes, snapped],
  );

  const foundCacheIds = useMemo(
    () => new Set(cacheFinds.map((f) => f.cache_id)),
    [cacheFinds],
  );

  return {
    visibleItems,
    routeLines,
    safety: data?.safety,
    foundCacheIds,
    markerSize: prefs.markerSize,
    styleId: prefs.style,
  };
}

type Safety = ReturnType<typeof useMapContent>['safety'];

/** The round, typed marker button both engines draw for each item. */
export function MapMarkerButton({
  item,
  safety,
  foundCacheIds,
  markerSize,
  onSelect,
}: {
  item: MapItem | DecoratedItem;
  safety: Safety;
  foundCacheIds: Set<string>;
  markerSize: MarkerSize;
  onSelect: (item: MapItem) => void;
}) {
  const Icon = TYPE_ICONS[item.type];
  const summary = safety?.get(item.id);
  // Same three-report floor the detail sheets use — one bad night must not
  // paint a place red on the map.
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
    <button
      type="button"
      className={[
        'map-marker',
        `map-marker--${item.type}`,
        MARKER_SIZE_CLASS[markerSize],
        // A found cache fills in; an unfound one stays dashed.
        item.type === 'cache' && foundCacheIds.has(item.id) ? 'is-found' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(item);
      }}
      aria-label={label}
      title={item.title}
    >
      <Icon size={markerSize === 'small' ? 11 : 15} aria-hidden="true" />
      {band ? (
        <span
          className="map-marker__safety"
          style={{ background: SAFETY_BAND_META[band].color }}
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}

export function UserDot() {
  return <div className="user-dot" role="img" aria-label="Your location" />;
}

export function BigPin() {
  return <MapPin size={34} color="var(--accent1)" fill="var(--accent1)" aria-hidden="true" />;
}

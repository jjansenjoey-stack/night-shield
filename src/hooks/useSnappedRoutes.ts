import { useEffect, useState } from 'react';
import { routePath } from '@/services/routeService';
import { snapToFootpaths, type SnappedPath } from '@/services/routeGeometry';
import type { DiscoveryRoute } from '@/types';

/**
 * Real walking geometry for a set of routes, keyed by route id.
 *
 * Returns nothing on the first render and fills in as the router answers, so
 * the map draws straight lines immediately and quietly straightens them out a
 * moment later. Nothing waits on the network: a route that cannot be snapped
 * simply keeps the line it already had.
 */
export function useSnappedRoutes(routes: DiscoveryRoute[]): Map<string, SnappedPath> {
  const [snapped, setSnapped] = useState<Map<string, SnappedPath>>(new Map());

  useEffect(() => {
    let cancelled = false;

    for (const route of routes) {
      const points = routePath(route);
      if (points.length < 2) continue;

      /*
       * Asked for unconditionally. snapToFootpaths dedupes by shape across
       * every caller — in memory, in flight and in IndexedDB — so calling it
       * on each render costs nothing and, unlike a guard kept in this
       * component, it survives StrictMode's mount/unmount/mount.
       */
      void snapToFootpaths(points).then((result) => {
        if (cancelled || !result) return;
        setSnapped((current) => {
          if (current.get(route.id) === result) return current;
          const next = new Map(current);
          next.set(route.id, result);
          return next;
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [routes]);

  return snapped;
}

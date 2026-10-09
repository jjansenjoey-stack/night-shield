import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { useAppStore } from '@/store/appStore';
import { BigPin, MapMarkerButton, UserDot, useMapContent, type MapViewProps } from '../mapContent';
import {
  addBasemap,
  createLeafletMap,
  FALLBACK_NOTE_TEXT,
  FallbackNote,
  fromLeafletZoom,
  toLeafletZoom,
  useLeafletResize,
  useLeafletSlots,
  type Slot,
} from './leafletBase';
import type { MapItem } from '@/types';

/**
 * The map for browsers without WebGL.
 *
 * Same content as MapLibreView — the filtered markers, route lines, the user
 * dot, the next-stop pin, the same detail sheet on click and the same store
 * sync — drawn by Leaflet on the same Esri raster tiles. MapView decides which
 * of the two to render; nothing else in the app needs to know.
 */
export function LeafletMapView({
  items,
  routesOverride,
  interactive = true,
  showUser = true,
  onSelect,
  pin,
  fallbackNote = 'top',
}: MapViewProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  // Set when the map itself reported the move, so we don't animate back to it.
  const selfMoved = useRef(false);

  const mapCenter = useAppStore((s) => s.mapCenter);
  const zoom = useAppStore((s) => s.zoom);
  const userLocation = useAppStore((s) => s.userLocation);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const setMapCenter = useAppStore((s) => s.setMapCenter);

  const { visibleItems, routeLines, safety, foundCacheIds, markerSize, styleId } = useMapContent({
    items,
    routesOverride,
  });

  // The store values at mount, without making the create effect depend on them.
  const initial = useRef({ mapCenter, zoom });

  useEffect(() => {
    if (!container) return;
    const created = createLeafletMap(container, {
      ...initial.current.mapCenter,
      zoom: initial.current.zoom,
      interactive,
    });
    if (fallbackNote === 'attribution') {
      created.attributionControl.setPrefix(
        `<span class="map-fallback-note--inline">${FALLBACK_NOTE_TEXT}</span> · <a href="https://leafletjs.com">Leaflet</a>`,
      );
    }
    if (interactive) {
      L.control.zoom({ position: 'bottomright' }).addTo(created);
      L.control.scale({ position: 'bottomleft', imperial: false }).addTo(created);
    }
    setMap(created);
    if (import.meta.env.DEV) {
      (window as unknown as { nsLeaflet?: unknown }).nsLeaflet = created;
    }
    return () => {
      created.remove();
      setMap(null);
    };
  }, [container, interactive, fallbackNote]);

  useLeafletResize(map, container);

  // Basemap follows the style picked in map settings.
  useEffect(() => {
    if (!map) return;
    const layer = addBasemap(map, styleId);
    return () => {
      layer.remove();
    };
  }, [map, styleId]);

  // Keep the store roughly in sync, exactly as the MapLibre map does.
  const latest = useRef({ mapCenter, zoom });
  latest.current = { mapCenter, zoom };
  useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => {
      const c = map.getCenter();
      const nextZoom = fromLeafletZoom(map.getZoom());
      const { mapCenter: cur, zoom: curZoom } = latest.current;
      if (
        Math.abs(c.lat - cur.latitude) > 0.0005 ||
        Math.abs(c.lng - cur.longitude) > 0.0005 ||
        Math.abs(nextZoom - curZoom) > 0.01
      ) {
        selfMoved.current = true;
        setMapCenter({ latitude: c.lat, longitude: c.lng }, nextZoom);
      }
    };
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [map, setMapCenter]);

  // Recentre when something *else* moved the map — search, nearby list.
  useEffect(() => {
    if (!map) return;
    if (selfMoved.current) {
      selfMoved.current = false;
      return;
    }
    map.setView([mapCenter.latitude, mapCenter.longitude], toLeafletZoom(zoom), {
      animate: true,
    });
  }, [map, mapCenter, zoom]);

  // Route lines: a dark casing under a coloured line, as in MapLibre.
  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup();
    for (const line of routeLines) {
      const latlngs = line.points.map((p) => [p.latitude, p.longitude] as [number, number]);
      L.polyline(latlngs, {
        color: '#0b0b18',
        weight: 7,
        opacity: 0.55,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);
      L.polyline(latlngs, {
        color: line.color,
        weight: 3.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);
    }
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, routeLines]);

  const select = useCallback(
    (item: MapItem) => {
      if (onSelect) onSelect(item);
      else setSelectedItem(item);
      map?.panTo([item.location.latitude, item.location.longitude], { duration: 0.55 });
    },
    [map, onSelect, setSelectedItem],
  );

  const slots = useMemo<Slot[]>(() => {
    const list: Slot[] = visibleItems.map((item) => ({
      key: `${item.type}-${item.id}`,
      latitude: item.location.latitude,
      longitude: item.location.longitude,
    }));
    if (showUser && userLocation) {
      list.push({ key: '__user', ...userLocation, zIndexOffset: 500 });
    }
    if (pin) list.push({ key: '__pin', ...pin, zIndexOffset: 1000 });
    return list;
  }, [visibleItems, showUser, userLocation, pin]);

  const nodes = useLeafletSlots(map, slots);

  return (
    <div className="map-canvas map-canvas--leaflet">
      <div ref={setContainer} className="leaflet-host" />

      {visibleItems.map((item) => {
        const node = nodes[`${item.type}-${item.id}`];
        return node
          ? createPortal(
              <div className="ns-leaflet-anchor ns-leaflet-anchor--center">
                <MapMarkerButton
                  item={item}
                  safety={safety}
                  foundCacheIds={foundCacheIds}
                  markerSize={markerSize}
                  onSelect={select}
                />
              </div>,
              node,
              `${item.type}-${item.id}`,
            )
          : null;
      })}

      {nodes.__user
        ? createPortal(
            <div className="ns-leaflet-anchor ns-leaflet-anchor--center">
              <UserDot />
            </div>,
            nodes.__user,
            '__user',
          )
        : null}

      {nodes.__pin
        ? createPortal(
            <div className="ns-leaflet-anchor ns-leaflet-anchor--bottom">
              <BigPin />
            </div>,
            nodes.__pin,
            '__pin',
          )
        : null}

      {fallbackNote === 'top' ? <FallbackNote /> : null}
    </div>
  );
}

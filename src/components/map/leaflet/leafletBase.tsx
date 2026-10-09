import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ESRI_ATTRIBUTION, RASTER_BASEMAPS } from '../mapStyles';
import type { MapStyleId } from '@/store/appStore';

/*
 * Shared plumbing for the Leaflet maps — the fallback used when the browser
 * cannot draw WebGL (hardware acceleration off, blocklisted GPU, crashed GPU
 * process). Leaflet draws with plain DOM: <img> tiles and positioned elements,
 * so it works anywhere. This module is only ever reached through a lazy
 * import, so browsers with working WebGL never download Leaflet.
 */

/*
 * MapLibre measures zoom against 512 px tiles, Leaflet against 256 px, so the
 * same view is one level higher in Leaflet. The store keeps MapLibre's scale;
 * convert at the edges so switching engines keeps the same view.
 */
export const toLeafletZoom = (mapLibreZoom: number) => mapLibreZoom + 1;
export const fromLeafletZoom = (leafletZoom: number) => leafletZoom - 1;

/** Esri basemap + label tiles — the same keyless services MapLibre uses. */
export function addBasemap(map: L.Map, styleId: MapStyleId): L.LayerGroup {
  const style = RASTER_BASEMAPS[styleId];
  const common = { maxNativeZoom: style.maxzoom, maxZoom: 19, tileSize: 256 } as const;
  const group = L.layerGroup([
    L.tileLayer(style.base, { ...common, attribution: ESRI_ATTRIBUTION }),
    L.tileLayer(style.labels, common),
  ]);
  group.addTo(map);
  map.getContainer().style.background = style.background;
  return group;
}

export function createLeafletMap(
  el: HTMLElement,
  options: { latitude: number; longitude: number; zoom: number; interactive: boolean },
): L.Map {
  const { interactive } = options;
  const map = L.map(el, {
    center: [options.latitude, options.longitude],
    zoom: toLeafletZoom(options.zoom),
    // MapLibre's zoom is continuous; keep quarter steps so a view carried
    // over from it lands close to where it was.
    zoomSnap: 0.25,
    zoomControl: false,
    attributionControl: true,
    dragging: interactive,
    touchZoom: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    boxZoom: interactive,
    keyboard: interactive,
  });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  return map;
}

/** Keep Leaflet's idea of its size in step with a flexbox-sized container. */
export function useLeafletResize(map: L.Map | null, el: HTMLElement | null) {
  useEffect(() => {
    if (!map || !el) return;
    const resize = () => map.invalidateSize({ pan: false });
    const timers = [50, 250, 800].map((ms) => window.setTimeout(resize, ms));
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      observer.observe(el);
    }
    window.addEventListener('orientationchange', resize);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      observer?.disconnect();
      window.removeEventListener('orientationchange', resize);
    };
  }, [map, el]);
}

export interface Slot {
  key: string;
  latitude: number;
  longitude: number;
  zIndexOffset?: number;
}

/**
 * One empty Leaflet marker per slot, returned as DOM nodes to portal into.
 *
 * Markers are rendered by React (the same <MapMarkerButton> MapLibre uses)
 * and portalled into these nodes, so both maps share one marker component,
 * one set of classes and one accessible label. Leaflet only positions them.
 */
export function useLeafletSlots(map: L.Map | null, slots: Slot[]): Record<string, HTMLElement> {
  const markers = useRef(new Map<string, L.Marker>());
  const [elements, setElements] = useState<Record<string, HTMLElement>>({});

  const signature = slots
    .map((s) => `${s.key}@${s.latitude.toFixed(6)},${s.longitude.toFixed(6)}`)
    .join('|');

  useEffect(() => {
    if (!map) return;
    const current = markers.current;
    const wanted = new Set(slots.map((s) => s.key));

    for (const [key, marker] of current) {
      if (!wanted.has(key)) {
        marker.remove();
        current.delete(key);
      }
    }

    for (const slot of slots) {
      const existing = current.get(slot.key);
      if (existing) {
        existing.setLatLng([slot.latitude, slot.longitude]);
        continue;
      }
      const marker = L.marker([slot.latitude, slot.longitude], {
        icon: L.divIcon({ className: 'ns-leaflet-slot', html: '', iconSize: [0, 0] }),
        // React owns the clicks; Leaflet only places the node.
        interactive: false,
        keyboard: false,
        zIndexOffset: slot.zIndexOffset ?? 0,
      }).addTo(map);
      const el = marker.getElement();
      if (el) {
        // A press on a marker must not start a drag or reach the map.
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);
      }
      current.set(slot.key, marker);
    }

    const next: Record<string, HTMLElement> = {};
    for (const [key, marker] of current) {
      const el = marker.getElement();
      if (el) next[key] = el;
    }
    setElements(next);
    // `signature` stands in for `slots`, which is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);

  useEffect(() => {
    const current = markers.current;
    return () => {
      for (const marker of current.values()) marker.remove();
      current.clear();
    };
  }, [map]);

  return elements;
}

export const FALLBACK_NOTE_TEXT = 'Simple map: your browser has 3D graphics switched off';

/** The small note that says why this map looks simpler. */
export function FallbackNote() {
  return (
    <p className="map-fallback-note" role="note">
      {FALLBACK_NOTE_TEXT}
    </p>
  );
}

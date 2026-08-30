import type { StyleSpecification } from 'maplibre-gl';
import type { MapStyleId } from '@/store/appStore';

/**
 * Basemap styles that need no API key.
 *
 * The brief asked for Mapbox; Mapbox GL JS requires an access token, so Night
 * Shield runs on MapLibre (BSD) instead. `react-map-gl/maplibre` keeps the
 * component API identical, so moving to Mapbox later means changing this file
 * and the import in MapView.
 *
 * Tiles come from ArcGIS Online's open basemap services. CARTO's tiles were
 * the first choice but now stamp "API KEY REQUIRED" across unauthenticated
 * requests. If the municipality buys a tile plan, swap the URLs here — nothing
 * else in the app knows where tiles come from.
 */

const ESRI_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; sources: Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const esri = (service: string) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;

/**
 * Esri's Canvas basemaps split geography and labels across two services, so
 * labels stay legible over the markers.
 */
function canvasStyle(
  base: string,
  reference: string,
  background: string,
  maxzoom: number,
): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [esri(base)],
        tileSize: 256,
        maxzoom,
        attribution: ESRI_ATTRIBUTION,
      },
      labels: {
        type: 'raster',
        tiles: [esri(reference)],
        tileSize: 256,
        maxzoom,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': background } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
      { id: 'labels', type: 'raster', source: 'labels' },
    ],
  };
}

export const MAP_STYLES: Record<MapStyleId, StyleSpecification> = {
  dark: canvasStyle(
    'Canvas/World_Dark_Gray_Base',
    'Canvas/World_Dark_Gray_Reference',
    '#1a1a2e',
    16,
  ),
  light: canvasStyle(
    'Canvas/World_Light_Gray_Base',
    'Canvas/World_Light_Gray_Reference',
    '#e8e8ec',
    16,
  ),
  satellite: {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [esri('World_Imagery')],
        tileSize: 256,
        maxzoom: 18,
        attribution: ESRI_ATTRIBUTION,
      },
      labels: {
        type: 'raster',
        tiles: [esri('Reference/World_Boundaries_and_Places')],
        tileSize: 256,
        maxzoom: 18,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0b1020' } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
      { id: 'labels', type: 'raster', source: 'labels' },
    ],
  },
};

export const MAP_STYLE_LABELS: Record<MapStyleId, string> = {
  dark: 'Dark',
  light: 'Light',
  satellite: 'Satellite',
};

export const MARKER_SIZE_CLASS = {
  small: 'map-marker--sm',
  medium: '',
  large: 'map-marker--lg',
} as const;

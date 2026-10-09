import type { StyleSpecification } from 'maplibre-gl';
import type { MapStyleId } from '@/store/appStore';

/**
 * Basemap styles that need no API key.
 *
 * The brief asked for Mapbox; Mapbox GL JS requires an access token, so Night
 * Shield runs on MapLibre (BSD) instead. `react-map-gl/maplibre` keeps the
 * component API identical, so moving to Mapbox later means changing this file
 * and the import in MapLibreView.
 *
 * Tiles come from ArcGIS Online's open basemap services. CARTO's tiles were
 * the first choice but now stamp "API KEY REQUIRED" across unauthenticated
 * requests. If the municipality buys a tile plan, swap the URLs here — nothing
 * else in the app knows where tiles come from. That includes the Leaflet
 * fallback for browsers without WebGL, which reads RASTER_BASEMAPS below so
 * both maps always show the same tiles.
 */

export const ESRI_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; sources: Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const esri = (service: string) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;

export interface RasterBasemap {
  /** Geography tiles. */
  base: string;
  /** Labels, drawn over the geography so they stay legible over markers. */
  labels: string;
  maxzoom: number;
  background: string;
}

/**
 * Esri's Canvas basemaps split geography and labels across two services, so
 * labels stay legible over the markers.
 */
export const RASTER_BASEMAPS: Record<MapStyleId, RasterBasemap> = {
  dark: {
    base: esri('Canvas/World_Dark_Gray_Base'),
    labels: esri('Canvas/World_Dark_Gray_Reference'),
    maxzoom: 16,
    background: '#1a1a2e',
  },
  light: {
    base: esri('Canvas/World_Light_Gray_Base'),
    labels: esri('Canvas/World_Light_Gray_Reference'),
    maxzoom: 16,
    background: '#e8e8ec',
  },
  satellite: {
    base: esri('World_Imagery'),
    labels: esri('Reference/World_Boundaries_and_Places'),
    maxzoom: 18,
    background: '#0b1020',
  },
};

function rasterStyle({ base, labels, maxzoom, background }: RasterBasemap): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [base],
        tileSize: 256,
        maxzoom,
        attribution: ESRI_ATTRIBUTION,
      },
      labels: {
        type: 'raster',
        tiles: [labels],
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
  dark: rasterStyle(RASTER_BASEMAPS.dark),
  light: rasterStyle(RASTER_BASEMAPS.light),
  satellite: rasterStyle(RASTER_BASEMAPS.satellite),
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

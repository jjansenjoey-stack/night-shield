import { useMemo, useRef } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { TILBURG } from '@/styles/tokens';
import { MAP_STYLES } from '@/components/map/mapStyles';
import type { LatLng } from '@/types';

interface Props {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  /** MapLibre could not get, or lost, its WebGL context — swap to Leaflet. */
  onWebglError?: (error: unknown) => void;
}

/**
 * The WebGL half of the location picker: tap the map to drop a pin. The
 * coordinate inputs and the choice of engine live in LocationPickerLazy.
 */
export function GlPickerMap({ value, onChange, onWebglError }: Props) {
  // Same reason as MapLibreView: MapLibre consumes the style object it is given.
  const pickerStyle = useMemo(() => structuredClone(MAP_STYLES.dark), []);
  const onWebglErrorRef = useRef(onWebglError);
  onWebglErrorRef.current = onWebglError;

  return (
    <Map
      initialViewState={{
        latitude: value?.latitude ?? TILBURG.latitude,
        longitude: value?.longitude ?? TILBURG.longitude,
        zoom: value ? 15 : TILBURG.zoom,
      }}
      mapStyle={pickerStyle}
      style={{ width: '100%', height: '100%' }}
      onClick={(event) => onChange({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })}
      onLoad={(event) =>
        event.target.on('webglcontextlost', () =>
          onWebglErrorRef.current?.(new Error('WebGL context lost')),
        )
      }
      onError={(event) => {
        // Tile and network errors also arrive here; only WebGL ones matter.
        const message = event.error?.message ?? '';
        if (/webgl|context/i.test(message)) onWebglErrorRef.current?.(event.error);
      }}
      attributionControl
    >
      {value ? (
        <Marker latitude={value.latitude} longitude={value.longitude} anchor="bottom">
          <MapPin size={30} color="var(--accent1)" fill="var(--accent1)" aria-hidden="true" />
        </Marker>
      ) : null}
    </Map>
  );
}

import { useMemo } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { TILBURG } from '@/styles/tokens';
import { MAP_STYLES } from '@/components/map/mapStyles';
import type { LatLng } from '@/types';

interface Props {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  height?: number;
  /** Keeps the coordinate input ids unique when two pickers share a page. */
  idPrefix?: string;
}

/**
 * Tap the map to drop a pin, or type the coordinates. Used by the event and
 * submission forms.
 */
export function LocationPicker({ value, onChange, height = 220, idPrefix = 'pin' }: Props) {
  // Same reason as MapView: MapLibre consumes the style object it is given.
  const pickerStyle = useMemo(() => structuredClone(MAP_STYLES.dark), []);

  return (
    <div className="stack stack--xs">
      <div
        style={{
          height,
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
      <Map
        initialViewState={{
          latitude: value?.latitude ?? TILBURG.latitude,
          longitude: value?.longitude ?? TILBURG.longitude,
          zoom: value ? 15 : TILBURG.zoom,
        }}
        mapStyle={pickerStyle}
        style={{ width: '100%', height: '100%' }}
        onClick={(event) =>
          onChange({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })
        }
        attributionControl
      >
          {value ? (
            <Marker latitude={value.latitude} longitude={value.longitude} anchor="bottom">
              <MapPin size={30} color="var(--accent1)" fill="var(--accent1)" aria-hidden="true" />
            </Marker>
          ) : null}
        </Map>
      </div>

      {/*
        Clicking the map is a mouse-only gesture, and the pin is required to
        submit — so the same value has to be reachable from the keyboard.
      */}
      <div className="grid grid--2" style={{ gap: '0.4rem' }}>
        <div className="field" style={{ margin: 0 }}>
          <label className="field__hint" htmlFor={`${idPrefix}-lat`}>
            Latitude
          </label>
          <input
            id={`${idPrefix}-lat`}
            className="input"
            type="number"
            step="0.0001"
            inputMode="decimal"
            value={value?.latitude ?? ''}
            placeholder={String(TILBURG.latitude)}
            onChange={(e) =>
              onChange({
                latitude: Number(e.target.value),
                longitude: value?.longitude ?? TILBURG.longitude,
              })
            }
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label className="field__hint" htmlFor={`${idPrefix}-lng`}>
            Longitude
          </label>
          <input
            id={`${idPrefix}-lng`}
            className="input"
            type="number"
            step="0.0001"
            inputMode="decimal"
            value={value?.longitude ?? ''}
            placeholder={String(TILBURG.longitude)}
            onChange={(e) =>
              onChange({
                latitude: value?.latitude ?? TILBURG.latitude,
                longitude: Number(e.target.value),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

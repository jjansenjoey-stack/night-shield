import { lazy, Suspense } from 'react';
import { TILBURG } from '@/styles/tokens';
import { MapEngineBoundary, useMapEngine } from '@/components/map/MapView';
import type { LatLng } from '@/types';

/**
 * The map picker, loaded only when a form actually shows one.
 *
 * Without this the whole map engine rides into the entry chunk on a chain
 * nobody would guess at: any page that can open a detail sheet imports
 * DetailModal, which imports EventDetailModal, which imports EventForm for the
 * edit view, which imports LocationPicker, which imports react-map-gl. So
 * opening the events calendar downloaded 762 kB of MapLibre for a map that was
 * three modals away and might never be opened.
 *
 * Lazy-loading the four map *pages* was not enough on its own for exactly that
 * reason. This is the cut that actually works.
 *
 * The map half comes in two engines, like MapView: MapLibre where WebGL works,
 * Leaflet where it does not (or fails, or is forced off with `?nowebgl=1`).
 * Each is its own chunk, so only the one in use is downloaded.
 */
const GlPickerMap = lazy(() =>
  import('./LocationPicker').then((m) => ({ default: m.GlPickerMap })),
);
const LeafletPickerMap = lazy(() =>
  import('@/components/map/leaflet/LeafletPickerMap').then((m) => ({
    default: m.LeafletPickerMap,
  })),
);

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
  const { engine, fallBack } = useMapEngine();

  return (
    <div className="stack stack--xs">
      <div
        style={{
          height,
          position: 'relative',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        <Suspense
          fallback={
            <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
              <span className="small muted">Loading the map…</span>
            </div>
          }
        >
          {engine === 'webgl' ? (
            <MapEngineBoundary onError={fallBack}>
              <GlPickerMap value={value} onChange={onChange} onWebglError={fallBack} />
            </MapEngineBoundary>
          ) : (
            <LeafletPickerMap value={value} onChange={onChange} />
          )}
        </Suspense>
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

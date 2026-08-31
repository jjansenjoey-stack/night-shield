import { lazy, Suspense } from 'react';
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
 */
const Picker = lazy(() =>
  import('./LocationPicker').then((m) => ({ default: m.LocationPicker })),
);

interface Props {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  height?: number;
  idPrefix?: string;
}

export function LocationPicker(props: Props) {
  const height = props.height ?? 220;

  return (
    <Suspense
      fallback={
        <div
          style={{
            height,
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span className="small muted">Loading the map…</span>
        </div>
      }
    >
      <Picker {...props} />
    </Suspense>
  );
}

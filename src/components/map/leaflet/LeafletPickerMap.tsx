import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { TILBURG } from '@/styles/tokens';
import {
  addBasemap,
  createLeafletMap,
  FallbackNote,
  useLeafletResize,
  useLeafletSlots,
  type Slot,
} from './leafletBase';
import type { LatLng } from '@/types';

/**
 * The location picker's map for browsers without WebGL: tap to drop a pin,
 * exactly like the MapLibre version, on the same dark Esri tiles.
 */
export function LeafletPickerMap({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const initial = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!container) return;
    const start = initial.current;
    const created = createLeafletMap(container, {
      latitude: start?.latitude ?? TILBURG.latitude,
      longitude: start?.longitude ?? TILBURG.longitude,
      zoom: start ? 15 : TILBURG.zoom,
      interactive: true,
    });
    addBasemap(created, 'dark');
    L.control.zoom({ position: 'bottomright' }).addTo(created);
    created.on('click', (event: L.LeafletMouseEvent) =>
      onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }),
    );
    setMap(created);
    return () => {
      created.remove();
      setMap(null);
    };
  }, [container]);

  useLeafletResize(map, container);

  // Typed coordinates can be half-finished; only place a pin on real numbers.
  const slots = useMemo<Slot[]>(
    () =>
      value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
        ? [{ key: 'pin', latitude: value.latitude, longitude: value.longitude }]
        : [],
    [value],
  );
  const nodes = useLeafletSlots(map, slots);

  return (
    <div className="map-canvas map-canvas--leaflet">
      <div ref={setContainer} className="leaflet-host" />
      {nodes.pin
        ? createPortal(
            <div className="ns-leaflet-anchor ns-leaflet-anchor--bottom">
              <MapPin size={30} color="var(--accent1)" fill="var(--accent1)" aria-hidden="true" />
            </div>,
            nodes.pin,
          )
        : null}
      <FallbackNote />
    </div>
  );
}

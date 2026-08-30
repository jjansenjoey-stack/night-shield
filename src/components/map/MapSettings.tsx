import { Brush, CalendarDays, Coffee, Route as RouteIcon, Search } from 'lucide-react';
import { useAppStore, type MapStyleId, type MarkerSize } from '@/store/appStore';
import { Modal } from '@/components/ui/Modal';
import { MAP_STYLE_LABELS } from './mapStyles';
import type { ItemType } from '@/types';

const STYLES: MapStyleId[] = ['dark', 'light', 'satellite'];
const SIZES: Array<{ value: MarkerSize; label: string }> = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];
const LAYERS: Array<{ type: ItemType; label: string; Icon: typeof Brush }> = [
  { type: 'installation', label: 'Art', Icon: Brush },
  { type: 'event', label: 'Events', Icon: CalendarDays },
  { type: 'route', label: 'Routes', Icon: RouteIcon },
  { type: 'third_space', label: 'Third spaces', Icon: Coffee },
  { type: 'cache', label: 'Night Caches', Icon: Search },
];

/** Prompt 44 — map preferences, persisted to localStorage by the store. */
export function MapSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = useAppStore((s) => s.prefs);
  const setPrefs = useAppStore((s) => s.setPrefs);
  const toggleLayer = useAppStore((s) => s.toggleLayer);

  return (
    <Modal open={open} onClose={onClose} title="Map settings">
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
        <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
          Map style
        </legend>
        <div className="row">
          {STYLES.map((style) => (
            <button
              key={style}
              className={`chip${prefs.style === style ? ' is-active' : ''}`}
              onClick={() => setPrefs({ style })}
              aria-pressed={prefs.style === style}
            >
              {MAP_STYLE_LABELS[style]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
        <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
          Marker size
        </legend>
        <div className="row">
          {SIZES.map((size) => (
            <button
              key={size.value}
              className={`chip${prefs.markerSize === size.value ? ' is-active' : ''}`}
              data-tone="teal"
              onClick={() => setPrefs({ markerSize: size.value })}
              aria-pressed={prefs.markerSize === size.value}
            >
              {size.label}
            </button>
          ))}
        </div>
        <p className="field__hint" style={{ marginTop: '0.4rem' }}>
          Larger markers are easier to hit on a phone or with limited dexterity.
        </p>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
          Layers
        </legend>
        <div className="grid grid--2" style={{ gap: '0.4rem' }}>
          {LAYERS.map(({ type, label, Icon }) => {
            const checked = prefs.layers[type];
            return (
              <label key={type} className={`check${checked ? ' is-checked' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleLayer(type)} />
                <span className="row" style={{ gap: '0.35rem' }}>
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </span>
              </label>
            );
          })}
        </div>
        <p className="field__hint" style={{ marginTop: '0.4rem' }}>
          Layers are remembered on this device.
        </p>
      </fieldset>
    </Modal>
  );
}

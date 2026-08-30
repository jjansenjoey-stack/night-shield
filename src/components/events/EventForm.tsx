import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { CheckboxGroup, Field } from '@/components/ui/Shared';
import { LocationPicker } from './LocationPicker';
import { createEvent, updateEvent, validateEvent } from '@/services/eventService';
import { A11Y_TAGS, a11yLabel, eventCategoryLabel } from '@/lib/format';
import type { EventCategory, LatLng, NightEvent } from '@/types';

const CATEGORIES: EventCategory[] = ['workshop', 'art_talk', 'social', 'nightlife'];

/** ISO string → the value a datetime-local input expects, in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const fromLocalInput = (value: string): string =>
  value ? new Date(value).toISOString() : '';

interface Props {
  initial?: NightEvent;
  onSaved: (event: NightEvent) => void | Promise<void>;
  onCancel?: () => void;
}

/** Prompts 50, 51 & 58 — one form for creating and editing, in-person or online. */
export function EventForm({ initial, onSaved, onCancel }: Props) {
  const user = useAppStore((s) => s.user);
  const toast = useToast();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<EventCategory>(initial?.category ?? 'workshop');
  const [startLocal, setStartLocal] = useState(toLocalInput(initial?.start_time ?? null));
  const [endLocal, setEndLocal] = useState(toLocalInput(initial?.end_time ?? null));
  const [isVirtual, setIsVirtual] = useState(initial?.is_virtual ?? false);
  const [virtualUrl, setVirtualUrl] = useState(initial?.virtual_url ?? '');
  const [location, setLocation] = useState<LatLng | null>(initial?.location ?? null);
  const [address, setAddress] = useState(initial?.address ?? '');
  const [capacity, setCapacity] = useState(initial?.capacity != null ? String(initial.capacity) : '');
  const [cost, setCost] = useState(String(initial?.cost_euros ?? 0));
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '');
  const [accessibility, setAccessibility] = useState<string[]>(initial?.accessibility ?? []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      location: isVirtual ? null : location,
      address: isVirtual ? null : address.trim() || null,
      start_time: fromLocalInput(startLocal),
      end_time: fromLocalInput(endLocal),
      capacity: capacity ? Number(capacity) : null,
      cost_euros: Number(cost) || 0,
      organizer_id: user.id,
      organizer_name: user.full_name ?? user.email,
      image_url: imageUrl.trim() || null,
      accessibility,
      is_virtual: isVirtual,
      virtual_url: isVirtual ? virtualUrl.trim() : null,
      is_featured: initial?.is_featured ?? false,
      updated_at: initial ? new Date().toISOString() : null,
    };

    const found = validateEvent({
      title: payload.title,
      start_time: payload.start_time,
      end_time: payload.end_time,
      is_virtual: payload.is_virtual,
      virtual_url: payload.virtual_url,
      location: payload.location,
      capacity: payload.capacity,
      cost_euros: payload.cost_euros,
    });

    // Editing an event that already started should not be blocked by the
    // "must be in the future" rule.
    if (initial) delete found.start_time;

    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Have another look — some fields need fixing.');
      return;
    }

    setSaving(true);
    try {
      const saved = initial
        ? await updateEvent(initial.id, payload)
        : await createEvent(payload);
      await onSaved(saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Event title" htmlFor="event-title" error={errors.title}>
        <input
          id="event-title"
          className="input"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={Boolean(errors.title)}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="event-description"
        hint="What happens, what to bring, who it is for."
      >
        <textarea
          id="event-description"
          className="textarea"
          value={description}
          maxLength={1500}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="Category" htmlFor="event-category">
        <select
          id="event-category"
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value as EventCategory)}
        >
          {CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {eventCategoryLabel(option)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid--2">
        <Field label="Starts" htmlFor="event-start" error={errors.start_time}>
          <input
            id="event-start"
            className="input"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            aria-invalid={Boolean(errors.start_time)}
          />
        </Field>
        <Field label="Ends" htmlFor="event-end" error={errors.end_time}>
          <input
            id="event-end"
            className="input"
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            aria-invalid={Boolean(errors.end_time)}
          />
        </Field>
      </div>

      <div className="field">
        <span className="field__label">Where</span>
        <div className="row">
          <button
            type="button"
            className={`chip${!isVirtual ? ' is-active' : ''}`}
            onClick={() => setIsVirtual(false)}
            aria-pressed={!isVirtual}
          >
            In person
          </button>
          <button
            type="button"
            className={`chip${isVirtual ? ' is-active' : ''}`}
            data-tone="teal"
            onClick={() => setIsVirtual(true)}
            aria-pressed={isVirtual}
          >
            Online
          </button>
        </div>
      </div>

      {isVirtual ? (
        <Field
          label="Video call link"
          htmlFor="event-url"
          error={errors.virtual_url}
          hint="Only shown to people who have RSVP'd."
        >
          <input
            id="event-url"
            className="input"
            type="url"
            placeholder="https://…"
            value={virtualUrl}
            onChange={(e) => setVirtualUrl(e.target.value)}
            aria-invalid={Boolean(errors.virtual_url)}
          />
        </Field>
      ) : (
        <>
          <Field label="Address" htmlFor="event-address">
            <input
              id="event-address"
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Veemarktstraat 44, Tilburg"
            />
          </Field>

          <Field
            label="Pin the location"
            hint="Tap the map, or type the coordinates below."
            error={errors.location}
          >
            <LocationPicker value={location} onChange={setLocation} idPrefix="event" />
          </Field>
        </>
      )}

      <div className="grid grid--2">
        <Field
          label="Capacity"
          htmlFor="event-capacity"
          hint="Leave empty for no limit."
          error={errors.capacity}
        >
          <input
            id="event-capacity"
            className="input"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <Field label="Cost (€)" htmlFor="event-cost" error={errors.cost_euros}>
          <input
            id="event-cost"
            className="input"
            type="number"
            min={0}
            step="0.5"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Image URL" htmlFor="event-image" hint="Optional — a photo helps people decide.">
        <input
          id="event-image"
          className="input"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <Field label="Accessibility" hint="Only tick what you can actually guarantee.">
        <CheckboxGroup
          options={A11Y_TAGS}
          selected={accessibility}
          labelFor={a11yLabel}
          onToggle={(tag) =>
            setAccessibility((current) =>
              current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
            )
          }
        />
      </Field>

      <div className="row">
        <Button type="submit" variant="primary" loading={saving}>
          {initial ? 'Save changes' : 'Create event'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

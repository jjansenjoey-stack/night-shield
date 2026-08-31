import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brush, Coffee, Send } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { LocationPicker } from '@/components/events/LocationPicker';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckboxGroup, Field } from '@/components/ui/Shared';
import { useToast } from '@/components/ui/Toast';
import { submitContent } from '@/services/submissionService';
import { addPoints, POINTS } from '@/services/pointsService';
import { A11Y_TAGS, a11yLabel, thirdSpaceLabel } from '@/lib/format';
import type { LatLng, SubmissionType, ThirdSpaceType } from '@/types';

const SPACE_TYPES: ThirdSpaceType[] = ['cafe', 'library', 'park', 'community_centre', 'studio'];
const ART_CATEGORIES = ['mural', 'sculpture', 'light', 'sound', 'graffiti', 'temporary'];

/** Prompt 28 — the community submission form that feeds the moderation queue. */
export function SubmitContentPage() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  const [kind, setKind] = useState<SubmissionType>('installation');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState(ART_CATEGORIES[0]);
  const [spaceType, setSpaceType] = useState<ThirdSpaceType>('cafe');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [cost, setCost] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [accessibility, setAccessibility] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    const found: Record<string, string> = {};
    if (!title.trim()) found.title = 'Give it a name.';
    if (!location) found.location = 'Place the pin on the map, or type its coordinates.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const payload =
        kind === 'installation'
          ? {
              title: title.trim(),
              artist: artist.trim() || null,
              description: description.trim() || null,
              location,
              address: address.trim() || null,
              images: imageUrl.trim() ? [imageUrl.trim()] : [],
              category,
              is_temporary: category === 'temporary',
              status: 'active' as const,
              accessibility,
              moderation_status: 'pending' as const,
            }
          : {
              name: title.trim(),
              type: spaceType,
              description: description.trim() || null,
              location,
              address: address.trim() || null,
              hours_open: hours.trim() || null,
              cost: cost.trim() || null,
              accessibility,
              image_url: imageUrl.trim() || null,
            };

      const submission = await submitContent(
        kind,
        user.id,
        user.full_name ?? user.email,
        payload as unknown as Record<string, unknown>,
      );
      await addPoints(user.id, 'submit_content', submission.id).catch(() => null);
      void markJourney('contributed');

      toast.success(
        `Sent for review — you will see it on the map once it is approved. +${POINTS.submit_content} points.`,
      );
      navigate('/discover');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send that.');
    } finally {
      setSaving(false);
    }
  }

  const isArt = kind === 'installation';

  return (
    <div className="page">
      <Button variant="ghost" onClick={() => navigate(-1)} icon={<ArrowLeft size={15} />}>
        Back
      </Button>

      <h1 style={{ fontSize: '1.7rem', marginTop: '0.5rem' }}>Add to the map</h1>
      <p className="page__lede">
        Tell us about a piece of art or a place where people can just be. A moderator checks it
        before it goes live — usually within a couple of days.
      </p>

      <Card>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <span className="field__label">What are you adding?</span>
            <div className="row">
              <button
                type="button"
                className={`chip${isArt ? ' is-active' : ''}`}
                onClick={() => setKind('installation')}
                aria-pressed={isArt}
              >
                <Brush size={13} aria-hidden="true" />
                Public art
              </button>
              <button
                type="button"
                className={`chip${!isArt ? ' is-active' : ''}`}
                data-tone="teal"
                onClick={() => setKind('third_space')}
                aria-pressed={!isArt}
              >
                <Coffee size={13} aria-hidden="true" />
                Third space
              </button>
            </div>
          </div>

          <Field label={isArt ? 'Title' : 'Name'} htmlFor="submit-title" error={errors.title}>
            <input
              id="submit-title"
              className="input"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={Boolean(errors.title)}
            />
          </Field>

          {isArt ? (
            <>
              <Field label="Artist" htmlFor="submit-artist" hint="Leave empty if you don't know.">
                <input
                  id="submit-artist"
                  className="input"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                />
              </Field>

              <Field label="Kind of work" htmlFor="submit-category">
                <select
                  id="submit-category"
                  className="select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {ART_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {option[0].toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Kind of place" htmlFor="submit-space-type">
                <select
                  id="submit-space-type"
                  className="select"
                  value={spaceType}
                  onChange={(e) => setSpaceType(e.target.value as ThirdSpaceType)}
                >
                  {SPACE_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {thirdSpaceLabel(option)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid--2">
                <Field label="Opening hours" htmlFor="submit-hours">
                  <input
                    id="submit-hours"
                    className="input"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Mon–Fri 09:00–21:00"
                  />
                </Field>
                <Field label="Cost" htmlFor="submit-cost">
                  <input
                    id="submit-cost"
                    className="input"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="Free"
                  />
                </Field>
              </div>
            </>
          )}

          <Field
            label="Description"
            htmlFor="submit-description"
            hint="What is it, and what should someone know before going?"
          >
            <textarea
              id="submit-description"
              className="textarea"
              value={description}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field label="Address" htmlFor="submit-address">
            <input
              id="submit-address"
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>

          <Field label="Where is it?" hint="Tap the map, or type the coordinates below." error={errors.location}>
            <LocationPicker value={location} onChange={setLocation} idPrefix="submit" />
          </Field>

          <Field label="Photo URL" htmlFor="submit-image" hint="Optional.">
            <input
              id="submit-image"
              className="input"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field
            label="Accessibility"
            hint="Only tick what you have seen for yourself. People rely on this."
          >
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

          <Button type="submit" variant="primary" loading={saving} icon={<Send size={15} />}>
            Send for review
          </Button>
        </form>
      </Card>
    </div>
  );
}

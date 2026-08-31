import { useState, type ReactNode } from 'react';
import {
  Accessibility,
  ChevronLeft,
  ChevronRight,
  Dog,
  Ear,
  ImageOff,
  Lightbulb,
  MoveHorizontal,
  ParkingCircle,
  ShieldCheck,
  DoorOpen,
  VolumeX,
} from 'lucide-react';
import { a11yLabel, initialsOf } from '@/lib/format';
import { SAFETY_BAND_META, safetyBand } from '@/services/feedbackService';
import type { SafetySummary, UserProfile } from '@/types';
import { Badge } from './Badge';

// ---- Accessibility icon row ----------------------------------------------

const A11Y_ICONS: Record<string, ReactNode> = {
  wheelchair: <Accessibility size={13} />,
  parking: <ParkingCircle size={13} />,
  quiet: <VolumeX size={13} />,
  pet_friendly: <Dog size={13} />,
  hearing_loop: <Ear size={13} />,
  service_animal: <Dog size={13} />,
  step_free: <MoveHorizontal size={13} />,
  well_lit: <Lightbulb size={13} />,
  gender_neutral_toilets: <DoorOpen size={13} />,
};

export function AccessibilityIcons({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="a11y-icons" aria-label="Accessibility features">
      {tags.map((tag) => (
        <li key={tag} className="a11y-icon">
          <span aria-hidden="true">{A11Y_ICONS[tag] ?? <ShieldCheck size={13} />}</span>
          {a11yLabel(tag)}
        </li>
      ))}
    </ul>
  );
}

// ---- Safety ---------------------------------------------------------------

/**
 * Safety is always shown as colour *and* words — a red dot on its own would
 * exclude anyone who cannot distinguish it (prompt 45).
 */
export function SafetyScore({ summary }: { summary: SafetySummary }) {
  const band = safetyBand(summary.average);
  const meta = SAFETY_BAND_META[band];

  return (
    <div className="stack stack--xs">
      <div className="row row--between">
        <span className="small">
          <strong>{summary.average.toFixed(1)}</strong>
          <span className="muted"> / 5 · {meta.label}</span>
        </span>
        <span className="tiny muted">{summary.count} reports</span>
      </div>
      <div
        className="safety-bar"
        role="img"
        aria-label={`Safety perception ${summary.average.toFixed(1)} out of 5 — ${meta.label}, based on ${summary.count} reports`}
      >
        <div
          className="safety-bar__fill"
          style={{ width: `${(summary.average / 5) * 100}%`, background: meta.color }}
        />
      </div>
      {summary.nightAverage !== null ? (
        <p className="tiny muted" style={{ margin: 0 }}>
          After 8 PM: <strong>{summary.nightAverage.toFixed(1)}</strong> / 5 across{' '}
          {summary.nightCount} reports
        </p>
      ) : (
        <p className="tiny muted" style={{ margin: 0 }}>
          Not enough night-time reports yet.
        </p>
      )}
    </div>
  );
}

export function SafetyPill({ summary }: { summary: SafetySummary }) {
  const band = safetyBand(summary.average);
  const meta = SAFETY_BAND_META[band];
  const tone = band === 'high' ? 'success' : band === 'medium' ? 'warning' : 'error';
  return (
    <Badge tone={tone} title={`${meta.label} — ${summary.count} reports`}>
      <ShieldCheck size={11} />
      {summary.average.toFixed(1)}
    </Badge>
  );
}

// ---- Image carousel -------------------------------------------------------

export function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  if (images.length === 0) {
    return (
      <div className="detail-hero">
        <div className="detail-hero__placeholder">
          <ImageOff size={30} aria-hidden="true" />
        </div>
      </div>
    );
  }

  const step = (delta: number) =>
    setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="detail-hero">
      {failed[index] ? (
        <div className="detail-hero__placeholder">
          <ImageOff size={30} aria-hidden="true" />
        </div>
      ) : (
        <img
          src={heroWidth(images[index])}
          alt={images.length > 1 ? `${alt} — photo ${index + 1} of ${images.length}` : alt}
          decoding="async"
          onError={() => setFailed((f) => ({ ...f, [index]: true }))}
        />
      )}

      {images.length > 1 ? (
        <>
          <button
            className="detail-hero__arrow"
            style={{ left: 8 }}
            onClick={() => step(-1)}
            aria-label="Previous photo"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="detail-hero__arrow"
            style={{ right: 8 }}
            onClick={() => step(1)}
            aria-label="Next photo"
          >
            <ChevronRight size={18} />
          </button>
          <div className="detail-hero__nav">
            {images.map((src, i) => (
              <button
                key={src}
                className={`detail-hero__dot${i === index ? ' is-active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/*
 * Seed photos are stored at card width so a list page stays light. The detail
 * hero is the one place the photo is shown large, so it asks Commons for a
 * bigger rendering of the same file. Commons snaps to its own width buckets,
 * so this is a hint rather than an exact size, and any URL that is not a
 * Commons one is returned untouched.
 */
function heroWidth(url: string): string {
  return url.includes('commons.wikimedia.org') ? url.replace(/width=d+/, 'width=960') : url;
}

/*
 * An <img> that is never a blank hole.
 *
 * These photos come from Wikimedia over two redirects, so on a cold cache
 * there is a real gap between the card appearing and the photo arriving. An
 * <img> with nothing behind it renders that gap as empty space, and a page of
 * cards then reads as broken rather than as loading. Painting the tint on the
 * image element itself keeps the caller in charge of size and layout — the
 * photo covers the tint when it lands, and a failure swaps in a real tile.
 */
export function SafeImage({
  src,
  alt,
  className,
  style,
}: {
  src: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) {
    return (
      <div className={className} style={{ ...style, display: 'grid', placeItems: 'center' }}>
        <ImageOff size={18} aria-hidden="true" />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      data-loading={loaded ? undefined : true}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

// ---- Avatar ---------------------------------------------------------------

export function Avatar({ user, small }: { user: UserProfile; small?: boolean }) {
  const initials = initialsOf(user.full_name, user.email);
  const className = `avatar${small ? ' avatar--sm' : ''}`;

  if (user.avatar_url) {
    return <img src={user.avatar_url} alt="" className={className} />;
  }
  return (
    <span className={className} aria-hidden="true">
      {initials}
    </span>
  );
}

// ---- Form field -----------------------------------------------------------

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? <span className="field__hint">{hint}</span> : null}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function CheckboxGroup({
  options,
  selected,
  onToggle,
  labelFor,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  labelFor: (value: string) => string;
}) {
  return (
    <div className="grid grid--2" style={{ gap: '0.4rem' }}>
      {options.map((option) => {
        const checked = selected.includes(option);
        return (
          <label key={option} className={`check${checked ? ' is-checked' : ''}`}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(option)} />
            <span>{labelFor(option)}</span>
          </label>
        );
      })}
    </div>
  );
}

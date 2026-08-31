import { useState } from 'react';
import { Star } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Shared';
import { submitFeedback } from '@/services/feedbackService';
import { addPoints, POINTS } from '@/services/pointsService';
import { currentTimeOfDay } from '@/lib/format';
import type { NightEvent } from '@/types';

/** Prompt 55 — post-event survey, worth points. */
export function EventFeedbackForm({
  event,
  onDone,
}: {
  event: NightEvent;
  onDone: () => void;
}) {
  const user = useAppStore((s) => s.user);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  const [rating, setRating] = useState(0);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;

    setSaving(true);
    try {
      const note = [
        comment.trim(),
        wouldReturn === null ? '' : wouldReturn ? 'Would attend again.' : 'Would not attend again.',
      ]
        .filter(Boolean)
        .join(' ');

      await submitFeedback({
        userId: user?.id ?? null,
        locationId: event.id,
        // 'event', not 'safety' — a rating of the workshop is not a statement
        // about how the street outside felt, and must not become a map score.
        kind: 'event',
        timeOfDay: currentTimeOfDay(new Date(event.start_time)),
        safetyPerception: rating,
        comment: note || null,
        isAnonymous: true,
      });

      if (user) {
        await addPoints(user.id, 'event_feedback', event.id).catch(() => null);
        void markJourney('connected');
      }
      toast.success(
        user ? `Thanks for the feedback. +${POINTS.event_feedback} points.` : 'Thanks for the feedback.',
      );
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send that.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack stack--xs">
      <h4 style={{ margin: 0 }}>How was &ldquo;{event.title}&rdquo;?</h4>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Rating out of 5</legend>
        <div className="row" style={{ gap: '0.25rem' }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className="btn btn--ghost"
              style={{ padding: '0.2rem' }}
              onClick={() => setRating(value)}
              aria-label={`${value} out of 5`}
              aria-pressed={rating === value}
            >
              <Star
                size={24}
                fill={value <= rating ? 'var(--warning)' : 'none'}
                color={value <= rating ? 'var(--warning)' : 'var(--text-muted)'}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: '0.35rem' }}>
          Would you come to another one?
        </legend>
        <div className="row">
          <button
            type="button"
            className={`chip${wouldReturn === true ? ' is-active' : ''}`}
            onClick={() => setWouldReturn(true)}
            aria-pressed={wouldReturn === true}
          >
            Yes
          </button>
          <button
            type="button"
            className={`chip${wouldReturn === false ? ' is-active' : ''}`}
            onClick={() => setWouldReturn(false)}
            aria-pressed={wouldReturn === false}
          >
            No
          </button>
        </div>
      </fieldset>

      <Field label="Anything else? (optional)" htmlFor="event-feedback-comment">
        <textarea
          id="event-feedback-comment"
          className="textarea"
          style={{ minHeight: 70 }}
          value={comment}
          maxLength={500}
          onChange={(e) => setComment(e.target.value)}
        />
      </Field>

      <div className="row">
        <Button type="submit" variant="primary" loading={saving} disabled={rating === 0}>
          Send feedback
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Not now
        </Button>
      </div>
    </form>
  );
}

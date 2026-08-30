import { useState } from 'react';
import { ShieldCheck, Star } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Shared';
import { submitFeedback } from '@/services/feedbackService';
import { addPoints } from '@/services/pointsService';
import { currentTimeOfDay, timeOfDayLabel } from '@/lib/format';
import type { TimeOfDay } from '@/types';

const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

const SCORE_WORDS = [
  '',
  'Felt unsafe',
  'Felt uneasy',
  'Neither way',
  'Felt fine',
  'Felt safe',
] as const;

interface Props {
  locationId: string;
  onSubmitted: () => void;
}

/** Prompt 26 — how a place felt, anonymous by default. */
export function FeedbackForm({ locationId, onSubmitted }: Props) {
  const user = useAppStore((s) => s.user);
  const markJourney = useAppStore((s) => s.markJourney);
  const refreshData = useAppStore((s) => s.refreshData);
  const toast = useToast();

  const [score, setScore] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(currentTimeOfDay());
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (score === 0) return;

    setSaving(true);
    try {
      await submitFeedback({
        userId: user?.id ?? null,
        locationId,
        timeOfDay,
        safetyPerception: score,
        comment: comment.trim() || null,
        isAnonymous: anonymous,
      });

      if (user) {
        await addPoints(user.id, 'submit_feedback').catch(() => null);
        void markJourney('contributed');
      }

      toast.success(
        user ? 'Thanks — your report is in, +10 points.' : 'Thanks — your report is in.',
      );
      await refreshData();
      onSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save that report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack stack--xs">
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: '0.35rem' }}>
          How did this place feel?
        </legend>
        <div className="row" style={{ gap: '0.25rem' }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className="btn btn--ghost"
              style={{ padding: '0.2rem' }}
              onClick={() => setScore(value)}
              aria-label={`${value} out of 5 — ${SCORE_WORDS[value]}`}
              aria-pressed={score === value}
            >
              <Star
                size={26}
                fill={value <= score ? 'var(--warning)' : 'none'}
                color={value <= score ? 'var(--warning)' : 'var(--text-muted)'}
              />
            </button>
          ))}
          <span className="small muted" style={{ marginLeft: '0.35rem' }}>
            {score ? SCORE_WORDS[score] : 'Pick a rating'}
          </span>
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: '0.35rem' }}>
          When were you there?
        </legend>
        <div className="row">
          {TIMES.map((time) => (
            <button
              key={time}
              type="button"
              className={`chip${timeOfDay === time ? ' is-active' : ''}`}
              data-tone="teal"
              onClick={() => setTimeOfDay(time)}
              aria-pressed={timeOfDay === time}
            >
              {timeOfDayLabel(time)}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Anything you want to add? (optional)" htmlFor="feedback-comment">
        <textarea
          id="feedback-comment"
          className="textarea"
          style={{ minHeight: 80 }}
          value={comment}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What made it feel that way — lighting, people around, something else?"
        />
      </Field>

      {user ? (
        <label className={`check${anonymous ? ' is-checked' : ''}`}>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(event) => setAnonymous(event.target.checked)}
          />
          <span>
            Post anonymously
            <span className="field__hint" style={{ display: 'block' }}>
              Your name is never shown either way — this also detaches the report from your account.
            </span>
          </span>
        </label>
      ) : (
        <p className="tiny muted">
          <ShieldCheck size={12} style={{ verticalAlign: '-2px' }} /> Reports from guests are
          always anonymous.
        </p>
      )}

      <Button type="submit" variant="primary" loading={saving} disabled={score === 0}>
        Share how it felt
      </Button>
    </form>
  );
}

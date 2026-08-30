import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ShieldCheck, Shuffle } from 'lucide-react';
import { loadOnboardingPreference, storeOnboardingPreference, useAppStore } from '@/store/appStore';
import { updateUserProfile } from '@/services/authService';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { MentalityPreference } from '@/types';

const OPTIONS: Array<{
  value: MentalityPreference;
  Icon: typeof Compass;
  title: string;
  body: string;
}> = [
  {
    value: 'vigilant',
    Icon: ShieldCheck,
    title: 'I like clarity and safe routes',
    body: 'Show me lit streets, step-free paths and places that stay busy. I want to know what I am walking into.',
  },
  {
    value: 'explorer',
    Icon: Compass,
    title: 'I love exploration and discovery',
    body: 'Put the unfamiliar first. I would rather find something new than take the same road twice.',
  },
  {
    value: 'both',
    Icon: Shuffle,
    title: 'Depends on the night',
    body: 'Show me both, and let me switch between them whenever I want.',
  },
];

/** Prompt 3 — one question, skippable, stored locally and on the profile. */
export function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const toast = useToast();

  const [choice, setChoice] = useState<MentalityPreference | null>(loadOnboardingPreference());
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!choice) return;
    setSaving(true);
    storeOnboardingPreference(choice);

    // Guests keep the preference locally; it syncs on their first sign-in.
    if (user) {
      try {
        const updated = await updateUserProfile(user.id, { onboarding_preference: choice });
        setUser(updated);
      } catch {
        toast.error('Saved on this device, but we could not sync it to your profile.');
      }
    }

    setSaving(false);
    navigate('/discover');
  }

  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 560 }}>
        <h1 style={{ fontSize: '1.8rem' }}>How do you prefer to move through the city?</h1>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          This only changes what Night Shield shows you first. Nothing is ever hidden, and you can
          change your answer whenever you like.
        </p>

        <div className="stack stack--xs" role="radiogroup" aria-label="Movement preference">
          {OPTIONS.map(({ value, Icon, title, body }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={choice === value}
              className={`mentality-option${choice === value ? ' is-selected' : ''}`}
              onClick={() => setChoice(value)}
            >
              <Icon
                size={22}
                aria-hidden="true"
                color={choice === value ? 'var(--accent1)' : 'var(--accent2)'}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <span>
                <strong style={{ display: 'block' }}>{title}</strong>
                <span className="small muted">{body}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: '1.5rem' }}>
          <Button variant="primary" onClick={handleContinue} disabled={!choice} loading={saving}>
            Continue
          </Button>
          <Button variant="ghost" onClick={() => navigate('/discover')}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

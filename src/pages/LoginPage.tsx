import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore, loadOnboardingPreference } from '@/store/appStore';
import { loginUser, readableAuthError, updateUserProfile } from '@/services/authService';
import { getUserJourneyProgress, initializeJourney } from '@/services/journeyService';
import { isSupabaseConfigured } from '@/services/supabaseConfig';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Shared';
import { useToast } from '@/components/ui/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Prompts 4 & 13 — login UI plus session restore. */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAppStore((s) => s.setUser);
  const refreshSaved = useAppStore((s) => s.refreshSaved);
  const setJourney = useAppStore((s) => s.setJourney);
  const refreshRsvps = useAppStore((s) => s.refreshRsvps);
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/discover';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) found.email = 'Enter a valid email address.';
    if (!password) found.password = 'Enter your password.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      let user = await loginUser(email.trim(), password);

      // Sync a preference chosen while browsing as a guest.
      const local = loadOnboardingPreference();
      if (local && !user.onboarding_preference) {
        user = await updateUserProfile(user.id, { onboarding_preference: local }).catch(() => user);
      }

      setUser(user);
      // Put the journey in the store, not just on the server — otherwise the
      // next /discover visit sees a null journey and rewinds the stage.
      const existing = await getUserJourneyProgress(user.id).catch(() => null);
      const journey = existing ?? (await initializeJourney(user.id).catch(() => null));
      setJourney(journey);

      await Promise.allSettled([refreshSaved(), refreshRsvps()]);

      toast.success(`Welcome back${user.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}.`);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(readableAuthError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Log in</h1>
        <p className="muted small" style={{ marginBottom: '1.25rem' }}>
          Pick up your saved routes and events.
        </p>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <Field label="Email" htmlFor="login-email" error={errors.email}>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>

          <Field label="Password" htmlFor="login-password" error={errors.password}>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
          </Field>

          <div className="row row--between" style={{ marginBottom: '1rem' }}>
            <Link to="/forgot-password" className="link-btn">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="primary" block loading={saving}>
            Log in
          </Button>
        </form>

        <p className="small muted center" style={{ marginTop: '1rem', marginBottom: 0 }}>
          Don&rsquo;t have an account? <Link to="/signup">Sign up</Link>
        </p>

        {!isSupabaseConfigured ? (
          <p className="tiny muted center" style={{ marginTop: '1rem', marginBottom: 0 }}>
            Running on local demo data. Try{' '}
            <code>organizer@nightshield.tilburg.nl</code> /{' '}
            <code>nightshield</code> for an organizer account, or{' '}
            <code>admin@nightshield.tilburg.nl</code> for a moderator.
          </p>
        ) : null}
      </div>
    </div>
  );
}

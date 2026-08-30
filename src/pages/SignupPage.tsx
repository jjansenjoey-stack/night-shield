import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore, loadOnboardingPreference } from '@/store/appStore';
import { readableAuthError, signupUser, updateUserProfile } from '@/services/authService';
import { initializeJourney } from '@/services/journeyService';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Shared';
import { useToast } from '@/components/ui/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Prompts 4 & 12 — signup UI plus the real backend call. */
export function SignupPage() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function validate() {
    const found: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) found.email = 'Enter a valid email address.';
    if (password.length < 8) found.password = 'Use at least 8 characters.';
    if (password !== confirm) found.confirm = 'The two passwords do not match.';
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const user = await signupUser(email.trim(), password);

      // Carry any preference chosen before signing up onto the new profile.
      const preference = loadOnboardingPreference();
      const finalUser = preference
        ? await updateUserProfile(user.id, { onboarding_preference: preference }).catch(() => user)
        : user;

      setUser(finalUser);
      await initializeJourney(finalUser.id).catch(() => null);

      toast.success('Welcome to Night Shield.');
      navigate(preference ? '/discover' : '/onboarding', { replace: true });
    } catch (error) {
      setFormError(readableAuthError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Create your account</h1>
        <p className="muted small" style={{ marginBottom: '1.25rem' }}>
          You need one to RSVP, save routes and add what you know about the city.
        </p>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <Field label="Email" htmlFor="signup-email" error={errors.email}>
            <input
              id="signup-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="signup-password"
            hint="At least 8 characters."
            error={errors.password}
          >
            <input
              id="signup-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
          </Field>

          <Field label="Confirm password" htmlFor="signup-confirm" error={errors.confirm}>
            <input
              id="signup-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={Boolean(errors.confirm)}
            />
          </Field>

          <Button type="submit" variant="primary" block loading={saving}>
            Sign up
          </Button>
        </form>

        <p className="small muted center" style={{ marginTop: '1rem', marginBottom: 0 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

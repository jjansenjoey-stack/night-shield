import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { readableAuthError, requestPasswordReset } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabaseConfig';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Prompt 14 — request half of the reset flow. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setFormError(readableAuthError(err));
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="card auth-card center">
          <MailCheck size={34} color="var(--success)" aria-hidden="true" />
          <h1 style={{ fontSize: '1.4rem', marginTop: '0.5rem' }}>Check your email</h1>
          <p className="muted small">
            If <strong>{email.trim()}</strong> has an account, a reset link is on its way. The link
            expires in an hour.
          </p>
          {!isSupabaseConfigured ? (
            <p className="tiny muted">
              Local demo mode does not send email. Open{' '}
              <Link to="/reset-password">the reset page</Link> directly to try the second step.
            </p>
          ) : null}
          <Link to="/login" className="link-btn">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Reset your password</h1>
        <p className="muted small" style={{ marginBottom: '1.25rem' }}>
          We&rsquo;ll email you a link to set a new one.
        </p>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <Field label="Email" htmlFor="forgot-email" error={error ?? undefined}>
            <input
              id="forgot-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </Field>

          <Button type="submit" variant="primary" block loading={saving}>
            Send reset link
          </Button>
        </form>

        <p className="small muted center" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}

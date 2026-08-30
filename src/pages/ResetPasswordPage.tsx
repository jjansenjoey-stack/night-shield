import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { readableAuthError, updatePassword } from '@/services/authService';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Shared';
import { useToast } from '@/components/ui/Toast';

/**
 * Prompt 14 — the page the emailed link lands on. Supabase puts a recovery
 * session in the URL fragment and the client picks it up automatically
 * (detectSessionInUrl), so by the time this renders `updateUser` is authorised.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found: Record<string, string> = {};
    if (password.length < 8) found.password = 'Use at least 8 characters.';
    if (password !== confirm) found.confirm = 'The two passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await updatePassword(password);
      toast.success('Password updated — log in with your new one.');
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(readableAuthError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Set a new password</h1>
        <p className="muted small" style={{ marginBottom: '1.25rem' }}>
          Choose something you have not used elsewhere.
        </p>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <Field
            label="New password"
            htmlFor="reset-password"
            hint="At least 8 characters."
            error={errors.password}
          >
            <input
              id="reset-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="reset-confirm" error={errors.confirm}>
            <input
              id="reset-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={Boolean(errors.confirm)}
            />
          </Field>

          <Button type="submit" variant="primary" block loading={saving}>
            Update password
          </Button>
        </form>

        <p className="small muted center" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}

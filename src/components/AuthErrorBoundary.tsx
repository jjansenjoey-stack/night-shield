import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  isAuthError: boolean;
}

const AUTH_PATTERNS = [
  'jwt',
  'session',
  'not signed in',
  'unauthorized',
  'unauthenticated',
  '401',
  '403',
  'refresh_token',
];

function looksLikeAuthFailure(error: Error): boolean {
  const message = `${error.message}`.toLowerCase();
  return AUTH_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Prompt 19 — catches expired sessions and anything else that escapes a page,
 * and offers the one action that actually helps.
 */
export class AuthErrorBoundary extends Component<Props, State> {
  state: State = { error: null, isAuthError: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, isAuthError: looksLikeAuthFailure(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Replace with the municipality's error sink before launch.
    console.error('Night Shield crashed:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null, isAuthError: false });
  };

  private toLogin = () => {
    this.reset();
    window.location.assign('/login');
  };

  render() {
    const { error, isAuthError } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="auth-page">
        <div className="card auth-card">
          <div className="row" style={{ marginBottom: '0.5rem' }}>
            <AlertTriangle size={22} color="var(--warning)" aria-hidden="true" />
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>
              {isAuthError ? 'Your session has expired' : 'Something went wrong'}
            </h1>
          </div>

          <p className="muted small">
            {isAuthError
              ? 'For your safety we signed you out. Log in again to pick up where you left off.'
              : 'The page hit an error it could not recover from. Nothing you saved has been lost.'}
          </p>

          {!isAuthError ? (
            <pre
              className="tiny muted"
              style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', marginBottom: '1rem' }}
            >
              {error.message}
            </pre>
          ) : null}

          <div className="row">
            {isAuthError ? (
              <button className="btn btn--primary" onClick={this.toLogin}>
                Log in
              </button>
            ) : (
              <button className="btn btn--primary" onClick={this.reset}>
                Try again
              </button>
            )}
            <button className="btn btn--text" onClick={() => window.location.assign('/discover')}>
              Back to the map
            </button>
          </div>
        </div>
      </div>
    );
  }
}

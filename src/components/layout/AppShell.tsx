import { Link, Outlet, useLocation } from 'react-router-dom';
import { CloudOff, LogIn, ShieldHalf } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Avatar } from '@/components/ui/Shared';
import { LinkButton } from '@/components/ui/Button';
import { BottomNav } from './BottomNav';
import { WeatherStrip } from '@/components/map/WeatherStrip';

export function AppShell() {
  const user = useAppStore((s) => s.user);
  const data = useAppStore((s) => s.data);
  const isOnline = useOnlineStatus();
  const { pathname } = useLocation();

  const onMap = pathname.startsWith('/discover');

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="app-header">
        <Link to="/discover" className="app-header__brand">
          <ShieldHalf size={20} aria-hidden="true" />
          Night Shield
        </Link>

        <div className="app-header__right">
          {onMap ? <WeatherStrip /> : null}
          {user ? (
            <Link to="/profile" aria-label="Your profile">
              <Avatar user={user} small />
            </Link>
          ) : (
            <LinkButton to="/login" variant="text" size="sm" icon={<LogIn size={14} />}>
              Log in
            </LinkButton>
          )}
        </div>
      </header>

      {!isOnline ? (
        <div className="banner banner--warning" role="status">
          <CloudOff size={15} aria-hidden="true" />
          <span>
            You&rsquo;re offline — showing cached data
            {data?.cachedAt ? ` from ${new Date(data.cachedAt).toLocaleString()}` : ''}.
          </span>
        </div>
      ) : null}

      {!user ? (
        <div className="banner">
          <span>Sign in to RSVP to events and save routes.</span>
          <LinkButton to="/signup" variant="primary" size="sm" className="banner__cta">
            Sign up
          </LinkButton>
        </div>
      ) : null}

      <main className="app-main" id="main">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}

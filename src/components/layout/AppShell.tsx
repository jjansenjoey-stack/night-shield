import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, CloudOff, LogIn, ShieldHalf } from 'lucide-react';
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
        {/*
          Where "home" is depends on who you are. Someone browsing as a guest
          arrived from the front page and has no other way back to it — the
          bottom nav has no room for a tab that only matters once. Someone
          signed in wants the map.
        */}
        <Link
          to={user ? '/discover' : '/'}
          className="app-header__brand"
          aria-label={user ? 'Night Shield — go to the map' : 'Night Shield — back to the front page'}
        >
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
          {/*
            The only place a guest reliably looks. A link home on the logo is
            easy to miss, and the bottom nav has no room for a tab that matters
            once — but this banner is already here, and only for the people who
            need the way back.
          */}
          <Link to="/" className="banner__back">
            <ArrowLeft size={13} aria-hidden="true" />
            Front page
          </Link>
          {/* Short enough to stay on one line next to the two buttons. */}
          <span className="grow">Sign in to RSVP and save places.</span>
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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  Database,
  Footprints,
  GraduationCap,
  Home,
  Info,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { requestNotificationPermission } from '@/hooks/useReminders';
import { isSupabaseConfigured } from '@/services/supabaseConfig';
import { canUserPerformAction } from '@/lib/permissions';
import { Card, Section } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/** Prompt 18 plus the settings the other prompts kept needing somewhere to live. */
export function MenuPage() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const signOut = useAppStore((s) => s.signOut);
  const refreshData = useAppStore((s) => s.refreshData);
  const data = useAppStore((s) => s.data);
  const toast = useToast();

  const [confirmReset, setConfirmReset] = useState(false);
  const [notifyState, setNotifyState] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  );

  async function handleLogout() {
    await signOut();
    toast.success('Signed out.');
    navigate('/', { replace: true });
  }

  async function handleNotifications() {
    const result = await requestNotificationPermission();
    setNotifyState(result);
    toast.show(
      result === 'granted'
        ? 'Reminders on — we will nudge you a day and an hour before.'
        : 'Reminders stay in the app only.',
    );
  }

  async function handleReset() {
    const { resetLocalDatabase } = await import('@/services/localProvider');
    resetLocalDatabase();
    setConfirmReset(false);
    await refreshData();
    toast.success('Local demo data reset.');
    window.location.reload();
  }

  return (
    <div className="page">
      <h1 style={{ fontSize: '1.8rem' }}>Menu</h1>

      <Section title="Redeem your points">
        <LinkButton to="/workshops" variant="secondary" block icon={<GraduationCap size={15} />}>
          Workshops — art courses &amp; certificates
        </LinkButton>
        <p className="tiny muted" style={{ margin: '0.5rem 0 0' }}>
          Screenprinting, darkroom, sound design, ceramics. Paid for with points you earned by
          taking part in the city rather than with money.
        </p>
      </Section>

      <Section title="Put something in the city">
        <LinkButton to="/art-routes" variant="secondary" block icon={<Footprints size={15} />}>
          Two Weeks Only — the changing route
        </LinkButton>
        <p className="tiny muted" style={{ margin: '0.5rem 0 0' }}>
          Eight spots on a walking loop. Leave a small piece of your own work in a free one,
          earn points, and come back for it a fortnight later.
        </p>
      </Section>

      {user ? (
        <Section title="Contribute">
          <div className="stack stack--xs">
            {canUserPerformAction(user, 'submit_content') ? (
              <LinkButton to="/submit" variant="text" block icon={<Plus size={15} />}>
                Add art or a third space
              </LinkButton>
            ) : (
              <Card>
                <p className="small muted" style={{ margin: 0 }}>
                  Contributor accounts can add art and third spaces to the map. Ask the Inclusivity
                  Department to upgrade yours.
                </p>
              </Card>
            )}

            {canUserPerformAction(user, 'create_event') ? (
              <LinkButton to="/events/new" variant="text" block icon={<Plus size={15} />}>
                Create an event
              </LinkButton>
            ) : null}

            {canUserPerformAction(user, 'view_analytics') ? (
              <LinkButton to="/organizer" variant="text" block icon={<TrendingUp size={15} />}>
                Organizer dashboard
              </LinkButton>
            ) : null}

            {canUserPerformAction(user, 'moderate') ? (
              <LinkButton to="/moderation" variant="text" block icon={<ShieldCheck size={15} />}>
                Moderation queue
              </LinkButton>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section title="Notifications">
        <Card>
          <div className="row row--between">
            <span className="row" style={{ gap: '0.5rem' }}>
              {notifyState === 'granted' ? <BellRing size={17} /> : <Bell size={17} />}
              <span className="small">
                Event reminders
                <span className="tiny muted" style={{ display: 'block' }}>
                  A day before and an hour before anything you RSVP to.
                </span>
              </span>
            </span>
            {notifyState === 'granted' ? (
              <Badge tone="success">On</Badge>
            ) : notifyState === 'denied' ? (
              <Badge tone="neutral">Blocked in browser</Badge>
            ) : (
              <Button variant="text" size="sm" onClick={handleNotifications}>
                Turn on
              </Button>
            )}
          </div>
        </Card>
      </Section>

      <Section title="Data">
        <Card>
          <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
            <span className="row small" style={{ gap: '0.5rem' }}>
              <Database size={16} aria-hidden="true" />
              Backend
            </span>
            <Badge tone={isSupabaseConfigured ? 'success' : 'warning'}>
              {isSupabaseConfigured ? 'Supabase' : 'Local demo data'}
            </Badge>
          </div>

          <p className="tiny muted" style={{ margin: 0 }}>
            {isSupabaseConfigured
              ? 'Connected to a live Supabase project.'
              : 'Running on seeded data stored in this browser. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to switch to a real backend.'}
          </p>

          {data?.cachedAt ? (
            <p className="tiny muted" style={{ margin: '0.4rem 0 0' }}>
              Offline copy taken {new Date(data.cachedAt).toLocaleString()}.
            </p>
          ) : null}

          <div className="row" style={{ marginTop: '0.75rem' }}>
            <Button variant="text" size="sm" onClick={() => void refreshData()} icon={<RotateCcw size={13} />}>
              Refresh
            </Button>
            {!isSupabaseConfigured ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmReset(true)}
                icon={<Trash2 size={13} />}
              >
                Reset demo data
              </Button>
            ) : null}
          </div>
        </Card>
      </Section>

      <Section title="About">
        <LinkButton to="/" variant="text" block icon={<Home size={15} />}>
          Back to the front page
        </LinkButton>
        <div style={{ height: 'var(--xs)' }} />
        <Card>
          <p className="small" style={{ marginBottom: '0.4rem' }}>
            <Info size={14} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Night Shield is
            a concept built around three of the Municipality of Tilburg&rsquo;s themes:{' '}
            <strong>Inclusivity</strong>, <strong>Safety</strong> and <strong>Awareness</strong>.
          </p>
          <p className="tiny muted" style={{ marginBottom: '0.4rem' }}>
            Safety scores come from residents, are always anonymous, and are only shown once at
            least three people have reported on a place.
          </p>
          {/*
            The municipality's name is on this app but the municipality did not
            make it, commission it or approve it. Saying so plainly is the
            difference between a student concept and something that reads as an
            official council service.
          */}
          <p className="tiny muted" style={{ margin: 0 }}>
            A student project by Joey Jansen (Fontys). It is not an official product of the
            Municipality of Tilburg and is not endorsed by them.
          </p>
        </Card>
      </Section>

      {user ? (
        <Button variant="danger" block onClick={handleLogout} icon={<LogOut size={16} />}>
          Log out
        </Button>
      ) : (
        <div className="row">
          <LinkButton to="/login" variant="primary" block>
            Log in
          </LinkButton>
          <LinkButton to="/signup" variant="text" block>
            Sign up
          </LinkButton>
        </div>
      )}

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        footer={
          <>
            <Button variant="danger" onClick={handleReset}>
              Reset everything
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="small">
          This clears every account, RSVP, saved item and report stored in this browser and puts the
          original seed data back. It only touches local demo data — there is no server involved.
        </p>
      </Modal>
    </div>
  );
}

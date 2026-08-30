import { Link } from 'react-router-dom';
import { Brush, CalendarDays, Route, ShieldHalf, Users } from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';

const BENEFITS = [
  {
    Icon: Route,
    title: 'Find safe routes',
    body: 'Walks put together from what residents actually report — lighting, people around, places that stay open.',
  },
  {
    Icon: Brush,
    title: 'Explore local art',
    body: 'Murals, light works and sound pieces across Tilburg, with the story behind each one.',
  },
  {
    Icon: CalendarDays,
    title: 'Join events',
    body: 'Workshops, artist talks and late openings. Free more often than not.',
  },
  {
    Icon: Users,
    title: 'Belong together',
    body: 'Third spaces where you can sit for an hour without buying anything, and nobody minds.',
  },
];

/** Prompt 3 — the front door. */
export function LandingPage() {
  const user = useAppStore((s) => s.user);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      <section className="hero">
        <span className="hero__kicker">
          <ShieldHalf size={14} aria-hidden="true" />
          Municipality of Tilburg · Inclusivity Department
        </span>

        <h1>
          Night Shield
          <span style={{ display: 'block', fontSize: '0.42em', marginTop: '0.5rem' }}>
            Discover your city with confidence
          </span>
        </h1>

        <p className="hero__sub">
          For everyone between 18 and 30 who wants to move through Tilburg on their own terms — with
          the map, the art, the events and the people already here.
        </p>

        <div className="hero__cta">
          {user ? (
            <LinkButton to="/discover" variant="primary" size="lg">
              Open the map
            </LinkButton>
          ) : (
            <>
              <LinkButton to="/signup" variant="primary" size="lg">
                Sign up
              </LinkButton>
              <LinkButton to="/discover" variant="text" size="lg">
                Browse as guest
              </LinkButton>
            </>
          )}
        </div>
      </section>

      <div className="page">
        <div className="benefit-grid">
          {BENEFITS.map(({ Icon, title, body }) => (
            <article key={title} className="benefit">
              <div className="benefit__icon" aria-hidden="true">
                <Icon size={20} />
              </div>
              <h3 style={{ fontSize: '1.05rem' }}>{title}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {body}
              </p>
            </article>
          ))}
        </div>

        <div className="card" style={{ marginTop: '2rem' }}>
          <h3>Two minutes to set up</h3>
          <p className="small muted">
            Tell us how you like to move through the city and Night Shield puts the right routes
            first. You can change it any time, or skip it entirely.
          </p>
          <div className="row">
            <LinkButton to="/onboarding" variant="secondary">
              Set your preference
            </LinkButton>
            <Link to="/discover" className="link-btn">
              Skip for now
            </Link>
          </div>
        </div>

        <p className="tiny muted center" style={{ marginTop: '2rem' }}>
          Built for the Municipality of Tilburg, Inclusivity Department · designed by Joey Jansen
          (Fontys)
        </p>
      </div>
    </div>
  );
}

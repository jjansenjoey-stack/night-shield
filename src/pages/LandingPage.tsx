import { Link } from 'react-router-dom';
import {
  Brush,
  CalendarDays,
  Footprints,
  GraduationCap,
  Route,
  Search,
  ShieldHalf,
  Users,
} from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';
import { LinkCard } from '@/components/ui/Card';
import { ShaderBackground } from '@/components/ui/ShaderBackground';
import { useAppStore } from '@/store/appStore';

const BENEFITS = [
  {
    Icon: Route,
    // Explore is where routes carry their safety score. Art routes is the
    // art programme and has no safety ranking on it at all.
    to: '/explore',
    title: 'Find safe routes',
    body: 'Walks put together from what residents actually report — lighting, people around, places that stay open.',
  },
  {
    Icon: Brush,
    // Murals, light works and sound pieces are pins on the map, not routes.
    to: '/discover',
    title: 'Explore local art',
    body: 'Murals, light works and sound pieces across Tilburg, with the story behind each one.',
  },
  {
    Icon: CalendarDays,
    to: '/events',
    title: 'Join events',
    body: 'Workshops, artist talks and late openings. Free more often than not.',
  },
  {
    Icon: Users,
    // Third spaces are pins on the map too.
    to: '/discover',
    title: 'Belong together',
    body: 'Third spaces where you can sit for an hour without buying anything, and nobody minds.',
  },
];

/*
 * The things you *do*, with what they pay.
 *
 * Worth is written as the range the app actually awards, so the promise on the
 * front page and the price list inside it are the same numbers.
 */
const DOING = [
  {
    Icon: Search,
    to: '/discover',
    title: 'Night Caches',
    worth: '6–16 pts',
    body: 'Eight hidden things with a story behind each. Stand next to one to log it, or answer the question from home if getting there is not on. There is a trail that strings all eight into one walk.',
  },
  {
    Icon: Footprints,
    to: '/art-routes',
    title: 'Two Weeks Only',
    worth: '14 pts',
    body: 'A loop with eight spots on it. Put something you have made in a free one and it stays for a fortnight, then you come back for it. Walk it every couple of weeks and it is never the same twice.',
  },
  {
    Icon: CalendarDays,
    to: '/events',
    title: 'Turn up to things',
    worth: '4–14 pts',
    body: 'Almost everything is free. Longer and harder sessions pay more, and you claim it with a code given out on the night.',
  },
  {
    Icon: GraduationCap,
    to: '/workshops',
    title: 'Spend it on a workshop',
    worth: '20–200 pts',
    body: 'Screenprinting, darkroom, sound design, ceramics. Bought with points you earned by taking part, not with money.',
  },
] as const;

/** Prompt 3 — the front door. */
export function LandingPage() {
  const user = useAppStore((s) => s.user);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      <section className="hero hero--shader">
        {/*
          The animated gradient sits behind everything and is aria-hidden. The
          scrim over it is not decoration: the shader swings from near-black to
          hot pink, and white body copy has to stay readable across all of it.
        */}
        <ShaderBackground className="hero__shader" />
        <div className="hero__scrim" aria-hidden="true" />

        <span className="hero__kicker">
          <ShieldHalf size={14} aria-hidden="true" />
          A concept for Tilburg · Inclusivity · Safety · Awareness
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
          {BENEFITS.map(({ Icon, title, body, to }) => (
            <LinkCard key={title} to={to} label={title} className="benefit">
              <div className="benefit__icon" aria-hidden="true">
                <Icon size={20} />
              </div>
              <h3 style={{ fontSize: '1.05rem' }}>{title}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {body}
              </p>
            </LinkCard>
          ))}
        </div>

        {/*
          The second half of the pitch. The four cards above say what you can
          look at; these say what you can do, and what doing it is worth — which
          is the part that makes this different from a listings site.
        */}
        <section style={{ marginTop: '2.5rem' }}>
          <h2 style={{ marginBottom: '0.3rem' }}>Earn your way in</h2>
          <p className="small muted" style={{ maxWidth: 620, margin: '0 0 var(--md)' }}>
            Taking part earns points, and points buy places on real art courses — the kind that
            normally cost a few hundred euro. Nothing here is bought with money. Every price is
            listed in the app, so you always know what something is worth before you do it.
          </p>

          <div className="benefit-grid">
            {DOING.map(({ Icon, title, body, worth, to }) => (
              <LinkCard key={title} to={to} label={`${title} — worth ${worth}`}>
                <span className="benefit__icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div className="row row--between" style={{ gap: 'var(--xs)' }}>
                  <h3 style={{ marginBottom: '0.3rem' }}>{title}</h3>
                  <span className="landing-worth">{worth}</span>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  {body}
                </p>
              </LinkCard>
            ))}
          </div>
        </section>

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
          Designed by Joey Jansen (Fontys) around the Municipality of Tilburg&rsquo;s Inclusivity,
          Safety and Awareness themes. A student concept — not an official municipal product.
        </p>
      </div>
    </div>
  );
}

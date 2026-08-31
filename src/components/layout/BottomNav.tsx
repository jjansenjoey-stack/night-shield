import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  Compass,
  Footprints,
  GraduationCap,
  Map,
  Menu,
  User,
} from 'lucide-react';

const TABS = [
  { to: '/discover', label: 'Discover', Icon: Map },
  { to: '/explore', label: 'Explore', Icon: Compass },
  { to: '/events', label: 'Events', Icon: CalendarDays },
  // The changing route and the city's other art walks. It sits next to Events
  // because both answer "what is on right now".
  { to: '/art-routes', label: 'Art routes', Icon: Footprints },
  // Redeeming points is the payoff for everything else in the app, so it gets
  // a tab of its own rather than a link buried in the menu.
  { to: '/workshops', label: 'Workshops', Icon: GraduationCap },
  { to: '/profile', label: 'Profile', Icon: User },
  { to: '/menu', label: 'Menu', Icon: Menu },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`}
        >
          {({ isActive }) => (
            <>
              {isActive ? <span className="bottom-nav__marker" aria-hidden="true" /> : null}
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

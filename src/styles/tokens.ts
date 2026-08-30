/**
 * Night Shield design tokens (prompt 1).
 * Mirrored into CSS custom properties in global.css — keep the two in sync.
 */

export const colors = {
  primary: '#1a1a2e',
  accent1: '#ff006e',
  accent2: '#00d9ff',
  neutral: '#e0e0e0',
  success: '#06d6a0',
  warning: '#ffd166',
  error: '#ef476f',

  // Derived surfaces used across the app
  surface: '#22223f',
  surfaceRaised: '#2b2b50',
  border: 'rgba(224, 224, 224, 0.14)',
  textMuted: 'rgba(224, 224, 224, 0.62)',
} as const;

export const typography = {
  displayLarge: {
    fontSize: '2.5rem',
    fontWeight: 700,
    fontFamily: "'Courier New', Courier, monospace",
    lineHeight: 1.1,
  },
  displaySmall: {
    fontSize: '1.5rem',
    fontWeight: 700,
    fontFamily: "'Courier New', Courier, monospace",
    lineHeight: 1.2,
  },
  body: {
    fontSize: '1rem',
    fontWeight: 400,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    lineHeight: 1.6,
  },
} as const;

export const spacing = {
  xs: '0.5rem',
  sm: '1rem',
  md: '1.5rem',
  lg: '2rem',
  xl: '3rem',
} as const;

export const radius = {
  sm: '8px',
  md: '14px',
  lg: '22px',
  pill: '999px',
} as const;

/** Tilburg, Netherlands — the city Night Shield ships for. */
// NOTE: the brief listed lng 5.1857, which sits ~9 km east of the city in open
// farmland. Corrected to the actual Tilburg centre so the map opens on the city.
export const TILBURG = { latitude: 51.5581, longitude: 5.0913, zoom: 13 } as const;

export type ColorToken = keyof typeof colors;

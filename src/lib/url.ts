/**
 * Build an in-app URL that survives being deployed under a subpath.
 *
 * The router is mounted with `basename={import.meta.env.BASE_URL}`, so every
 * <Link> already resolves correctly. A hard navigation does not go through the
 * router: `window.location.assign('/login')` is a path from the domain root, so
 * on GitHub Pages — where the app lives at /night-shield/ — it lands on
 * github.io/login, which is a 404 page belonging to nobody. It worked in
 * development only because the base is "/" there, which is exactly the kind of
 * bug that never shows up until the thing is deployed.
 *
 * BASE_URL is "/" in development and "/night-shield/" (or whatever the deploy
 * was built with) in production, so this is correct in both.
 */
export function appUrl(path: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

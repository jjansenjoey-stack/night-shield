/*
 * Build for GitHub Pages.
 *
 * A project site is served from https://<user>.github.io/<repo>/, so the bundle
 * has to be built with that subpath as its base. Pages also has no rewrite
 * rules, so a deep link like /workshops would 404 on a hard refresh — copying
 * index.html to 404.html makes Pages hand the SPA back instead, and the router
 * takes it from there.
 *
 *   npm run build:pages -- night-shield
 *
 * Pass the repository name, or set VITE_BASE yourself.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.argv[2];
const base = process.env.VITE_BASE ?? (repo ? `/${repo.replace(/^\/|\/$/g, '')}/` : '/');

console.log(`Building with base "${base}"`);

execFileSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: base },
  shell: process.platform === 'win32',
});

const dist = join(process.cwd(), 'dist');
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
// Without this, Pages runs the output through Jekyll and drops _-prefixed files.
writeFileSync(join(dist, '.nojekyll'), '');

console.log('dist/ is ready to publish.');

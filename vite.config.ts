import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/*
 * `base` is read from the environment so the same source can be served from a
 * domain root (Netlify, Vercel, Cloudflare Pages) or from a subpath
 * (GitHub Pages project sites live at /<repo>/). Everything that resolves a
 * URL at runtime goes through import.meta.env.BASE_URL, including the router.
 */
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173, open: false },
  preview: { port: 4173 },
});

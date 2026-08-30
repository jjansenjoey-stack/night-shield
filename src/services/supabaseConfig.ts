/**
 * Whether a Supabase project is configured — and nothing else.
 *
 * Kept apart from `supabase.ts` on purpose. Several pages need to know which
 * backend is live, and importing that flag from the module that constructs the
 * client would pull @supabase/supabase-js into the main bundle for every
 * visitor, including the ones running entirely on the local provider. This
 * module imports nothing, so the flag is free.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

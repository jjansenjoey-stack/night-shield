import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './supabaseConfig';

/**
 * The Supabase client, created only when credentials are present.
 *
 * Import this module only from code that actually talks to Supabase — it pulls
 * in the SDK. If you just need to know *whether* Supabase is configured, import
 * `isSupabaseConfigured` from ./supabaseConfig instead, which costs nothing.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Narrowing helper so services can assume a client once they've checked. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
    );
  }
  return supabase;
}

export { isSupabaseConfigured };

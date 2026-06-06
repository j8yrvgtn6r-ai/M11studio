import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let initAttempted = false;

function readEnv(name: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const value = import.meta.env[name];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/** True when both Supabase env vars are present. Safe to call anywhere. */
export function isSupabaseConfigured(): boolean {
  return Boolean(readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY'));
}

/**
 * Lazily returns a Supabase client, or null when not configured.
 * Never throws — callers must handle null.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (initAttempted) {
    return client;
  }
  initAttempted = true;

  const url = readEnv('VITE_SUPABASE_URL');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    return null;
  }

  try {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    client = null;
  }

  return client;
}

/** Resets the lazy client (for tests). */
export function resetSupabaseClientForTests(): void {
  client = null;
  initAttempted = false;
}

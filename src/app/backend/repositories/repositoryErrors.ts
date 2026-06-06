import { getSupabaseClient } from '../supabaseClient';

export class RepositoryUnavailableError extends Error {
  constructor(message = 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.') {
    super(message);
    this.name = 'RepositoryUnavailableError';
  }
}

export class RepositoryPersistenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RepositoryPersistenceError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export function requireSupabaseClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new RepositoryUnavailableError();
  }
  return client;
}

export function mapSupabaseError(context: string, error: { message: string } | null): never {
  throw new RepositoryPersistenceError(`${context}: ${error?.message ?? 'Unknown error'}`, error);
}

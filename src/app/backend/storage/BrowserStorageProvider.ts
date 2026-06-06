import type { StorageProvider } from './StorageProvider';

/**
 * Default storage provider. Existing workflows remain on localStorage / IndexedDB.
 * Does not expose Supabase repositories — migration will swap the active provider later.
 */
export class BrowserStorageProvider implements StorageProvider {
  readonly kind = 'browser' as const;

  isAvailable(): boolean {
    // Default strategy — always selectable; localStorage/IndexedDB used when `window` exists.
    return true;
  }

  getSupabaseBackend() {
    return null;
  }
}

export const browserStorageProvider = new BrowserStorageProvider();

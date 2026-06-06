export type { StorageProvider, StorageProviderKind, SupabaseBackend } from './StorageProvider';
export { BrowserStorageProvider, browserStorageProvider } from './BrowserStorageProvider';
export { SupabaseStorageProvider, supabaseStorageProvider } from './SupabaseStorageProvider';
export {
  getStorageProvider,
  resetStorageProviderForTests,
  setStorageProvider,
} from './storageProviderRegistry';

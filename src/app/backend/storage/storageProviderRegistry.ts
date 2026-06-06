import { browserStorageProvider } from './BrowserStorageProvider';
import type { StorageProvider } from './StorageProvider';

/** Active provider — browser by default; no workflow migration in this PR. */
let activeStorageProvider: StorageProvider = browserStorageProvider;

export function getStorageProvider(): StorageProvider {
  return activeStorageProvider;
}

/** For future migration tooling and tests only — not used by UI yet. */
export function setStorageProvider(provider: StorageProvider): void {
  activeStorageProvider = provider;
}

export function resetStorageProviderForTests(): void {
  activeStorageProvider = browserStorageProvider;
}

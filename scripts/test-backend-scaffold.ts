/**
 * Smoke test for backend scaffold — no Supabase connection required.
 */
import {
  browserStorageProvider,
  getStorageProvider,
  isSupabaseConfigured,
  knowledgeEntityRepository,
  RepositoryUnavailableError,
  protocolRepository,
  resetStorageProviderForTests,
  resetSupabaseClientForTests,
  supabaseStorageProvider,
} from '../src/app/backend';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  resetSupabaseClientForTests();
  resetStorageProviderForTests();

  assert(getStorageProvider().kind === 'browser', 'default provider should be browser');
  assert(browserStorageProvider.isAvailable(), 'browser provider should be available');
  assert(browserStorageProvider.getSupabaseBackend() === null, 'browser provider has no supabase backend');

  assert(!isSupabaseConfigured(), 'supabase should be unconfigured in CI/local without env');
  assert(supabaseStorageProvider.getSupabaseBackend() === null, 'supabase backend null when unconfigured');

  let threw = false;
  try {
    await protocolRepository.list();
  } catch (error) {
    threw = error instanceof RepositoryUnavailableError;
  }
  assert(threw, 'repository should throw RepositoryUnavailableError when unconfigured');

  let entityThrew = false;
  try {
    await knowledgeEntityRepository.listByProtocol('00000000-0000-0000-0000-000000000001');
  } catch (error) {
    entityThrew = error instanceof RepositoryUnavailableError;
  }
  assert(entityThrew, 'knowledge entity repository should throw when unconfigured');

  console.log('test:backend — all scaffold checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

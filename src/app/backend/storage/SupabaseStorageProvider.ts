import { isSupabaseConfigured } from '../supabaseClient';
import {
  agentEventRepository,
  coreStudyModelRepository,
  knowledgeLayerRepository,
  protocolRepository,
  protocolSectionRepository,
  protocolVersionRepository,
  sourceDocumentRepository,
  validationRepository,
} from '../repositories';
import type { StorageProvider, SupabaseBackend } from './StorageProvider';

/**
 * Supabase-backed storage. Available only when env vars are set and client initializes.
 * Not wired as default — opt in during migration phases.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly kind = 'supabase' as const;

  private backend: SupabaseBackend = {
    protocols: protocolRepository,
    protocolSections: protocolSectionRepository,
    coreStudyModels: coreStudyModelRepository,
    knowledgeLayers: knowledgeLayerRepository,
    protocolVersions: protocolVersionRepository,
    agentEvents: agentEventRepository,
    validationRuns: validationRepository,
    sourceDocuments: sourceDocumentRepository,
  };

  isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  getSupabaseBackend(): SupabaseBackend | null {
    return this.isAvailable() ? this.backend : null;
  }
}

export const supabaseStorageProvider = new SupabaseStorageProvider();

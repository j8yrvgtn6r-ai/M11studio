import type {
  AgentEventRepository,
  CoreStudyModelRepository,
  KnowledgeLayerRepository,
  ProtocolRepository,
  ProtocolSectionRepository,
  ProtocolVersionRepository,
  SourceDocumentRepository,
  ValidationRepository,
} from '../repositories';

export type StorageProviderKind = 'browser' | 'supabase';

/** Repository bundle exposed when Supabase is the active backend. */
export interface SupabaseBackend {
  protocols: ProtocolRepository;
  protocolSections: ProtocolSectionRepository;
  coreStudyModels: CoreStudyModelRepository;
  knowledgeLayers: KnowledgeLayerRepository;
  protocolVersions: ProtocolVersionRepository;
  agentEvents: AgentEventRepository;
  validationRuns: ValidationRepository;
  sourceDocuments: SourceDocumentRepository;
}

/**
 * Selects where durable protocol data is persisted.
 * Browser provider keeps existing localStorage / IndexedDB workflows.
 * Supabase provider routes through repository CRUD when configured.
 */
export interface StorageProvider {
  readonly kind: StorageProviderKind;
  isAvailable(): boolean;
  /** Null for browser — callers continue using existing in-app stores. */
  getSupabaseBackend(): SupabaseBackend | null;
}

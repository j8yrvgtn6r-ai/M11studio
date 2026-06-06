/**
 * M11 Studio backend scaffold — Supabase persistence layer.
 * Not imported by existing UI/workflows in this PR.
 */

export { getSupabaseClient, isSupabaseConfigured, resetSupabaseClientForTests } from './supabaseClient';

export type * from './types';

export {
  AgentEventRepository,
  agentEventRepository,
  CoreStudyModelRepository,
  coreStudyModelRepository,
  KnowledgeEntityRepository,
  knowledgeEntityRepository,
  KnowledgeGraphRepository,
  knowledgeGraphRepository,
  KnowledgeLayerRepository,
  knowledgeLayerRepository,
  KnowledgeRelationshipRepository,
  knowledgeRelationshipRepository,
  ProtocolRepository,
  protocolRepository,
  ProtocolSectionRepository,
  protocolSectionRepository,
  ProtocolVersionRepository,
  protocolVersionRepository,
  RepositoryPersistenceError,
  RepositoryUnavailableError,
  SourceDocumentRepository,
  sourceDocumentRepository,
  ValidationRepository,
  validationRepository,
} from './repositories';

export type {
  StorageProvider,
  StorageProviderKind,
  SupabaseBackend,
} from './storage';
export {
  BrowserStorageProvider,
  browserStorageProvider,
  getStorageProvider,
  resetStorageProviderForTests,
  setStorageProvider,
  SupabaseStorageProvider,
  supabaseStorageProvider,
} from './storage';

export type {
  AgentPersistenceContext,
  AgentPersistencePort,
  AnyAgentPersistencePort,
  ConsistencyAgentPersistence,
  GenerationAgentPersistence,
  KnowledgeAgentPersistence,
  PersistableAgentEvent,
  PersistableAgentResult,
  StructuralMappingAgentPersistence,
  ValidationAgentPersistence,
} from './agents';

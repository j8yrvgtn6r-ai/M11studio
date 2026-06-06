import type { AgentPersistencePort } from './agentPersistenceTypes';

/**
 * Future persistence contracts per agent type.
 * Implementations will delegate to AgentEventRepository, KnowledgeLayerRepository, etc.
 * Not wired in this PR.
 */

export interface KnowledgeAgentPersistence extends AgentPersistencePort {
  /** Knowledge Agent: study-model patches + knowledge layer JSON + build-console events. */
  readonly agentKind: 'knowledge';
}

export interface ConsistencyAgentPersistence extends AgentPersistencePort {
  /** Consistency Agent: cross-section validation findings + version snapshots. */
  readonly agentKind: 'consistency';
}

export interface ValidationAgentPersistence extends AgentPersistencePort {
  /** Validation Agent: validation_runs rows + section workflow_state updates. */
  readonly agentKind: 'validation';
}

export interface GenerationAgentPersistence extends AgentPersistencePort {
  /** Generation Agent: generated section content + protocol_versions on batch complete. */
  readonly agentKind: 'generation';
}

export interface StructuralMappingAgentPersistence extends AgentPersistencePort {
  /** Structural Mapping Agent: imported section drafts + mapping metadata on sections. */
  readonly agentKind: 'structural-mapping';
}

export type AnyAgentPersistencePort =
  | KnowledgeAgentPersistence
  | ConsistencyAgentPersistence
  | ValidationAgentPersistence
  | GenerationAgentPersistence
  | StructuralMappingAgentPersistence;

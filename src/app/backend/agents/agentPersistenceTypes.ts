import type {
  AgentEventInsert,
  KnowledgeLayerRow,
  ProtocolVersionInsert,
  ProtocolVersionRow,
} from '../types';

/** Minimal agent result shape for future Supabase persistence (no runtime coupling to src/app/agents). */
export interface PersistableAgentResult {
  protocolId: string;
  agentId: string;
  status: 'success' | 'partial' | 'skipped' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  warnings: string[];
  errors: string[];
  affectedSectionIds: string[];
  output?: unknown;
  studyModelUpdates?: Record<string, unknown>;
  knowledgeUpdates?: Record<string, unknown>;
}

export interface PersistableAgentEvent {
  agentId: string;
  eventType: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface AgentVersionCommit {
  commitMessage: string;
  commitSource: string;
  metadata?: Record<string, unknown>;
}

export interface AgentPersistenceContext {
  protocolId: string;
}

/** Shared persistence port for all agents — interfaces only, not wired. */
export interface AgentPersistencePort {
  persistResult(context: AgentPersistenceContext, result: PersistableAgentResult): Promise<void>;
  persistEvents(context: AgentPersistenceContext, events: PersistableAgentEvent[]): Promise<void>;
  persistKnowledgeLayerUpdate(
    context: AgentPersistenceContext,
    knowledge: Record<string, unknown>,
    version?: number,
  ): Promise<KnowledgeLayerRow>;
  persistProtocolVersion(
    context: AgentPersistenceContext,
    commit: AgentVersionCommit,
  ): Promise<ProtocolVersionRow>;
}

/** Maps in-memory agent events to repository inserts (future adapter implementation). */
export type AgentEventInsertMapper = (protocolId: string, event: PersistableAgentEvent) => AgentEventInsert;

/** Maps version commits to repository inserts (future adapter implementation). */
export type ProtocolVersionInsertMapper = (
  protocolId: string,
  commit: AgentVersionCommit,
) => ProtocolVersionInsert;

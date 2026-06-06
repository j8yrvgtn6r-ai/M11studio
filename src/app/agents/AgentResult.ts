import type { StudyModelPatch } from '../domain/study-model/studyModelPatch';
import type { AgentEvent } from './agentEvents';

export type AgentResultStatus = 'success' | 'partial' | 'skipped' | 'failed';

export interface AgentResult<TOutput = unknown> {
  agentId: string;
  status: AgentResultStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output?: TOutput;
  warnings: string[];
  errors: string[];
  affectedSectionIds: string[];
  studyModelUpdates?: StudyModelPatch;
  knowledgeUpdates?: Record<string, unknown>;
  events: AgentEvent[];
}

export function createAgentResult<TOutput>(
  agentId: string,
  startedAt: string,
  partial: Partial<AgentResult<TOutput>> & Pick<AgentResult<TOutput>, 'status'>,
): AgentResult<TOutput> {
  const completedAt = partial.completedAt ?? new Date().toISOString();
  return {
    agentId,
    startedAt,
    completedAt,
    durationMs: partial.durationMs ?? Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
    output: partial.output,
    warnings: partial.warnings ?? [],
    errors: partial.errors ?? [],
    affectedSectionIds: partial.affectedSectionIds ?? [],
    studyModelUpdates: partial.studyModelUpdates,
    knowledgeUpdates: partial.knowledgeUpdates,
    events: partial.events ?? [],
    status: partial.status,
  };
}

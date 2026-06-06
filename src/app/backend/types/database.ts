/** Supabase row types for M11 Studio persistence (architecture scaffold). */

export type ProtocolStatus = 'draft' | 'active' | 'archived';

export interface ProtocolRow {
  id: string;
  name: string;
  description: string | null;
  status: ProtocolStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  current_version_id: string | null;
  metadata: Record<string, unknown>;
}

export type ProtocolInsert = Pick<ProtocolRow, 'name'> &
  Partial<Omit<ProtocolRow, 'id' | 'created_at' | 'updated_at' | 'name'>>;

export type ProtocolUpdate = Partial<Omit<ProtocolRow, 'id' | 'created_at'>>;

export type SectionWorkflowState =
  | 'importedUnvalidated'
  | 'imported'
  | 'unvalidated'
  | 'validated'
  | 'generated'
  | 'reviewed'
  | 'outOfSync'
  | 'needsGeneration';

export type SectionSourceType = 'imported' | 'generated' | 'edited' | 'validated' | 'reviewed';

export interface ProtocolSectionRow {
  id: string;
  protocol_id: string;
  section_id: string;
  section_title: string;
  content: string;
  workflow_state: SectionWorkflowState | string;
  source_type: SectionSourceType | string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export type ProtocolSectionInsert = Pick<
  ProtocolSectionRow,
  'protocol_id' | 'section_id' | 'section_title' | 'content'
> &
  Partial<Omit<ProtocolSectionRow, 'id' | 'created_at' | 'updated_at'>>;

export type ProtocolSectionUpdate = Partial<Omit<ProtocolSectionRow, 'id' | 'protocol_id' | 'created_at'>>;

export interface CoreStudyModelRow {
  id: string;
  protocol_id: string;
  version: number;
  model: Record<string, unknown>;
  created_at: string;
}

export type CoreStudyModelInsert = Pick<CoreStudyModelRow, 'protocol_id' | 'model'> &
  Partial<Pick<CoreStudyModelRow, 'version'>>;

export type CoreStudyModelUpdate = Partial<Pick<CoreStudyModelRow, 'version' | 'model'>>;

export interface KnowledgeLayerRow {
  id: string;
  protocol_id: string;
  version: number;
  knowledge: Record<string, unknown>;
  created_at: string;
}

export type KnowledgeLayerInsert = Pick<KnowledgeLayerRow, 'protocol_id' | 'knowledge'> &
  Partial<Pick<KnowledgeLayerRow, 'version'>>;

export type KnowledgeLayerUpdate = Partial<Pick<KnowledgeLayerRow, 'version' | 'knowledge'>>;

export interface ProtocolVersionRow {
  id: string;
  protocol_id: string;
  commit_message: string;
  commit_source: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export type ProtocolVersionInsert = Pick<
  ProtocolVersionRow,
  'protocol_id' | 'commit_message' | 'commit_source'
> &
  Partial<Pick<ProtocolVersionRow, 'metadata'>>;

export type ProtocolVersionUpdate = Partial<Omit<ProtocolVersionRow, 'id' | 'protocol_id' | 'created_at'>>;

export type AgentEventType = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface AgentEventRow {
  id: string;
  protocol_id: string;
  agent_id: string;
  event_type: AgentEventType | string;
  message: string;
  created_at: string;
  payload: Record<string, unknown>;
}

export type AgentEventInsert = Pick<
  AgentEventRow,
  'protocol_id' | 'agent_id' | 'event_type' | 'message'
> &
  Partial<Pick<AgentEventRow, 'payload'>>;

export type AgentEventUpdate = Partial<Omit<AgentEventRow, 'id' | 'protocol_id' | 'created_at'>>;

export type ValidationRunStatus = 'passed' | 'warnings' | 'failed' | 'skipped';

export interface ValidationRunRow {
  id: string;
  protocol_id: string;
  section_id: string | null;
  status: ValidationRunStatus | string;
  results: Record<string, unknown>;
  created_at: string;
}

export type ValidationRunInsert = Pick<ValidationRunRow, 'protocol_id' | 'status' | 'results'> &
  Partial<Pick<ValidationRunRow, 'section_id'>>;

export type ValidationRunUpdate = Partial<Omit<ValidationRunRow, 'id' | 'protocol_id' | 'created_at'>>;

export interface SourceDocumentRow {
  id: string;
  protocol_id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export type SourceDocumentInsert = Pick<
  SourceDocumentRow,
  'protocol_id' | 'file_name' | 'file_type' | 'storage_path'
> &
  Partial<Pick<SourceDocumentRow, 'metadata'>>;

export type SourceDocumentUpdate = Partial<Omit<SourceDocumentRow, 'id' | 'protocol_id' | 'created_at'>>;

export interface ListByProtocolFilter {
  protocolId?: string;
}

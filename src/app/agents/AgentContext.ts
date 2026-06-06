import type { CoreStudyModel } from '../domain/protocol/import/coreStudyModel';
import type { ImportedProtocolSource } from '../domain/protocol/import/types';
import type { ProtocolKnowledgeModel } from '../domain/protocol/import/protocolKnowledgeTypes';
import type { ProtocolDocument } from '../domain/protocol/types';
import type { StudyModel } from '../domain/study-model/studyModelTypes';

export type AgentTrigger =
  | 'import'
  | 'sectionEdit'
  | 'sectionValidation'
  | 'sectionReviewed'
  | 'sectionApproval'
  | 'regeneration'
  | 'manual'
  | 'background';

export interface AgentContext<TInput = unknown> {
  protocolDocument: ProtocolDocument;
  selectedSectionId?: string;
  sourceExtraction?: ImportedProtocolSource | null;
  protocolKnowledgeModel?: ProtocolKnowledgeModel | null;
  coreStudyModel?: CoreStudyModel | null;
  studyModel?: StudyModel | null;
  currentSectionText?: string;
  previousSectionText?: string;
  trigger: AgentTrigger;
  input: TInput;
  metadata?: Record<string, string | number | boolean>;
}

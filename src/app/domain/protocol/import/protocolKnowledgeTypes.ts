import type { LlmProviderId } from './llm/types';

export type ProtocolKnowledgeProviderId = LlmProviderId;

export interface KnowledgeSourceReference {
  sourceSectionId?: string;
  label: string;
  excerpt: string;
}

export interface ProtocolKnowledgeModel {
  id: string;
  sourceUploadId: string;
  extractedAt: string;
  knowledgeProvider: ProtocolKnowledgeProviderId;
  understandingModel: string;
  understandingPromptVersion: string;
  confidence: number;
  extractionNotes: string[];
  sourceReferences: KnowledgeSourceReference[];
  studyTitle?: string;
  shortTitle?: string;
  sponsor?: string;
  protocolIdentifier?: string;
  version?: string;
  phase?: string;
  indication?: string;
  targetPopulation?: string;
  inclusionCriteriaSummary?: string;
  exclusionCriteriaSummary?: string;
  primaryObjectives: string[];
  secondaryObjectives: string[];
  exploratoryObjectives: string[];
  estimands: string[];
  arms: string[];
  armDefinitions: string[];
  interventionModel?: string;
  controlType?: string;
  interventions: string[];
  visits: string[];
  assessments: string[];
  safetyMonitoring: string[];
  safetyAssessments: string[];
  efficacyAssessments: string[];
  statisticalSummary?: string;
  riskBenefitSummary?: string;
  /** @deprecated use targetPopulation */
  population?: string;
  /** @deprecated use primaryObjectives */
  objectives?: string[];
  endpoints?: string[];
  eligibilitySummary?: string;
}

export interface ProtocolKnowledgeProvider {
  readonly id: ProtocolKnowledgeProviderId;
  understand(
    input: import('./llm/types').ProtocolUnderstandingInput,
  ): Promise<ProtocolKnowledgeModel>;
}

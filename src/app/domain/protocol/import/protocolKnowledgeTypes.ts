import type { ImportedProtocolSource } from './types';

export type ProtocolKnowledgeProviderId = 'local-deterministic' | 'llm';

export interface ProtocolKnowledgeModel {
  id: string;
  sourceUploadId: string;
  extractedAt: string;
  knowledgeProvider: ProtocolKnowledgeProviderId;
  confidence: number;
  extractionNotes: string[];
  studyTitle?: string;
  shortTitle?: string;
  sponsor?: string;
  protocolIdentifier?: string;
  version?: string;
  phase?: string;
  indication?: string;
  population?: string;
  objectives: string[];
  endpoints: string[];
  estimands: string[];
  arms: string[];
  interventions: string[];
  eligibilitySummary?: string;
  safetyAssessments: string[];
  efficacyAssessments: string[];
  statisticalSummary?: string;
}

export interface ProtocolKnowledgeProvider {
  readonly id: ProtocolKnowledgeProviderId;
  build(sourceExtraction: ImportedProtocolSource): Promise<ProtocolKnowledgeModel>;
}

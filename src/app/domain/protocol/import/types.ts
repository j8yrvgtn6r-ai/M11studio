import type { M11GenerationProgressSnapshot } from './llm/m11GenerationProgress';

export type ProtocolSourceArtifactStatus =
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'extraction-failed';

/** @deprecated Use SectionReviewState */
export type GeneratedSectionReviewStatus =
  | 'pending-review'
  | 'approved'
  | 'changes-requested';

export type SectionReviewState =
  | 'generated'
  | 'pendingReview'
  | 'inReview'
  | 'changesRequested'
  | 'approved'
  | 'validationPending'
  | 'validationPassed'
  | 'validationFailed'
  | 'superseded';

export type SectionGenerationProvider =
  | 'openai'
  | 'azure-openai'
  | 'anthropic'
  | 'fixture'
  | 'local'
  | 'local-deterministic'
  | 'llm';

export interface SectionGenerationProvenance {
  generationProvider: SectionGenerationProvider;
  generationModel: string;
  generationTimestamp: string;
  generationPromptVersion: string;
  sourceUploadId: string;
  knowledgeModelId: string;
  sourceCandidateIds: string[];
  confidence: number;
  generationNotes: string[];
  knowledgeElementsUsed: string[];
  draftVersion: number;
}

export interface SectionValidationFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestedTerm?: string;
}

export interface SectionStateHistoryEntry {
  state: SectionReviewState;
  changedAt: string;
  changedBy: string;
  note?: string;
}

export type GeneratedSectionGenerationStatus = 'generated' | 'failed';

export type GeneratedSectionValidationStatus =
  | 'not-run'
  | 'passed'
  | 'warnings'
  | 'failed';

export type ExtractionStatus = 'real-docx-parsed' | 'failed';

export interface ProtocolSourceArtifact {
  id: string;
  filename: string;
  uploadedAt: string;
  fileSize: number;
  fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  sourceType: 'user-uploaded-protocol';
  status: ProtocolSourceArtifactStatus;
  storagePath: string;
  errorMessage?: string;
}

export interface ExtractedParagraph {
  id: string;
  index: number;
  text: string;
  styleName?: string;
  isHeadingStyle: boolean;
  headingLevel?: number;
}

export interface ExtractedHeading {
  id: string;
  index: number;
  text: string;
  level: number;
  styleName?: string;
  paragraphIndex: number;
  charStart: number;
}

export interface ExtractedTable {
  id: string;
  index: number;
  rows: string[][];
  text: string;
}

export interface SourceSectionCandidate {
  id: string;
  headingText: string;
  headingLevel?: number;
  startIndex: number;
  endIndex: number;
  text: string;
  confidence: number;
  detectedNumber?: string;
  possibleM11SectionId?: string;
  detectionMethod: 'heading-style' | 'numbering' | 'all-caps' | 'whole-document';
}

export interface ImportedProtocolSource {
  uploadId: string;
  filename: string;
  extractedAt: string;
  fullText: string;
  paragraphs: ExtractedParagraph[];
  headings: ExtractedHeading[];
  sections: SourceSectionCandidate[];
  tables: ExtractedTable[];
  extractionWarnings: string[];
}

/** Persisted without large fullText — load body from IndexedDB. */
export interface ImportedProtocolSourceSummary {
  uploadId: string;
  filename: string;
  extractedAt: string;
  paragraphCount: number;
  headingCount: number;
  sectionCandidateCount: number;
  tableCount: number;
  extractionWarnings: string[];
  fullTextLength: number;
}

export type MappingMethod =
  | 'heading-number'
  | 'heading-title'
  | 'semantic-similarity'
  | 'content-context';

export type ProtocolSectionWorkflowState =
  | 'imported'
  | 'unvalidated'
  | 'validated'
  | 'generated'
  | 'reviewed'
  | 'outOfSync'
  | 'needsGeneration';

export type SectionContentOrigin = 'imported' | 'generated';

export interface MappedProtocolSection {
  mappedM11SectionId: string;
  mappedM11SectionTitle: string;
  sourceHeading: string;
  sourceText: string;
  sourceCandidateId: string;
  mappingConfidence: number;
  mappingMethod: MappingMethod;
  needsValidation: boolean;
}

export interface StructuralMappingResult {
  mappings: MappedProtocolSection[];
  mappedSectionIds: string[];
  needsGenerationSectionIds: string[];
}

export interface GeneratedSectionDraft {
  sectionId: string;
  title: string;
  generatedText: string;
  sourceUploadId: string;
  sourceExtractionId: string;
  knowledgeModelId: string;
  matchedSourceCandidateIds: string[];
  extractionStatus: ExtractionStatus;
  generationStatus: GeneratedSectionGenerationStatus;
  generationProvider: SectionGenerationProvider;
  provenance: SectionGenerationProvenance;
  draftVersion: number;
  state: SectionReviewState;
  stateChangedAt: string;
  stateChangedBy: string;
  stateHistory: SectionStateHistoryEntry[];
  /** @deprecated Derived from state — kept for migration */
  reviewStatus?: GeneratedSectionReviewStatus;
  generatedAt: string;
  lastReviewedAt?: string;
  reviewer?: string;
  validationStatus: GeneratedSectionValidationStatus;
  validationMessages: string[];
  validationFindings: SectionValidationFinding[];
  /** Hybrid import workflow state (mapping-first). */
  workflowState?: ProtocolSectionWorkflowState;
  contentOrigin?: SectionContentOrigin;
  sourceText?: string;
  sourceHeading?: string;
  validatedTargetText?: string;
  mappingConfidence?: number;
  mappingMethod?: MappingMethod;
  lastValidatedAt?: string;
}

export type ProtocolCommitSource =
  | 'manualEdit'
  | 'importRewrite'
  | 'protocolUnderstanding'
  | 'm11Generation'
  | 'sectionRegeneration'
  | 'sectionApproval'
  | 'validationRun'
  | 'export';

export interface ProtocolCommit {
  id: string;
  protocolId: string;
  parentCommitId?: string;
  message: string;
  createdAt: string;
  createdBy: string;
  snapshotHash: string;
  source: ProtocolCommitSource;
  changedSectionIds: string[];
  validationSummary: string;
  metadata: Record<string, unknown>;
}

export type ProtocolVersionLifecycleStatus = 'draft' | 'inReview' | 'approved' | 'archived';

export interface ProtocolVersion {
  id: string;
  label: string;
  lifecycleStatus: ProtocolVersionLifecycleStatus;
  headCommitId: string;
  createdAt: string;
  createdBy: string;
}

export interface ProtocolImportReviewSummary {
  totalGenerated: number;
  pendingReview: number;
  inReview: number;
  approved: number;
  changesRequested: number;
  validationPassed: number;
  validationFailed: number;
  validationWarnings: number;
  validationErrors: number;
}

export interface ProtocolImportState {
  artifact: ProtocolSourceArtifact | null;
  importedSourceSummary: ImportedProtocolSourceSummary | null;
  protocolKnowledgeModelId: string | null;
  protocolId: string;
  sectionDrafts: Record<string, GeneratedSectionDraft>;
  structuralMappings?: MappedProtocolSection[];
  lastImportCompletedAt: string | null;
  storageWarnings: string[];
  /** In-memory staging phase for the active import session. */
  importContextPhase?: ImportContextPhase;
}

export type ImportContextPhase =
  | 'idle'
  | 'extraction'
  | 'understanding'
  | 'core-ready'
  | 'enriching'
  | 'ready';

export type ImportProcessingStepId =
  | 'uploading'
  | 'reading-docx'
  | 'identifying-sections'
  | 'understanding-context'
  | 'rewriting-m11'
  | 'structure-checks'
  | 'preparing-workspace';

export type ImportProcessingStepState = 'pending' | 'active' | 'complete' | 'failed';

export interface ImportProcessingStep {
  id: ImportProcessingStepId;
  label: string;
  state: ImportProcessingStepState;
  detail?: string;
  generationProgress?: M11GenerationProgressSnapshot;
}

export interface DocxExtractionProgress {
  paragraphCount?: number;
  headingCount?: number;
  sectionCandidateCount?: number;
  warnings?: string[];
}

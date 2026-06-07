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

export type ValidationChangeType =
  | 'addition'
  | 'deletion'
  | 'replacement'
  | 'terminology'
  | 'structural'
  | 'formatting';

export type ValidationChangeSeverity = 'info' | 'warning' | 'required';

export interface ValidationChange {
  id: string;
  type: ValidationChangeType;
  originalText?: string;
  replacementText?: string;
  reason: string;
  startIndex?: number;
  endIndex?: number;
  terminologyCode?: string;
  severity: ValidationChangeSeverity;
}

export interface ValidationAttemptRecord {
  attemptedAt: string;
  validatedTargetText: string;
  changeCount: number;
  outcome: 'proposed' | 'accepted' | 'rejected' | 'failed' | 'no_changes_required';
  reason?: string;
  provider?: SectionGenerationProvider | 'local-deterministic';
}

export interface ValidationProposalSnapshot {
  validatedTargetText?: string;
  validationChanges?: ValidationChange[];
  validationFindings?: SectionValidationFinding[];
  validationMessages?: string[];
  validationProvider?: SectionGenerationProvider | 'local-deterministic';
  validationModel?: string;
  lastValidatedAt?: string;
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
  /** Paragraph index of the heading line. */
  sourceStartParagraphIndex?: number;
  /** Exclusive paragraph index where this section ends. */
  sourceEndParagraphIndex?: number;
  /** Full section text including heading line. */
  text: string;
  /** Body text under the heading (verbatim, excludes heading line). */
  bodyText?: string;
  confidence: number;
  detectedNumber?: string;
  possibleM11SectionId?: string;
  detectionMethod: 'heading-style' | 'numbering' | 'all-caps' | 'whole-document';
  importedTextLength?: number;
  sourcePreview?: string;
  isSuspiciousBody?: boolean;
  /** Link to Canonical Document Model section when built via CDM. */
  canonicalSectionId?: string;
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
  /** Canonical Document Model identifier (`canonical-{uploadId}`). */
  canonicalDocumentId?: string;
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
  | 'content-context'
  | 'exactNumber'
  | 'exactTitle'
  | 'normalizedTitle'
  | 'semanticTitle'
  | 'contentHeuristic'
  | 'manual';

export type ProtocolSectionWorkflowState =
  | 'importedUnvalidated'
  | 'imported'
  | 'validationRunning'
  | 'validationProposed'
  | 'validationRejected'
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
  sourceSectionId: string;
  sourceHeading: string;
  sourceHeadingLevel?: number;
  sourceText: string;
  sourceCandidateId: string;
  sourceStartIndex: number;
  sourceEndIndex: number;
  mappingConfidence: number;
  mappingMethod: MappingMethod;
  needsValidation: boolean;
  importedTextLength: number;
  sourcePreview: string;
  mappingWarnings?: string[];
}

export interface StructuralMappingResult {
  mappings: MappedProtocolSection[];
  mappedSectionIds: string[];
  needsGenerationSectionIds: string[];
}

export interface SuspiciousMappingRecord {
  sourceSectionId: string;
  sourceHeading: string;
  mappedM11SectionId: string;
  mappedM11Title: string;
  mappingMethod: MappingMethod;
  mappingScore: number;
  reason: string;
  warnings: string[];
}

export type SectionMappingStatus = 'mapped' | 'suspicious' | 'rejected' | 'noMatch';

export type SectionMappingReason =
  | 'headingOnly'
  | 'bodyTooShort'
  | 'appendixMismatch'
  | 'tocFragment'
  | 'lowConfidence'
  | 'duplicateMapping'
  | 'noCandidate'
  | 'other';

export type SectionGenerationEligibility =
  | 'eligible'
  | 'waitingForCoreModel'
  | 'waitingForKnowledgeLayer'
  | 'noSourceContext'
  | 'skippedByGenerationAgent'
  | 'alreadyGenerated'
  | 'other';

export interface SectionImportDiagnostics {
  sectionId: string;
  sectionTitle: string;
  capturedAt: string;
  generationState?: string;
  foundInSource: boolean;
  sourceHeadingMatch?: string;
  mappingStatus: SectionMappingStatus;
  mappingReason: SectionMappingReason;
  mappingDetail?: string;
  mappingScore?: number;
  generationAttempted: boolean;
  generationEligibility: SectionGenerationEligibility;
  generationSkipReason?: string;
  diagnosticSummary: string;
  canonicalSectionId?: string;
  canonicalHeadingLevel?: number;
  canonicalBlockCount?: number;
  mappingSimilarityScore?: number;
  mappingSimilarityReasons?: string[];
  orphanClassification?: 'trueMissing' | 'mappingFailure' | 'generationFailure' | 'staleState' | 'unknown';
  nextRecommendedAction?: string;
  mappingRejected?: boolean;
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
  sourceSectionId?: string;
  sourceHeadingLevel?: number;
  sourceStartIndex?: number;
  sourceEndIndex?: number;
  importedTextLength?: number;
  sourcePreview?: string;
  validatedTargetText?: string;
  mappingConfidence?: number;
  mappingMethod?: MappingMethod;
  mappingWarnings?: string[];
  suspiciousMapping?: boolean;
  lastValidatedAt?: string;
  validationProvider?: SectionGenerationProvider | 'local-deterministic';
  validationModel?: string;
  /** Snapshot of deterministic proposal preserved while reviewing an LLM proposal. */
  deterministicValidationBackup?: ValidationProposalSnapshot | null;
  llmValidationInProgress?: boolean;
  validationChanges?: ValidationChange[];
  validationHistory?: ValidationAttemptRecord[];
  /** Consistency Agent — downstream impact records when study facts change elsewhere. */
  consistencyImpacts?: ConsistencyImpactRecord[];
  /** Workflow state before Consistency Agent marked this section out of sync. */
  priorWorkflowState?: ProtocolSectionWorkflowState;
}

export interface ConsistencyImpactRecord {
  impactId: string;
  sourceSectionId: string;
  sourceSectionTitle?: string;
  changedItemName: string;
  changedItemCollection: string;
  relationship: string;
  reason: string;
  suggestedAction: 'validate' | 'regenerate' | 'edit';
  detectedAt: string;
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

export interface ImportSummaryReport {
  capturedAt: string;
  importedSections: number;
  validatedSections: number;
  generatedSections: number;
  needsGeneration: number;
  suspiciousMappings: number;
  noMatch: number;
  orphanSections: number;
  knowledgeGraphEntities: number;
  knowledgeGraphRelationships: number;
  generationQueued: number;
  generationSkipped: number;
  mappedSections: number;
}

export interface LlmRoutingAuditEntry {
  sectionId: string;
  reason: string;
}

export interface LlmRoutingAuditReport {
  capturedAt: string;
  mappedDeterministically: number;
  generatedByLlm: number;
  generatedByLocalDeterministic: number;
  unnecessaryLlmRouting: LlmRoutingAuditEntry[];
}

export interface ProtocolImportState {
  artifact: ProtocolSourceArtifact | null;
  importedSourceSummary: ImportedProtocolSourceSummary | null;
  protocolKnowledgeModelId: string | null;
  protocolId: string;
  sectionDrafts: Record<string, GeneratedSectionDraft>;
  structuralMappings?: MappedProtocolSection[];
  suspiciousMappings?: SuspiciousMappingRecord[];
  sectionImportDiagnostics?: Record<string, SectionImportDiagnostics>;
  importSummaryReport?: ImportSummaryReport;
  llmRoutingAudit?: LlmRoutingAuditReport;
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

export type {
  GeneratedSectionDraft,
  GeneratedSectionReviewStatus,
  GeneratedSectionValidationStatus,
  ExtractedHeading,
  ExtractedParagraph,
  ExtractedTable,
  ExtractionStatus,
  ImportedProtocolSource,
  ImportedProtocolSourceSummary,
  ImportProcessingStep,
  ImportProcessingStepId,
  ImportProcessingStepState,
  ProtocolCommit,
  ProtocolCommitSource,
  ProtocolImportReviewSummary,
  ProtocolImportState,
  ProtocolSourceArtifact,
  ProtocolSourceArtifactStatus,
  ProtocolVersion,
  ProtocolVersionLifecycleStatus,
  SectionGenerationProvider,
  SectionReviewState,
  SectionStateHistoryEntry,
  SourceSectionCandidate,
} from './types';

export type { ProtocolKnowledgeModel, ProtocolKnowledgeProvider, ProtocolKnowledgeProviderId } from './protocolKnowledgeTypes';

export {
  approveSectionImportDraft,
  downloadProtocolSourceArtifact,
  getImportedProtocolSource,
  getProtocolImportReviewSummary,
  getProtocolImportState,
  getProtocolKnowledgeModel,
  getProtocolSourceBlobUrl,
  getProtocolVersioningForImport,
  getSectionImportDraft,
  initProtocolImportStore,
  openSectionForReview,
  openProtocolSourceArtifact,
  regenerateSectionImportDraft,
  requestChangesOnSectionImportDraft,
  setProtocolImportArtifact,
  setProtocolImportDrafts,
  setProtocolImportExtractionFailed,
  setProtocolImportResult,
  subscribeProtocolImport,
  updateSectionImportDraft,
} from './protocolImportStore';

export {
  createInitialProcessingSteps,
  IMPORT_PROCESSING_STEP_DEFS,
  isDocxFile,
  loadDocxBlobForArtifact,
  runProtocolImportProcessing,
  storeUploadedDocxArtifact,
} from './protocolImportProcessor';

export { DocxExtractionError, extractDocxProtocolSource } from './docxProtocolExtractor';
export { buildProtocolKnowledgeModel, buildLocalDeterministicKnowledgeModel } from './buildProtocolKnowledgeModel';
export { detectSourceSections } from './sourceSectionDetection';
export { findRelevantSourceCandidates, mapSourceCandidatesToM11 } from './m11SourceSectionMapping';
export { rewriteProtocolToM11Sections, type RewriteProtocolSectionsInput } from './rewriteProtocolToM11Sections';
export { validateGeneratedSectionDraft } from './sectionDraftValidation';
export { clearDraftProtocolContentForImport, applyApprovedSectionDraft } from './applyImportToProtocol';
export {
  compareProtocolCommits,
  compareProtocolVersions,
  getProtocolCommits,
  getCurrentProtocolVersion,
  APP_SCHEMA_VERSION,
} from './protocolVersioning';
export {
  buildM11StudioArchivePayload,
  downloadM11StudioArchive,
  M11_STUDIO_ARCHIVE_SCHEMA,
  type M11StudioArchivePayload,
} from './exportProtocolArchive';
export {
  canTransitionSectionState,
  transitionSectionState,
  isSectionActionable,
  isSectionApproved,
  type SectionReviewEvent,
} from './sectionReviewStateMachine';
export { normalizeSectionDraft } from './draftMigration';

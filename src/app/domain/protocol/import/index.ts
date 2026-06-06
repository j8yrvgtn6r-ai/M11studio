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
  MappedProtocolSection,
  MappingMethod,
  ProtocolCommit,
  ProtocolCommitSource,
  ProtocolImportReviewSummary,
  ProtocolImportState,
  ProtocolSectionWorkflowState,
  ProtocolSourceArtifact,
  ProtocolSourceArtifactStatus,
  ProtocolVersion,
  ProtocolVersionLifecycleStatus,
  SectionContentOrigin,
  SectionGenerationProvider,
  SectionGenerationProvenance,
  SectionReviewState,
  SectionStateHistoryEntry,
  SectionValidationFinding,
  SourceSectionCandidate,
  StructuralMappingResult,
  ConsistencyImpactRecord,
} from './types';

export type { ProtocolKnowledgeModel, ProtocolKnowledgeProvider, ProtocolKnowledgeProviderId } from './protocolKnowledgeTypes';

export {
  approveSectionImportDraft,
  acceptSectionValidation,
  downloadProtocolSourceArtifact,
  getImportedProtocolSource,
  getProtocolImportReviewSummary,
  getProtocolImportState,
  getProtocolKnowledgeModel,
  getProtocolSourceBlobUrl,
  getProtocolVersioningForImport,
  getSectionImportDraft,
  getStructuralMappings,
  initProtocolImportStore,
  openSectionForReview,
  openProtocolSourceArtifact,
  prepareProtocolImportOverwrite,
  generateSectionImportDraftOnDemandAsync,
  generateRemainingSectionImportDraftsAsync,
  regenerateSectionImportDraft,
  regenerateSectionImportDraftAsync,
  rejectSectionValidation,
  runSectionValidation,
  stageProtocolImportExtraction,
  stageProtocolImportCoreUnderstanding,
  stageProtocolImportUnderstanding,
  stageProtocolImportMappings,
  markProtocolImportUnderstandingPhase,
  mergeProtocolKnowledgeEnrichment,
  syncSectionImportDrafts,
  upsertLiveSectionImportDraft,
  requestChangesOnSectionImportDraft,
  setProtocolImportArtifact,
  setProtocolImportDrafts,
  setProtocolImportExtractionFailed,
  setProtocolImportResult,
  subscribeProtocolImport,
  updateSectionImportDraft,
  applyConsistencyAgentResults,
  clearSectionOutOfSyncState,
  getSectionImportDrafts,
} from './protocolImportStore';

export {
  createInitialProcessingSteps,
  IMPORT_PROCESSING_STEP_DEFS,
  isDocxFile,
  loadDocxBlobForArtifact,
  retryFailedM11SectionGeneration,
  generateM11SectionOnDemand,
  generateRemainingM11Sections,
  runProtocolImportProcessing,
  storeUploadedDocxArtifact,
} from './protocolImportProcessor';
export type { ProtocolImportProcessingResult, ProcessImportCallbacks } from './protocolImportProcessor';
export { ImportProcessingAbortedError, LlmRequestTimeoutError } from './llm/llmRequestTimeouts';
export {
  assertImportGenerationContextReady,
  assertPriorityGenerationContextReady,
  getImportGenerationContextDiagnostics,
  getPriorityGenerationContextDiagnostics,
  ImportGenerationContextNotReadyError,
  isImportGenerationContextReady,
  isPriorityGenerationContextReady,
  logImportGenerationContextGap,
} from './importGenerationContext';

export { buildCoreStudyModel, coreStudyModelToProtocolKnowledgeModel } from './coreStudyModel';
export type { CoreStudyModel } from './coreStudyModel';

export { runStructuralMappingEngine } from './structuralMappingEngine';
export {
  buildFullTextFromParagraphs,
  buildSourcePreview,
  collectParagraphSectionBoundaries,
  extractBodyTextBetweenParagraphs,
  findNextPeerOrHigherBoundary,
  isAppendixHeading,
  isAppendixM11Section,
  isSuspiciousImportedBody,
  isTableOfContentsEntry,
  MIN_IMPORTED_BODY_LENGTH,
} from './sourceSectionBodyExtractor';
export {
  contentOriginLabel,
  importedSectionTooltip,
  inferWorkflowState,
  resolveWorkflowGenerationState,
  workflowStateLabel,
} from './sectionWorkflowState';
export { createImportedSectionDraft, markDraftAsGenerated } from './importedSectionBuilder';
export { buildValidatedTarget } from './sectionValidationTargetEngine';

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
export {
  normalizeImportedSourceSummary,
  normalizePersistedImportMetadata,
  normalizeProtocolKnowledgeModel,
  normalizeSectionDraft,
} from './draftMigration';
export { applyPostGenerationValidation, applyPostGenerationValidationBatch } from './postGenerationValidation';
export {
  getConfiguredLlmProviderId,
  getLlmProviderStatus,
  isRealLlmProvider,
  resolveLlmProviderConfig,
  resolveLlmProviderConfigForProvider,
  setConfiguredLlmProviderId,
} from './llm/llmConfig';
export {
  clearAzureOpenAiStoredConfig,
  clearOpenAiStoredConfig,
  getProviderHealth,
  hasSuccessfulProviderTest,
  healthStatusLabel,
  loadAzureOpenAiStoredConfig,
  loadOpenAiStoredConfig,
  maskApiKey,
  saveAzureOpenAiStoredConfig,
  saveOpenAiStoredConfig,
} from './llm/llmProviderSettings';
export type {
  AzureOpenAiStoredConfig,
  LlmHealthStatusKind,
  LlmProviderHealthRecord,
  OpenAiStoredConfig,
} from './llm/llmProviderSettings';
export { testLlmProviderConnection } from './llm/llmProviderHealthCheck';
export type {
  LlmProviderCardInfo,
  LlmProviderCardStatus,
  LlmProviderSourceKind,
  LlmProviderStatusSnapshot,
} from './llm/llmConfig';
export { runProtocolUnderstanding, resolveProtocolUnderstandingProvider } from './llm/protocolUnderstandingProvider';
export { runM11SectionGeneration, runM11SectionRegeneration, resolveM11GenerationProvider } from './llm/m11GenerationProvider';
export type { M11GenerationCallbacks, M11GenerationProgressSnapshot } from './llm/m11GenerationProgress';
export type { ProtocolUnderstandingCallbacks } from './llm/types';
export { GENERATION_PROMPT_VERSION, UNDERSTANDING_PROMPT_VERSION, type LlmProviderId } from './llm/types';
export {
  countPendingM11Sections,
  isQuickReconstructionSection,
  listQuickReconstructionSectionIds,
  listSectionsEligibleForGeneration,
  QUICK_RECONSTRUCTION_SECTION_IDS,
} from './quickReconstructionSections';
export { listM11GenerationTargetSectionIds, flattenProtocolSectionIds } from './importVisualizationUtils';
export { runStagedProtocolUnderstanding, runDeepKnowledgeEnrichment } from './llm/understandingSlices';

export type * from './soaKnowledgeTypes';

export type * from './soaProposalTypes';

export type * from './soaEnrichmentProposal';



export {

  applySoAKnowledgePatch,

  createEmptySoAKnowledgeModel,

  normalizeSoAName,

} from './soaKnowledgePatch';



export {

  clearSoAKnowledge,

  getSoAKnowledge,

  patchSoAKnowledge,

  resetSoAKnowledgeForTests,

  setSoAKnowledge,

  subscribeSoAKnowledge,

} from './soaKnowledgeStore';



export {

  buildSoAKnowledgeFromExistingConfiguration,

  buildSoAKnowledgeFromProtocolSections,

  compareSoAKnowledgeToExistingConfiguration,

  mergeExtractedSoAKnowledgeIntoStore,

  refreshSoAKnowledgeFromImport,

  sectionsFromImportDrafts,

} from './soaKnowledgeBuilder';

export { applySoAKnowledgeToExistingConfiguration } from './soaConfigurationPatch';



export {

  applySoAConfigurationPatchSafely,

  buildProposedConfigurationPatch,

} from './soaConfigurationPatch';

export type { SoAConfigurationPatch, SoAConfigurationPatchResult } from './soaConfigurationPatch';



export {

  acceptSoAProposal,

  clearSoAProposal,

  clearSoAProposalForTests,

  createSoAProposal,

  getCurrentSoAProposal,

  getSoAProposalHistory,

  rejectSoAProposal,

  resetSoAProposalStoreForTests,

  subscribeSoAProposal,

  supersedeSoAProposal,

} from './soaProposalStore';



export {

  findSoAAssessmentByName,

  findSoAVisitByName,

  getSoAKnowledgeDiagnostics,

  getSoAKnowledgeSummary,

  selectAssessmentsByCategory,

  selectScheduleRulesForAssessment,

  selectScheduleRulesForVisit,

  selectVisitsForEpoch,

} from './soaKnowledgeSelectors';



export {

  applySoAKnowledgeGraphPatchSafely,

  buildKnowledgeGraphPatchFromSoAKnowledge,

  buildSoAKnowledgeFromKnowledgeGraph,

  getSoAEntityKnowledgeLinks,

  linkSoAEntityToKnowledgeEntity,

} from './soaKnowledgeGraphBridge';



export {

  createSoANarrativeImpactRecord,

  getNarrativeSectionsImpactedBySoAChange,

  getSoAFieldsImpactedByNarrativeSection,

} from './soaKnowledgeNarrativeSync';



export { useSoAKnowledgeSummary, useSoAKnowledgeModel } from './useSoAKnowledge';

export { useSoAProposal } from './useSoAProposal';

export {
  acceptSoAEnrichmentProposal,
  clearSoAEnrichmentProposal,
  createSoAEnrichmentProposal,
  getCurrentSoAEnrichmentProposal,
  rejectSoAEnrichmentProposal,
  resetSoAEnrichmentStoreForTests,
  subscribeSoAEnrichmentProposal,
  supersedeSoAEnrichmentProposal,
} from './soaEnrichmentStore';

export {
  countEnrichmentProposalItems,
  enrichmentProposalToKnowledgePatch,
} from './soaEnrichmentProposal';

export { useSoAEnrichmentProposal } from './useSoAEnrichmentProposal';

export type * from './soaTableExtractionTypes';
export type * from './soaNarrativeSyncProposal';
export {
  extractSoATablesFromCanonicalDocument,
  buildMatrixProposalPreview,
} from './soaTableExtractor';
export { reconcileNarrativeAndTableSoAKnowledge } from './soaTableReconciliation';
export {
  docxTableExtractionProvider,
  pdfTextTableExtractionProvider,
  ocrTableExtractionProvider,
  runDocxTableExtraction,
} from './soaTableExtractionProviders';
export {
  acceptSoANarrativeSyncProposal,
  clearSoANarrativeSyncState,
  createSoANarrativeSyncProposal,
  createSoANarrativeSyncProposalFromSoAAcceptance,
  flagSoARefreshNeededForNarrativeSection,
  getCurrentSoANarrativeSyncProposal,
  getSoASectionRefreshDiagnostics,
  rejectSoANarrativeSyncProposal,
  resetSoANarrativeSyncStoreForTests,
  subscribeSoANarrativeSync,
} from './soaNarrativeSyncStore';

export {
  evaluateSoAEnrichmentReadiness,
  evaluateSoAFirstPassReadiness,
  SOA_READINESS_RELEVANT_SECTION_IDS,
} from './soaReadinessEvaluator';
export type {
  SoAEnrichmentReadinessEvaluation,
  SoAReadinessEvaluation,
  SoAReadinessRelevantSectionId,
} from './soaReadinessEvaluator';

export {
  hasBlockingValidationIssues,
  validateSoAEntityForm,
  describeEntityForImpact,
} from './soaEntityValidation';
export type { SoAEntityEditorKind, SoAEntityFormValues, SoAEntityValidationIssue } from './soaEntityValidation';

export { listKnowledgeEntities, saveManualSoAEntity, entityToFormValues, deleteManualSoAEntity } from './soaManualAuthoringService';
export type { ManualSoAEntitySaveResult } from './soaManualAuthoringService';

export {
  SOA_BUILDER_LAYER_DEFINITIONS,
  SOA_BUILDER_NARRATIVE_SECTIONS,
  SOA_BUILDER_STRUCTURE_LAYERS,
  SOA_BUILDER_SYNC_TARGETS,
} from './soaStudyStructureModel';
export type {
  SoABuilderLayerDefinition,
  SoABuilderNarrativeSectionId,
  SoABuilderStructureLayer,
  SoABuilderSyncTarget,
} from './soaStudyStructureModel';

export {
  validateScheduledAssessmentNarrativeCoverage,
  validateSoAKnowledgeIntegrity,
} from './soaKnowledgeIntegrity';

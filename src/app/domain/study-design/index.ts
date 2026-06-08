export type * from './StudyDesignTypes';

export {
  addManualStudyDesignEntity,
  clearStudyDesign,
  createEmptyStudyDesign,
  deleteManualStudyDesignEntity,
  getStudyDesign,
  listScheduleAnchors,
  listStudyDesignEpochs,
  listStudyDesignVisits,
  normalizeStudyDesign,
  patchStudyDesign,
  replaceStudyDesignFromSync,
  resetStudyDesignForTests,
  setStudyDesign,
  subscribeStudyDesign,
  updateManualStudyDesignEntity,
} from './StudyDesignStore';

export {
  evaluateStudyDesignStudioState,
  getStudyDesignCounts,
  getStudyDesignSummary,
  hasStudyDesign,
  inferStudyDesignDetectionSources,
  listStudyDesignEntities,
  protocolNarrativeHasScheduleSignals,
  studyDesignHasEntities,
} from './StudyDesignSelectors';
export type { StudyDesignCounts, StudyDesignStudioState, StudyDesignSummary } from './StudyDesignSelectors';

export {
  hasBlockingStudyDesignValidationIssues,
  validateStudyDesign,
} from './StudyDesignValidation';

export {
  detectStudyDesignConflicts,
  hasBlockingStudyDesignConflicts,
} from './StudyDesignConflictEngine';

export { calculateStudyDesignHealthScore } from './StudyDesignHealthScore';

export {
  applyStudyDesignKnowledgeGraphPatchSafely,
  buildKnowledgeGraphPatchFromStudyDesign,
} from './studyDesignGraphBridge';

export {
  clearStudyDesignProposals,
  getCurrentNarrativeImpactProposal,
  getCurrentStudyDesignSyncProposal,
  resetStudyDesignProposalsForTests,
  setNarrativeImpactProposal,
  setStudyDesignSyncProposal,
  subscribeStudyDesignProposals,
} from './studyDesignProposalStore';

export {
  acceptStudyDesignSyncProposal,
  buildAndApplyStudyDesignFromSources,
  buildSoAExportHintsFromStudyDesign,
  buildSoAKnowledgeFromStudyDesign,
  buildStudyDesignFromKnowledgeGraph,
} from './StudyDesignSynchronization';

export {
  collectNarrativeSectionText,
  detectNarrativeChangesForStudyDesign,
  narrativeSectionHasScheduleSignals,
} from './synchronization/NarrativeToStudyDesign';

export {
  createNarrativeImpactProposal,
  formatNarrativeImpactMessage,
} from './synchronization/StudyDesignToNarrative';

export {
  analyzeCrossLayerImpact,
  describeStudyDesignChangeImpact,
  getImpactedSectionsForEntityChange,
} from './synchronization/StudyDesignImpactAnalysis';

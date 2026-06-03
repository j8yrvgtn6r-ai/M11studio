export type {
  SchemaVersion,
  AuthoringMode,
  ProtocolLifecycleStatus,
  StandardsVersionsReference,
  Requiredness,
  DocumentStatus,
  GraphEntityStatus,
  Severity,
  SectionViewKind,
  GraphEntityType,
  RelationshipKind,
  ProtocolDocument,
  ProtocolMetadata,
  SectionNode,
  ProtocolElement,
  ControlledTerminologyRef,
  ClinicalDesignEntities,
  DesignEntity,
  ScheduleDefinition,
  ScheduleCacheMetadata,
  ScheduleVisit,
  ScheduleAssessment,
  ScheduleCell,
  ScheduleAnchor,
  ScheduleAnchorType,
  VisitDefinition,
  VisitDefinitionType,
  VisitScheduleModel,
  SoAAssessmentDefinition,
  AssessmentScheduleRule,
  RelativeTiming,
  ScheduleCondition,
  MissedVisitPolicy,
  ReanchorPolicy,
  RipplePolicy,
  ProtocolRelationship,
  ValidationIssueRecord,
  CollaborationRecord,
  CommentRecord,
  AuditEventRecord,
} from './types';

export { getProtocolDocument, loadProtocol } from './loadProtocol';

export {
  getProtocolSnapshot,
  resetProtocolStore,
  subscribe,
  createAssessmentScheduleRule,
  createDesignEntity,
  createRelationship,
  deleteAssessmentScheduleRule,
  deleteDesignEntity,
  deleteRelationship,
  updateAssessmentScheduleRule,
  updateDesignEntity,
  updateElement,
  updateElementValue,
  updateRelationship,
  updateScheduleAnchor,
  updateVisitDefinition,
  regenerateScheduleCache,
  isAuthoritativeScheduleCacheStale,
} from './store';

export type {
  CreateAssessmentScheduleRuleInput,
  CreateDesignEntityInput,
  CreateRelationshipInput,
  UpdateAssessmentScheduleRulePatch,
  UpdateDesignEntityPatch,
  UpdateRelationshipPatch,
  UpdateScheduleAnchorPatch,
  UpdateVisitDefinitionPatch,
} from './store';

export {
  CLINICAL_DESIGN_COLLECTION_KEYS,
  collectAllDesignEntities,
  designEntityExists,
  designEntityExistsInDocument,
  entityHasRelationshipReferences,
  findDesignEntity,
  findDesignEntityInDocument,
  findRelationship,
  findRelationshipInDocument,
  findRelationshipsReferencingEntityInDocument,
  getDesignEntityCollectionKey,
  relationshipExists,
} from './clinicalDesign';

export type {
  ClinicalDesignCollectionKey,
  DesignEntityLocation,
  RelationshipLocation,
} from './clinicalDesign';

export {
  collectSectionIds,
  isEntityTypeCompatibleWithCollection,
  isValidSectionRef,
  validateClinicalDesignEntities,
  validateRelationships,
} from './clinicalDesign';

export {
  findScheduleAnchor,
  findScheduleAnchorInDocument,
  findVisitDefinition,
  findVisitDefinitionInDocument,
  findVisitDefinitionBySoAColumnId,
  findVisitDefinitionBySoAColumnIdInDocument,
  scheduleAnchorExistsInDocument,
  selectScheduleAnchors,
  selectVisitDefinitions,
  visitDefinitionExistsInDocument,
  validateVisitSchedule,
} from './visitSchedule';

export type {
  ScheduleAnchorLocation,
  VisitDefinitionLocation,
} from './visitSchedule';

export {
  findSoAAssessmentDefinition,
  findSoAAssessmentDefinitionInDocument,
  selectSoAAssessmentDefinitions,
  selectSoAAssessmentDefinitionsByCategory,
  soaAssessmentDefinitionExistsInDocument,
  validateSoAAssessmentDefinitions,
} from './soaAssessmentDefinition';

export type { SoAAssessmentDefinitionLocation } from './soaAssessmentDefinition';

export {
  assessmentIdExistsInDocument,
  assessmentReferencesMatch,
  assessmentScheduleRuleExistsInDocument,
  buildAssessmentReferenceMetadata,
  collectClinicalDesignAssessmentIds,
  collectScheduleAssessmentIds,
  collectSoAAssessmentDefinitionIds,
  collectValidAssessmentIds,
  findAssessmentScheduleRule,
  findAssessmentScheduleRuleInDocument,
  findScheduleAssessmentInDocument,
  isClinicalDesignAssessmentId,
  isScheduleAssessmentId,
  isSoAAssessmentDefinitionId,
  resolveAssessmentReference,
  selectAssessmentScheduleRules,
  selectAssessmentScheduleRulesForAssessment,
  selectAssessmentScheduleRulesForVisit,
  validateAssessmentScheduleRules,
} from './assessmentScheduleRule';

export type {
  AssessmentReferenceKind,
  AssessmentReferenceResolution,
  AssessmentScheduleRuleLocation,
  AssessmentScheduleRuleValidationMessage,
} from './assessmentScheduleRule';

export {
  getAssessments,
  getAuditEvents,
  getComments,
  getDependencyEdges,
  getDependencyNodes,
  getFieldDefinitions,
  getProtocolSections,
  getSchedule,
  getSoACells,
  getUseGeneratedSchedule,
  getValidationIssues,
  getVisits,
  resetUseGeneratedSchedule,
  setUseGeneratedSchedule,
  getScheduleAnchors,
  getVisitDefinitions,
  getVisitDefinition,
  getVisitDefinitionBySoAColumnId,
  getSoAAssessmentDefinitions,
  getSoAAssessmentDefinition,
  getSoAAssessmentDefinitionsByCategory,
  getAssessmentScheduleRules,
  getAssessmentScheduleRulesForAssessment,
  getAssessmentScheduleRulesForVisit,
  getAssessmentScheduleRule,
  getGeneratedAssessments,
  getGeneratedSchedule,
  getGeneratedSoACells,
  getGeneratedVisits,
  selectAssessments,
  selectAuditEvents,
  selectComments,
  selectDependencyEdges,
  selectDependencyNodes,
  selectFieldDefinitions,
  selectProtocolSections,
  selectSoACells,
  selectValidationIssues,
  selectVisits,
  toLegacyDate,
} from './selectors';

export type { ScheduleSelectorOptions } from './selectors';

export { formatParityReport, runParityCheck } from './parity/checkParity';
export type { ParityCheckResult, ParityReport } from './parity/checkParity';

export {
  compareGeneratedScheduleToAuthoritative,
  formatGeneratedScheduleComparisonReport,
  formatGeneratedScheduleDiffReport,
  generateScheduleFromRules,
  generatedScheduleContentEquals,
  reportGeneratedScheduleDiff,
  resolveGeneratedAssessmentRowId,
  resolveGeneratedVisitColumnId,
  verifyGeneratedScheduleIndependentOfLegacyScheduleMetadata,
  buildScheduleSourceSnapshot,
  computeScheduleSourceHash,
  isScheduleCacheStale,
  regenerateScheduleCacheInDocument,
  validateScheduleCache,
  runScheduleParityCheck,
  formatScheduleParityReport,
  compareGeneratedScheduleFixtureParity,
  compareLegacyToGeneratedScheduleParity,
  ACCEPTED_LEGACY_SCHEDULE_CONTENT_DIFFS,
} from './scheduleGeneration';

export type {
  GeneratedSchedule,
  GeneratedScheduleComparisonReport,
  GeneratedScheduleDiffReport,
  GeneratedScheduleMetadata,
  ScheduleComparisonDifference,
  ScheduleComparisonSection,
  ScheduleSourceSnapshot,
  ScheduleCacheValidationMessage,
  ScheduleView,
  AcceptedScheduleContentDiff,
  ClassifiedScheduleDifference,
  ScheduleDifferenceKind,
  ScheduleParityReport,
  ScheduleParitySectionName,
  ScheduleSectionParityResult,
} from './scheduleGeneration';

export {
  downloadProtocolJson,
  ensureAuthoritativeScheduleCacheFresh,
  ensureScheduleCacheFresh,
  getProtocolExportFilename,
  serializeProtocolDocument,
} from './export';

export {
  formatProtocolValidationResult,
  logDevProtocolValidation,
  validateProtocol,
} from './validateProtocol';
export type { ProtocolValidationMessage, ProtocolValidationResult } from './validateProtocol';

/** Canonical study design model — source of truth for narrative, KG, SoA, USDM, and M11 schedule export. */

export type StudyDesignArmType = 'treatment' | 'placebo' | 'observation' | 'control' | 'other';

export type StudyDesignVisitClass =
  | 'scheduled'
  | 'unscheduled'
  | 'special'
  | 'nonVisit'
  | 'manual';

export type StudyDesignActivityType =
  | 'assessment'
  | 'procedure'
  | 'endpoint'
  | 'administrative';

/** First-class protocol milestone types (StudyMilestoneModel). */
export type StudyDesignMilestoneType =
  | 'randomization'
  | 'firstDose'
  | 'lastDose'
  | 'treatmentCompletion'
  | 'endOfTreatment'
  | 'endOfStudy'
  | 'safetyFollowUp'
  | 'screening'
  | 'custom'
  | 'other';

export type ScheduleAnchorType =
  | 'randomization'
  | 'firstDose'
  | 'lastDose'
  | 'previousVisit'
  | 'custom';

export type StudyDesignTimingUnit = 'days' | 'weeks';

export type StudyDesignEntitySource =
  | 'manualEntry'
  | 'knowledgeGraph'
  | 'protocolNarrative'
  | 'studyModel'
  | 'soaKnowledge';

export type StudyDesignDetectionSource = 'knowledgeGraph' | 'protocolNarrative' | 'manualEntry';

export interface StudyDesignProvenance {
  source: StudyDesignEntitySource;
  createdAt: string;
  updatedAt: string;
}

export interface StudyDesignArm {
  id: string;
  name: string;
  shortName?: string;
  type: StudyDesignArmType | string;
  provenance: StudyDesignProvenance;
}

export interface StudyDesignCohort {
  id: string;
  name: string;
  description?: string;
  provenance: StudyDesignProvenance;
}

export interface StudyDesignEpoch {
  id: string;
  name: string;
  provenance: StudyDesignProvenance;
}

export interface StudyDesignElement {
  id: string;
  name: string;
  epochId?: string;
  armId?: string;
  provenance: StudyDesignProvenance;
}

/** Schedule anchor model — visits reference anchors for timing. */
export interface StudyDesignScheduleAnchor {
  id: string;
  name: string;
  anchorType: ScheduleAnchorType | string;
  description?: string;
  provenance: StudyDesignProvenance;
}

export interface StudyDesignVisit {
  id: string;
  name: string;
  shortName?: string;
  visitClass: StudyDesignVisitClass | string;
  epochId?: string;
  visitNumber?: number;
  /** Legacy visit-to-visit anchor */
  anchorVisit?: string;
  /** Schedule anchor reference (First Dose, Randomization, etc.) */
  scheduleAnchorId?: string;
  offsetDays?: number;
  offsetUnit?: StudyDesignTimingUnit;
  nominalDay?: number;
  nominalWeek?: number;
  windowBefore?: number;
  windowAfter?: number;
  windowUnit?: StudyDesignTimingUnit;
  repeatable?: boolean;
  referenceTimepoint?: string;
  provenance: StudyDesignProvenance;
}

export interface StudyDesignActivity {
  id: string;
  name: string;
  activityType: StudyDesignActivityType | string;
  description?: string;
  provenance: StudyDesignProvenance;
}

/** StudyMilestoneModel — first-class milestone entity. */
export interface StudyDesignMilestone {
  id: string;
  name: string;
  description?: string;
  milestoneType: StudyDesignMilestoneType | string;
  anchorVisitId?: string;
  offsetDays?: number;
  offsetUnit?: StudyDesignTimingUnit;
  provenance: StudyDesignProvenance;
}

export interface StudyDesignScheduleRule {
  id: string;
  activityId: string;
  visitId: string;
  required: boolean;
  conditionalExpression?: string;
  footnote?: string;
  provenance: StudyDesignProvenance;
}

export interface StudyDesign {
  id: string;
  protocolId: string;
  updatedAt: string;
  detectionSources: StudyDesignDetectionSource[];
  arms: StudyDesignArm[];
  cohorts: StudyDesignCohort[];
  epochs: StudyDesignEpoch[];
  elements: StudyDesignElement[];
  anchors: StudyDesignScheduleAnchor[];
  visits: StudyDesignVisit[];
  activities: StudyDesignActivity[];
  milestones: StudyDesignMilestone[];
  scheduleRules: StudyDesignScheduleRule[];
}

export type StudyDesignEntityKind =
  | 'arm'
  | 'epoch'
  | 'visit'
  | 'activity'
  | 'milestone'
  | 'anchor';

export interface StudyDesignEntityFormValues {
  name: string;
  description?: string;
  type?: string;
  visitClass?: string;
  epochId?: string;
  activityType?: string;
  milestoneType?: string;
  anchorVisitId?: string;
  scheduleAnchorId?: string;
  offsetDays?: number;
  offsetUnit?: StudyDesignTimingUnit;
  nominalDay?: number;
  nominalWeek?: number;
  windowBefore?: number;
  windowAfter?: number;
  windowUnit?: StudyDesignTimingUnit;
}

export interface StudyDesignValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  entityKind?: string;
  entityId?: string;
}

export interface StudyDesignValidationResult {
  issues: StudyDesignValidationIssue[];
  summary: {
    errorCount: number;
    warningCount: number;
    status: 'healthy' | 'warnings' | 'errors';
  };
}

export type StudyDesignSyncProposalStatus = 'proposed' | 'accepted' | 'rejected';

export interface StudyDesignSyncItem {
  kind: StudyDesignEntityKind | 'cohort' | 'element' | 'scheduleRule' | 'anchor';
  id: string;
  name: string;
  source: StudyDesignEntitySource;
  sectionId?: string;
  reason?: string;
}

export interface StudyDesignSyncConflict {
  kind: string;
  id: string;
  message: string;
  existingName?: string;
  proposedName?: string;
}

export interface StudyDesignSyncProposal {
  id: string;
  createdAt: string;
  status: StudyDesignSyncProposalStatus;
  source: 'narrativeChange' | 'knowledgeGraph' | 'manual';
  detectionSources: StudyDesignDetectionSource[];
  addedItems: StudyDesignSyncItem[];
  modifiedItems: StudyDesignSyncItem[];
  removedItems: StudyDesignSyncItem[];
  /** @deprecated use modifiedItems */
  updatedItems?: StudyDesignSyncItem[];
  conflicts: StudyDesignSyncConflict[];
  proposedDesign: StudyDesign;
  reason?: string;
}

export type NarrativeImpactProposalStatus = 'proposed' | 'accepted' | 'rejected';

export interface NarrativeImpactProposal {
  id: string;
  createdAt: string;
  status: NarrativeImpactProposalStatus;
  source: 'studyDesignEdit';
  entityKind: StudyDesignEntityKind | 'epoch';
  entityId: string;
  entityName: string;
  impactedSectionIds: string[];
  message: string;
  suggestedNote: string;
}

export type StudyDesignConflictSeverity = 'error' | 'warning' | 'info';

export interface StudyDesignConflict {
  id: string;
  kind: string;
  entityId?: string;
  entityName?: string;
  message: string;
  severity: StudyDesignConflictSeverity;
  resolutionSuggestion?: string;
}

export interface StudyDesignHealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  dimensions: {
    structureCompleteness: number;
    visitCompleteness: number;
    activityCoverage: number;
    milestoneCoverage: number;
    scheduleCoverage: number;
    narrativeSyncStatus: number;
  };
  summary: string;
}

export interface StudyDesignSoAExportHints {
  footnoteSuggestions: string[];
  timingSuggestions: string[];
  milestoneRowSuggestions: string[];
}

export type StudyDesignPatch = Partial<
  Pick<
    StudyDesign,
    | 'arms'
    | 'cohorts'
    | 'epochs'
    | 'elements'
    | 'anchors'
    | 'visits'
    | 'activities'
    | 'milestones'
    | 'scheduleRules'
    | 'detectionSources'
  >
>;

/** Narrative sections monitored for Study Design sync (v2). */
export const STUDY_DESIGN_NARRATIVE_SECTION_IDS = ['3', '4', '5', '6', '8', '9'] as const;

export type StudyDesignNarrativeSectionId = (typeof STUDY_DESIGN_NARRATIVE_SECTION_IDS)[number];

/** Sections impacted when Study Design entities change. */
export const STUDY_DESIGN_NARRATIVE_IMPACT_SECTION_IDS = ['4', '5', '6', '8', '9'] as const;

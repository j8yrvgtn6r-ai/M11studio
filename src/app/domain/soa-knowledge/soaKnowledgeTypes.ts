/** Structured schedule knowledge — bridge between narrative, Knowledge Graph, and SoA Configuration. */

export type SoAInferenceSource =
  | 'deterministic'
  | 'deterministic-table'
  | 'llm-inferred'
  | 'llm-reconciled'
  | 'user-created'
  | 'user-modified'
  | 'user-accepted';

export interface SoAEvidenceReference {
  sectionId: string;
  sourceText: string;
  reason: string;
}

export interface SoAProvenanceFields {
  inferenceSource?: SoAInferenceSource;
  evidence?: SoAEvidenceReference[];
  rationale?: string;
}

export type SoAActivityType =
  | 'intervention'
  | 'assessment'
  | 'observation'
  | 'procedure'
  | 'safety'
  | 'efficacy'
  | 'pk'
  | 'pro'
  | 'other';

export type SoAAssessmentCategory =
  | 'safety'
  | 'efficacy'
  | 'pk'
  | 'pro'
  | 'imaging'
  | 'laboratory'
  | 'vitalSigns'
  | 'physicalExam'
  | 'adverseEvents'
  | 'concomitantMedication'
  | 'other';

export type SoATimingUnit = 'hours' | 'days' | 'weeks' | 'months' | 'cycles';

export interface SoAArm extends SoAProvenanceFields {
  id: string;
  name: string;
  description?: string;
  armType?: string;
  interventionId?: string;
  sourceSectionIds: string[];
}

export interface SoAEpoch extends SoAProvenanceFields {
  id: string;
  name: string;
  description?: string;
  epochType?: string;
  order: number;
  startMilestoneId?: string;
  endMilestoneId?: string;
  sourceSectionIds: string[];
}

export interface SoAElement extends SoAProvenanceFields {
  id: string;
  name: string;
  armId?: string;
  epochId?: string;
  description?: string;
  plannedDuration?: string;
  order: number;
  sourceSectionIds: string[];
}

export interface SoAVisit extends SoAProvenanceFields {
  id: string;
  name: string;
  visitType?: string;
  epochId?: string;
  elementId?: string;
  anchorId?: string;
  nominalDay?: number;
  nominalWeek?: number;
  nominalCycle?: number;
  window?: string;
  required?: boolean;
  order: number;
  sourceSectionIds: string[];
}

/** Timeline anchor event — maps to protocol ScheduleAnchor and USDM timing anchors. */
export interface SoAMilestone extends SoAProvenanceFields {
  id: string;
  name: string;
  milestoneType?: string;
  anchorDateOrEvent?: string;
  description?: string;
  sourceSectionIds: string[];
}

export interface SoAActivity extends SoAProvenanceFields {
  id: string;
  name: string;
  visitId?: string;
  elementId?: string;
  activityType?: SoAActivityType;
  order: number;
  sourceSectionIds: string[];
}

export interface SoAAssessment extends SoAProvenanceFields {
  id: string;
  name: string;
  category?: SoAAssessmentCategory;
  description?: string;
  linkedActivityIds?: string[];
  linkedVisitIds?: string[];
  required?: boolean;
  sourceSectionIds: string[];
}

export interface SoAProcedure extends SoAProvenanceFields {
  id: string;
  name: string;
  category?: SoAAssessmentCategory;
  assessmentId?: string;
  sourceSectionIds: string[];
}

export interface SoATimingWindow extends SoAProvenanceFields {
  id: string;
  label: string;
  offset?: number;
  unit?: SoATimingUnit;
  windowBefore?: number;
  windowAfter?: number;
  sourceSectionIds: string[];
}

export interface SoAScheduleRule extends SoAProvenanceFields {
  id: string;
  assessmentId?: string;
  procedureId?: string;
  activityId?: string;
  visitId?: string;
  armId?: string;
  epochId?: string;
  conditionId?: string;
  timingWindowId?: string;
  required: boolean;
  sourceSectionIds: string[];
  notes?: string;
}

export interface SoACondition extends SoAProvenanceFields {
  id: string;
  label: string;
  description?: string;
  expressionText?: string;
  appliesToEntityId?: string;
  appliesToEntityKind?: string;
  sourceSectionIds: string[];
}

export interface SoAFootnote extends SoAProvenanceFields {
  id: string;
  label: string;
  text: string;
  appliesToIds: string[];
  sourceSectionIds: string[];
}

export interface SoAKnowledgeDiagnostics {
  extractionNotes: string[];
  unmappedTimingReferences: string[];
  ambiguousScheduleStatements: string[];
}

export interface SoAKnowledgeModel {
  id: string;
  protocolId?: string;
  arms: SoAArm[];
  epochs: SoAEpoch[];
  elements: SoAElement[];
  visits: SoAVisit[];
  activities: SoAActivity[];
  assessments: SoAAssessment[];
  procedures: SoAProcedure[];
  timingWindows: SoATimingWindow[];
  scheduleRules: SoAScheduleRule[];
  conditions: SoACondition[];
  milestones: SoAMilestone[];
  footnotes: SoAFootnote[];
  sourceSectionIds: string[];
  extractionNotes: string[];
  unmappedTimingReferences: string[];
  ambiguousScheduleStatements: string[];
  updatedAt: string;
  version: number;
}

export interface SoAKnowledgePatch {
  protocolId?: string;
  arms?: SoAArm[];
  epochs?: SoAEpoch[];
  elements?: SoAElement[];
  visits?: SoAVisit[];
  activities?: SoAActivity[];
  assessments?: SoAAssessment[];
  procedures?: SoAProcedure[];
  timingWindows?: SoATimingWindow[];
  scheduleRules?: SoAScheduleRule[];
  conditions?: SoACondition[];
  milestones?: SoAMilestone[];
  footnotes?: SoAFootnote[];
  sourceSectionIds?: string[];
  extractionNotes?: string[];
  unmappedTimingReferences?: string[];
  ambiguousScheduleStatements?: string[];
}

export interface SoAProtocolSectionInput {
  sectionId: string;
  title: string;
  text: string;
}

export type SoAKnowledgeEntityKind =
  | 'arm'
  | 'epoch'
  | 'element'
  | 'visit'
  | 'activity'
  | 'assessment'
  | 'procedure'
  | 'timingWindow'
  | 'scheduleRule'
  | 'condition'
  | 'milestone'
  | 'footnote';

export type SoAChangeKind =
  | 'assessmentSchedule'
  | 'visitTiming'
  | 'interventionActivity'
  | 'assessmentAdded'
  | 'visitAdded'
  | 'scheduleRuleChanged'
  | 'other';

export interface SoAKnowledgeChange {
  kind: SoAChangeKind;
  entityKind?: SoAKnowledgeEntityKind;
  entityId?: string;
  entityName?: string;
  description?: string;
}

export interface SoANarrativeImpactRecord {
  change: SoAKnowledgeChange;
  impactedSectionIds: string[];
  reasons: Record<string, string>;
  createdAt: string;
}

export interface SoAConfigurationComparison {
  arms: { knowledge: number; configuration: number; matched: number };
  visits: { knowledge: number; configuration: number; matched: number };
  assessments: { knowledge: number; configuration: number; matched: number };
  scheduleRules: { knowledge: number; configuration: number; matched: number };
  unmatchedKnowledgeAssessments: string[];
  unmatchedConfigurationAssessments: string[];
}

export interface SoAKnowledgeSummary {
  armCount: number;
  epochCount: number;
  elementCount: number;
  visitCount: number;
  activityCount: number;
  assessmentCount: number;
  procedureCount: number;
  scheduleRuleCount: number;
  conditionCount: number;
  footnoteCount: number;
  timingWindowCount: number;
  extractionNoteCount: number;
  updatedAt: string | null;
  version: number;
}

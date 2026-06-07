/** Structured schedule knowledge — bridge between narrative, Knowledge Graph, and SoA Configuration. */

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

export interface SoAArm {
  id: string;
  name: string;
  description?: string;
  sourceSectionIds: string[];
}

export interface SoAEpoch {
  id: string;
  name: string;
  description?: string;
  order: number;
  sourceSectionIds: string[];
}

export interface SoAElement {
  id: string;
  name: string;
  armId?: string;
  epochId?: string;
  description?: string;
  order: number;
  sourceSectionIds: string[];
}

export interface SoAVisit {
  id: string;
  name: string;
  epochId?: string;
  elementId?: string;
  nominalDay?: number;
  nominalWeek?: number;
  window?: string;
  order: number;
  sourceSectionIds: string[];
}

export interface SoAActivity {
  id: string;
  name: string;
  visitId?: string;
  elementId?: string;
  activityType?: SoAActivityType;
  order: number;
  sourceSectionIds: string[];
}

export interface SoAAssessment {
  id: string;
  name: string;
  category?: SoAAssessmentCategory;
  description?: string;
  sourceSectionIds: string[];
}

export interface SoAProcedure {
  id: string;
  name: string;
  category?: SoAAssessmentCategory;
  assessmentId?: string;
  sourceSectionIds: string[];
}

export interface SoATimingWindow {
  id: string;
  label: string;
  offset?: number;
  unit?: SoATimingUnit;
  windowBefore?: number;
  windowAfter?: number;
  sourceSectionIds: string[];
}

export interface SoAScheduleRule {
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

export interface SoACondition {
  id: string;
  label: string;
  description?: string;
  expressionText?: string;
  sourceSectionIds: string[];
}

export interface SoAFootnote {
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

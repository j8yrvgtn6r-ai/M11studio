/**
 * Canonical protocol model for M11 Studio.
 *
 * This is the single source-of-truth shape for seed JSON and future persistence.
 * View-layer DTOs in `types/protocol.ts` and `types/dependencyGraph.ts` remain
 * unchanged until selectors adapt canonical data for UI consumption.
 */

export type SchemaVersion = '1.0.0';

/** Protocol artifact lifecycle for export and governance. */
export type ProtocolLifecycleStatus =
  | 'draft'
  | 'inReview'
  | 'approved'
  | 'published'
  | 'archived';

/** How the protocol is being authored in M11 Studio. */
export type AuthoringMode = 'structured' | 'narrative' | 'hybrid';

/** Placeholder for future Standards Repository version pins. */
export interface StandardsVersionsReference {
  ichM11?: string;
  cdiscCore?: string;
  cdiscControlledTerminology?: string;
  cdash?: string;
  sdtm?: string;
}

export type Requiredness = 'required' | 'optional' | 'conditional';

export type DocumentStatus =
  | 'complete'
  | 'inProgress'
  | 'requiredMissing'
  | 'conditionalMissing'
  | 'aiSuggestion'
  | 'reusedLinkedContent'
  | 'amended';

export type GraphEntityStatus =
  | 'complete'
  | 'incomplete'
  | 'validation-issue'
  | 'ai-recommendation'
  | 'recently-modified';

export type Severity = 'error' | 'warning' | 'info';

export type SectionViewKind = 'document' | 'schedule-of-activities' | 'graph-only';

export type GraphEntityType =
  | 'objective'
  | 'endpoint'
  | 'estimand'
  | 'assessment'
  | 'visit'
  | 'soa-row'
  | 'study-arm'
  | 'population'
  | 'eligibility'
  | 'intervention'
  | 'statistical-analysis'
  | 'biomarker'
  | 'safety-assessment'
  | 'protocol-section';

export type RelationshipKind =
  | 'defines'
  | 'measured-by'
  | 'performed-at'
  | 'analyzed-by'
  | 'requires'
  | 'assigned-to'
  | 'predicts'
  | 'monitored-at'
  | string;

/** Milestone used to position visits on the study timeline. */
export type ScheduleAnchorType =
  | 'informed-consent'
  | 'screening'
  | 'randomization'
  | 'first-dose'
  | 'cycle-1-day-1'
  | 'previous-visit'
  | 'last-dose'
  | 'end-of-treatment'
  | 'disease-progression'
  | 'investigator-decision'
  | 'custom';

export type VisitDefinitionType =
  | 'screening'
  | 'baseline'
  | 'treatment'
  | 'follow-up'
  | 'early-termination'
  | 'unscheduled';

export type MissedVisitPolicy =
  | 'skip'
  | 'makeUpAsSoonAsPossible'
  | 'recordDeviationOnly'
  | 'investigatorDecision';

export type ReanchorPolicy =
  | 'preserveOriginalAnchor'
  | 'reanchorToActualVisitDate'
  | 'reanchorOnlyWithinWindow'
  | 'reanchorOnlyIfProtocolSpecified'
  | 'hybrid';

export type RipplePolicy =
  | 'noRipple'
  | 'rippleSubsequentVisits'
  | 'rippleWithinEpochOnly'
  | 'rippleWithinCycleOnly'
  | 'rippleSelectedVisitTypesOnly';

/** Anchor visit or anchor event in the visit schedule catalog. */
export interface ScheduleAnchor {
  id: string;
  name: string;
  anchorType: ScheduleAnchorType;
  sourceVisitId?: string;
  sourceEventType?: string;
  description?: string;
}

/** Operational visit timing entry in the visit schedule model. */
export interface VisitDefinition {
  id: string;
  clinicalDesignVisitId?: string;
  name: string;
  visitType: VisitDefinitionType;
  epoch?: string;
  cycleNumber?: number;
  anchorId: string;
  offsetDays?: number;
  offsetWeeks?: number;
  offsetCycles?: number;
  nominalDay?: number;
  nominalWeek?: number;
  windowBeforeDays?: number;
  windowAfterDays?: number;
  armRestrictions?: string[];
  required: boolean;
  description?: string;
  order: number;
  /** Short SoA column header override when distinct from `name`. */
  displayLabel?: string;
  /** SoA column timepoint string override when distinct from computed anchor timing. */
  timepointDisplay?: string;
  /** Stable legacy/generated SoA column id (e.g. `v1`–`v9` during migration). */
  soaColumnId?: string;
  missedVisitPolicy?: MissedVisitPolicy;
  reanchorPolicy?: ReanchorPolicy;
  ripplePolicy?: RipplePolicy;
  /** When true, nominal schedule stays on original anchor even if actual visit dates slip. */
  preserveOriginalSchedule?: boolean;
  allowedMakeupWindowDays?: number;
  metadata?: Record<string, unknown>;
}

/** Visit schedule source-of-truth (anchors + visit definitions). */
export interface VisitScheduleModel {
  anchors: ScheduleAnchor[];
  visitDefinitions: VisitDefinition[];
}

export type RelativeTiming =
  | 'at-visit'
  | 'before-administration'
  | 'after-administration'
  | 'continuous'
  | 'between-visits'
  | 'interval-weeks';

export interface ScheduleCondition {
  expression?: string;
  armIds?: string[];
  populationIds?: string[];
}

/** SoA row catalog entry — presentation and row identity for the schedule matrix. */
export interface SoAAssessmentDefinition {
  id: string;
  label: string;
  category: string;
  order: number;
  linkedSectionId?: string;
  clinicalDesignAssessmentId?: string;
  metadata?: Record<string, unknown>;
}

/** Assessment × visit intersection rule for SoA generation. */
export interface AssessmentScheduleRule {
  id: string;
  /**
   * Canonical assessment reference: `soaAssessmentDefinitions[].id`.
   * Clinical design linkage is resolved through `SoAAssessmentDefinition.clinicalDesignAssessmentId`.
   * Transitional rule metadata may retain `legacyScheduleAssessmentId` and `scheduleVisitId` migration traces.
   */
  assessmentId: string;
  visitDefinitionId: string;
  required: boolean;
  timingNote?: string;
  windowBeforeDays?: number;
  windowAfterDays?: number;
  relativeTiming?: RelativeTiming;
  condition?: ScheduleCondition;
  armRestrictions?: string[];
  repeats?: boolean;
  independentOfDoseDelay?: boolean;
  sourceSectionId?: string;
  metadata?: Record<string, unknown>;
}

/** Root machine-readable protocol artifact. */
export interface ProtocolDocument {
  schemaVersion: SchemaVersion;
  id: string;
  title: string;
  m11Version?: string;
  metadata: ProtocolMetadata;
  sections: SectionNode[];
  elements: ProtocolElement[];
  clinicalDesign: ClinicalDesignEntities;
  visitSchedule: VisitScheduleModel;
  soaAssessmentDefinitions: SoAAssessmentDefinition[];
  assessmentScheduleRules: AssessmentScheduleRule[];
  schedule: ScheduleDefinition;
  relationships: ProtocolRelationship[];
  validationIssues: ValidationIssueRecord[];
  collaboration: CollaborationRecord;
}

export interface ProtocolMetadata {
  phase?: string;
  sponsor?: string;
  therapeuticArea?: string;
  createdAt: string;
  updatedAt: string;
  defaultUser?: string;
  lifecycleStatus?: ProtocolLifecycleStatus;
  authoringMode?: AuthoringMode;
  standardsVersions?: StandardsVersionsReference;
}

/** Hierarchical document tree node. */
export interface SectionNode {
  id: string;
  title: string;
  level: number;
  conformance: Requiredness | string;
  status: DocumentStatus;
  children?: SectionNode[];
  viewKind?: SectionViewKind;
  hasAmendment?: boolean;
  /** Optional display override when derived issue counts differ from legacy UI. */
  validationCount?: number;
  commentCount?: number;
  /** True when section exists from ICH M11 template only (no prior authored protocol content). */
  ichM11TemplateOnly?: boolean;
  /** True for template Foreword / Section 0 — instructional metadata, not finalized protocol body. */
  ichM11InstructionOnly?: boolean;
}

/** Authored M11 field element. */
export interface ProtocolElement {
  id: string;
  sectionId: string;
  label: string;
  kind: 'data' | 'value' | 'heading' | 'table';
  dataType: string;
  requiredness: Requiredness;
  cardinality?: string;
  repeatable?: boolean;
  reusable?: boolean;
  controlledTerminology?: ControlledTerminologyRef;
  validationRuleIds?: string[];
  aiHints?: string[];
  value?: unknown;
}

export interface ControlledTerminologyRef {
  codeList: string;
  values: Array<{ label: string; code?: string } | string>;
}

/** First-class clinical design entities referenced by the dependency graph. */
export interface ClinicalDesignEntities {
  objectives: DesignEntity[];
  endpoints: DesignEntity[];
  estimands?: DesignEntity[];
  assessments: DesignEntity[];
  visits: DesignEntity[];
  studyArms: DesignEntity[];
  populations: DesignEntity[];
  eligibilityCriteria: DesignEntity[];
  interventions: DesignEntity[];
  statisticalAnalyses: DesignEntity[];
  biomarkers?: DesignEntity[];
  safetyAssessments?: DesignEntity[];
}

export interface DesignEntity {
  id: string;
  type: GraphEntityType;
  name: string;
  description?: string;
  /** Document anchor; preserved from legacy graph data for parity. */
  sectionRef?: string;
  status: GraphEntityStatus[];
  metadata?: Record<string, unknown>;
}

/** Schedule of Activities definition. */
export interface ScheduleCacheMetadata {
  generatedFromRules?: boolean;
  generatedAt?: string;
  sourceHash?: string;
  sourceRuleCount?: number;
  sourceVisitDefinitionCount?: number;
  sourceSoAAssessmentDefinitionCount?: number;
}

export interface ScheduleDefinition {
  visits: ScheduleVisit[];
  assessments: ScheduleAssessment[];
  cells: ScheduleCell[];
  metadata?: ScheduleCacheMetadata;
}

export interface ScheduleVisit {
  id: string;
  entityId?: string;
  label: string;
  order: number;
  timepoint?: string;
}

export interface ScheduleAssessment {
  id: string;
  entityId?: string;
  label: string;
  category: string;
  linkedSectionId?: string;
}

export interface ScheduleCell {
  visitId: string;
  assessmentId: string;
  required: boolean;
  notes?: string;
}

/** Directed relationship between clinical design entities. */
export interface ProtocolRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  kind?: RelationshipKind;
}

export interface ValidationIssueRecord {
  id: string;
  ruleId: string;
  name: string;
  severity: Severity;
  sectionId: string;
  elementId?: string;
  entityId?: string;
  message: string;
  quickFix?: string;
}

export interface CollaborationRecord {
  comments: CommentRecord[];
  auditEvents: AuditEventRecord[];
}

export interface CommentRecord {
  id: string;
  timestamp: string;
  user: string;
  sectionId: string;
  elementId?: string;
  content: string;
  resolved: boolean;
}

export interface AuditEventRecord {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  sectionId?: string;
  elementId?: string;
  details: string;
}

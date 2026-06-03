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
export interface ScheduleDefinition {
  visits: ScheduleVisit[];
  assessments: ScheduleAssessment[];
  cells: ScheduleCell[];
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

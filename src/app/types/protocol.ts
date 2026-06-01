// M11 Studio Type Definitions

export type RequirednessType = 'required' | 'optional' | 'conditional';
export type StatusType = 'complete' | 'inProgress' | 'requiredMissing' | 'conditionalMissing' | 'aiSuggestion' | 'reusedLinkedContent' | 'amended';
export type SeverityType = 'error' | 'warning' | 'info';

export interface ProtocolSection {
  id: string;
  title: string;
  level: number;
  conformance: string;
  status: StatusType;
  children?: ProtocolSection[];
  validationCount?: number;
  commentCount?: number;
  hasAmendment?: boolean;
}

export interface FieldDefinition {
  id: string;
  sectionId: string;
  label: string;
  kind: 'data' | 'value' | 'heading' | 'table';
  dataType: string;
  requiredness: RequirednessType;
  cardinality?: string;
  repeatable?: boolean;
  reusable?: boolean;
  controlledTerminology?: ControlledTerminology;
  validationRules?: string[];
  aiHints?: string[];
  value?: any;
}

export interface ControlledTerminology {
  codeList: string;
  values: Array<{ label: string; code?: string } | string>;
}

export interface ValidationIssue {
  id: string;
  name: string;
  severity: SeverityType;
  sectionId: string;
  fieldId?: string;
  message: string;
  quickFix?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  sectionId?: string;
  fieldId?: string;
  details: string;
}

export interface Comment {
  id: string;
  timestamp: Date;
  user: string;
  sectionId: string;
  fieldId?: string;
  content: string;
  resolved: boolean;
}

export interface SoACell {
  visitId: string;
  assessmentId: string;
  required: boolean;
  notes?: string;
}

export interface Visit {
  id: string;
  label: string;
  order: number;
  timepoint?: string;
}

export interface Assessment {
  id: string;
  label: string;
  category: string;
  linkedSectionId?: string;
}

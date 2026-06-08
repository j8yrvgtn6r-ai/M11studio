import type { UsdmDocument } from './usdmTypes';

export interface UsdmExportContext {
  protocolTitle?: string;
  sponsorProtocolIdentifier?: string;
  trialPhase?: string;
  studyIdentifiers?: Array<{ text: string; scope?: string }>;
  knowledgeGraphSummary?: {
    entityCount: number;
    relationshipCount: number;
  };
  soaKnowledgeSummary?: {
    visitCount: number;
    assessmentCount: number;
    activityCount: number;
  };
  seed?: string;
}

export interface UsdmExportCounts {
  arms: number;
  epochs: number;
  elements: number;
  encounters: number;
  activities: number;
  procedures: number;
  scheduleInstances: number;
  timings: number;
  scheduleTimelines: number;
}

export type UsdmReadinessState = 'notReady' | 'readyWithWarnings' | 'ready';

export interface UsdmValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  path?: string;
  entityId?: string;
}

export interface UsdmValidationResult {
  errors: UsdmValidationIssue[];
  warnings: UsdmValidationIssue[];
  summary: {
    errorCount: number;
    warningCount: number;
    status: 'valid' | 'warnings' | 'errors';
  };
}

export interface UsdmExportReadiness {
  state: UsdmReadinessState;
  counts: UsdmExportCounts;
  errors: UsdmValidationIssue[];
  warnings: UsdmValidationIssue[];
  missingFields: string[];
  blockingErrors: string[];
  message: string;
}

export interface UsdmExportResult {
  document: UsdmDocument;
  validation: UsdmValidationResult;
  readiness: UsdmExportReadiness;
  exportedAt: string;
}

export interface UsdmReferenceSummary {
  arms: number;
  epochs: number;
  elements: number;
  encounters: number;
  activities: number;
  scheduleTimelines: number;
  timings: number;
  scheduledInstances: number;
  studyDesignCount: number;
  studyVersionCount: number;
}

import type { SoAAssessment, SoACondition, SoAFootnote, SoAScheduleRule, SoAVisit } from './soaKnowledgeTypes';

export type SoATableRole =
  | 'scheduleOfActivities'
  | 'assessmentSchedule'
  | 'visitSchedule'
  | 'laboratorySchedule'
  | 'safetySchedule'
  | 'unknown';

export type SoATableDiagnosticCode =
  | 'tableNarrativeConflict'
  | 'missingNarrativeSupport'
  | 'missingTableSupport'
  | 'duplicateAssessmentMerged'
  | 'duplicateVisitMerged'
  | 'ambiguousVisitColumn'
  | 'ambiguousMarker'
  | 'mergedCellUnavailable'
  | 'malformedTable'
  | 'noScheduleTables'
  | 'providerUnavailable';

export interface SoATableDiagnostic {
  code: SoATableDiagnosticCode;
  message: string;
  tableId?: string;
  rowIndex?: number;
  columnIndex?: number;
  sectionId?: string;
}

export interface SoATableCandidate {
  id: string;
  sourceSectionId?: string;
  caption?: string;
  headingContext: string[];
  rowCount: number;
  columnCount: number;
  tableRole: SoATableRole;
  confidenceReason: string;
  rawCells: string[][];
  normalizedCells: string[][];
}

export interface SoATableCellEvidence {
  tableId: string;
  rowIndex: number;
  columnIndex: number;
  sourceCellText: string;
  headingContext: string[];
  sourceSectionId?: string;
}

export interface SoATableExtractionResult {
  candidateTables: SoATableCandidate[];
  extractedVisits: SoAVisit[];
  extractedAssessments: SoAAssessment[];
  extractedScheduleRules: SoAScheduleRule[];
  extractedFootnotes: SoAFootnote[];
  extractedConditions: SoACondition[];
  diagnostics: SoATableDiagnostic[];
  warnings: string[];
  cellEvidence: SoATableCellEvidence[];
}

export interface SoAMatrixProposalCell {
  rowId: string;
  columnId: string;
  assessmentName: string;
  visitName: string;
  marker: string;
  required: boolean;
  conditionLabel?: string;
  inferenceSource: 'deterministic' | 'deterministic-table' | 'llm-inferred' | 'llm-reconciled' | 'user-accepted';
  evidence?: SoATableCellEvidence;
}

export interface SoAMatrixProposalPreview {
  rows: Array<{ id: string; label: string; inferenceSource: SoAMatrixProposalCell['inferenceSource'] }>;
  columns: Array<{ id: string; label: string; inferenceSource: SoAMatrixProposalCell['inferenceSource'] }>;
  cells: SoAMatrixProposalCell[];
}

export interface SoAProposalSourceSummary {
  narrativeDerivedCount: number;
  tableDerivedCount: number;
  llmInferredCount: number;
  conflictsCount: number;
  diagnosticsCount: number;
}

export interface SourceTableExtractionProvider {
  id: string;
  label: string;
  supportedFormats: string[];
  extract(input: unknown): Promise<SoATableExtractionResult>;
}

export interface DocxTableExtractionInput {
  uploadId: string;
  tables: import('../protocol/import/types').ExtractedTable[];
  document: import('../document-ingestion/canonicalDocumentTypes').CanonicalDocument;
}

export interface PdfTextTableExtractionInput {
  uploadId: string;
  text?: string;
}

export interface OcrTableExtractionInput {
  uploadId: string;
  imagePages?: number;
}

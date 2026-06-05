export type ProtocolSourceArtifactStatus =
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'extraction-failed';

export type GeneratedSectionReviewStatus =
  | 'pending-review'
  | 'approved'
  | 'changes-requested';

export type GeneratedSectionGenerationStatus = 'generated';

export type GeneratedSectionValidationStatus =
  | 'not-run'
  | 'passed'
  | 'warnings'
  | 'failed';

export type ExtractionStatus = 'real-docx-parsed' | 'failed';

export interface ProtocolSourceArtifact {
  id: string;
  filename: string;
  uploadedAt: string;
  fileSize: number;
  fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  sourceType: 'user-uploaded-protocol';
  status: ProtocolSourceArtifactStatus;
  storagePath: string;
  errorMessage?: string;
}

export interface ExtractedParagraph {
  id: string;
  index: number;
  text: string;
  styleName?: string;
  isHeadingStyle: boolean;
  headingLevel?: number;
}

export interface ExtractedHeading {
  id: string;
  index: number;
  text: string;
  level: number;
  styleName?: string;
  paragraphIndex: number;
  charStart: number;
}

export interface ExtractedTable {
  id: string;
  index: number;
  rows: string[][];
  text: string;
}

export interface SourceSectionCandidate {
  id: string;
  headingText: string;
  headingLevel?: number;
  startIndex: number;
  endIndex: number;
  text: string;
  confidence: number;
  detectedNumber?: string;
  possibleM11SectionId?: string;
  detectionMethod: 'heading-style' | 'numbering' | 'all-caps' | 'whole-document';
}

export interface ImportedProtocolSource {
  uploadId: string;
  filename: string;
  extractedAt: string;
  fullText: string;
  paragraphs: ExtractedParagraph[];
  headings: ExtractedHeading[];
  sections: SourceSectionCandidate[];
  tables: ExtractedTable[];
  extractionWarnings: string[];
}

/** Persisted without large fullText — load body from IndexedDB. */
export interface ImportedProtocolSourceSummary {
  uploadId: string;
  filename: string;
  extractedAt: string;
  paragraphCount: number;
  headingCount: number;
  sectionCandidateCount: number;
  tableCount: number;
  extractionWarnings: string[];
  fullTextLength: number;
}

export interface GeneratedSectionDraft {
  sectionId: string;
  title: string;
  generatedText: string;
  sourceUploadId: string;
  sourceExtractionId: string;
  matchedSourceCandidateIds: string[];
  extractionStatus: ExtractionStatus;
  generationStatus: GeneratedSectionGenerationStatus;
  reviewStatus: GeneratedSectionReviewStatus;
  generatedAt: string;
  lastReviewedAt?: string;
  reviewer?: string;
  validationStatus: GeneratedSectionValidationStatus;
  validationMessages: string[];
}

export interface ProtocolImportReviewSummary {
  totalGenerated: number;
  pendingReview: number;
  approved: number;
  changesRequested: number;
  validationWarnings: number;
  validationErrors: number;
}

export interface ProtocolImportState {
  artifact: ProtocolSourceArtifact | null;
  importedSourceSummary: ImportedProtocolSourceSummary | null;
  sectionDrafts: Record<string, GeneratedSectionDraft>;
  lastImportCompletedAt: string | null;
}

export type ImportProcessingStepId =
  | 'uploading'
  | 'reading-docx'
  | 'identifying-sections'
  | 'understanding-context'
  | 'rewriting-m11'
  | 'creating-review-tasks'
  | 'structure-checks'
  | 'preparing-workspace';

export type ImportProcessingStepState = 'pending' | 'active' | 'complete' | 'failed';

export interface ImportProcessingStep {
  id: ImportProcessingStepId;
  label: string;
  state: ImportProcessingStepState;
  detail?: string;
}

export interface DocxExtractionProgress {
  paragraphCount?: number;
  headingCount?: number;
  sectionCandidateCount?: number;
  warnings?: string[];
}

export type ProtocolSourceArtifactStatus =
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'failed';

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

export interface GeneratedSectionDraft {
  sectionId: string;
  title: string;
  generatedText: string;
  sourceUploadId: string;
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
}

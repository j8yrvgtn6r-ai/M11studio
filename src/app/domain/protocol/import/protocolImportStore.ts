import {
  loadImportedProtocolSource,
  loadProtocolSourceDocument,
  saveImportedProtocolSource,
} from './protocolImportStorage';
import { commitApprovedSectionToProtocol } from './protocolImportProcessor';
import { validateGeneratedSectionDraft } from './sectionDraftValidation';
import type {
  GeneratedSectionDraft,
  ImportedProtocolSource,
  ImportedProtocolSourceSummary,
  ProtocolImportReviewSummary,
  ProtocolImportState,
  ProtocolSourceArtifact,
} from './types';

const STORAGE_KEY = 'm11-protocol-import-v2';

const blobUrlCache = new Map<string, string>();
const extractionCache = new Map<string, ImportedProtocolSource>();
const listeners = new Set<() => void>();

let state: ProtocolImportState = {
  artifact: null,
  importedSourceSummary: null,
  sectionDrafts: {},
  lastImportCompletedAt: null,
};

let hydrated = false;

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function toSummary(source: ImportedProtocolSource): ImportedProtocolSourceSummary {
  return {
    uploadId: source.uploadId,
    filename: source.filename,
    extractedAt: source.extractedAt,
    paragraphCount: source.paragraphs.length,
    headingCount: source.headings.length,
    sectionCandidateCount: source.sections.length,
    tableCount: source.tables.length,
    extractionWarnings: source.extractionWarnings,
    fullTextLength: source.fullText.length,
  };
}

function persistMetadata(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      artifact: state.artifact,
      importedSourceSummary: state.importedSourceSummary,
      sectionDrafts: state.sectionDrafts,
      lastImportCompletedAt: state.lastImportCompletedAt,
    }),
  );
}

function loadPersistedMetadata(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('m11-protocol-import-v1');
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as ProtocolImportState;
    const sectionDrafts = parsed.sectionDrafts ?? {};
    const artifact = parsed.artifact ?? null;
    state = {
      artifact,
      importedSourceSummary: parsed.importedSourceSummary ?? null,
      sectionDrafts: Object.fromEntries(
        Object.entries(sectionDrafts).map(([key, draft]) => [
          key,
          {
            ...draft,
            sourceExtractionId: draft.sourceExtractionId ?? artifact?.id ?? '',
            matchedSourceCandidateIds: draft.matchedSourceCandidateIds ?? [],
            extractionStatus: draft.extractionStatus ?? 'real-docx-parsed',
          },
        ]),
      ),
      lastImportCompletedAt: parsed.lastImportCompletedAt ?? null,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export async function initProtocolImportStore(): Promise<void> {
  if (hydrated) {
    return;
  }
  loadPersistedMetadata();

  if (state.artifact?.id) {
    const stored = await loadProtocolSourceDocument(state.artifact.id);
    if (stored?.blob) {
      revokeBlobUrl(state.artifact.id);
      blobUrlCache.set(state.artifact.id, URL.createObjectURL(stored.blob));
    }
  }

  if (state.importedSourceSummary?.uploadId) {
    const extraction = await loadImportedProtocolSource(state.importedSourceSummary.uploadId);
    if (extraction) {
      extractionCache.set(extraction.uploadId, extraction);
    }
  }

  hydrated = true;
  notify();
}

export function subscribeProtocolImport(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProtocolImportState(): ProtocolImportState {
  return state;
}

export function getImportedProtocolSource(): ImportedProtocolSource | null {
  const uploadId = state.importedSourceSummary?.uploadId;
  if (!uploadId) {
    return null;
  }
  return extractionCache.get(uploadId) ?? null;
}

export function getProtocolImportReviewSummary(): ProtocolImportReviewSummary {
  const drafts = Object.values(state.sectionDrafts);
  return {
    totalGenerated: drafts.length,
    pendingReview: drafts.filter((draft) => draft.reviewStatus === 'pending-review').length,
    approved: drafts.filter((draft) => draft.reviewStatus === 'approved').length,
    changesRequested: drafts.filter((draft) => draft.reviewStatus === 'changes-requested').length,
    validationWarnings: drafts.filter((draft) => draft.validationStatus === 'warnings').length,
    validationErrors: drafts.filter((draft) => draft.validationStatus === 'failed').length,
  };
}

export function getSectionImportDraft(sectionId: string): GeneratedSectionDraft | undefined {
  return state.sectionDrafts[sectionId];
}

export function getProtocolSourceBlobUrl(artifactId: string): string | null {
  return blobUrlCache.get(artifactId) ?? null;
}

function revokeBlobUrl(artifactId: string): void {
  const existing = blobUrlCache.get(artifactId);
  if (existing) {
    URL.revokeObjectURL(existing);
    blobUrlCache.delete(artifactId);
  }
}

export function setProtocolImportArtifact(artifact: ProtocolSourceArtifact, blob?: Blob): void {
  if (artifact.id !== state.artifact?.id) {
    revokeBlobUrl(state.artifact?.id ?? '');
  }
  state.artifact = artifact;
  if (blob) {
    revokeBlobUrl(artifact.id);
    blobUrlCache.set(artifact.id, URL.createObjectURL(blob));
  }
  persistMetadata();
  notify();
}

export function setProtocolImportExtractionFailed(
  artifact: ProtocolSourceArtifact,
  errorMessage: string,
): void {
  state.artifact = {
    ...artifact,
    status: 'extraction-failed',
    errorMessage,
  };
  state.importedSourceSummary = null;
  state.sectionDrafts = {};
  persistMetadata();
  notify();
}

export async function setProtocolImportResult(
  drafts: GeneratedSectionDraft[],
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
): Promise<void> {
  extractionCache.set(importedSource.uploadId, importedSource);
  await saveImportedProtocolSource(importedSource);

  state.sectionDrafts = Object.fromEntries(drafts.map((draft) => [draft.sectionId, draft]));
  state.artifact = artifact;
  state.importedSourceSummary = toSummary(importedSource);
  state.lastImportCompletedAt = new Date().toISOString();
  persistMetadata();
  notify();
}

export function updateSectionImportDraft(
  sectionId: string,
  patch: Partial<GeneratedSectionDraft>,
): void {
  const current = state.sectionDrafts[sectionId];
  if (!current) {
    return;
  }
  state.sectionDrafts[sectionId] = { ...current, ...patch };
  persistMetadata();
  notify();
}

export function approveSectionImportDraft(sectionId: string, reviewer = 'Current user'): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft) {
    return;
  }

  const validation = validateGeneratedSectionDraft({
    ...draft,
    reviewStatus: 'approved',
  });

  const approvedDraft: GeneratedSectionDraft = {
    ...draft,
    reviewStatus: 'approved',
    reviewer,
    lastReviewedAt: new Date().toISOString(),
    validationStatus: validation.validationStatus,
    validationMessages: validation.messages,
  };

  state.sectionDrafts[sectionId] = approvedDraft;
  commitApprovedSectionToProtocol(approvedDraft);
  persistMetadata();
  notify();
}

export function requestChangesOnSectionImportDraft(sectionId: string, reviewer = 'Current user'): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft) {
    return;
  }
  state.sectionDrafts[sectionId] = {
    ...draft,
    reviewStatus: 'changes-requested',
    reviewer,
    lastReviewedAt: new Date().toISOString(),
    validationStatus: 'not-run',
    validationMessages: [],
  };
  persistMetadata();
  notify();
}

export function downloadProtocolSourceArtifact(): void {
  const artifact = state.artifact;
  const url = artifact ? blobUrlCache.get(artifact.id) : null;
  if (!artifact || !url) {
    throw new Error('Original protocol document is not available.');
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function openProtocolSourceArtifact(): void {
  const artifact = state.artifact;
  const url = artifact ? blobUrlCache.get(artifact.id) : null;
  if (!artifact || !url) {
    throw new Error('Original protocol document is not available.');
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** @deprecated Use setProtocolImportResult */
export function setProtocolImportDrafts(
  drafts: GeneratedSectionDraft[],
  artifact: ProtocolSourceArtifact,
): void {
  void setProtocolImportResult(drafts, artifact, {
    uploadId: artifact.id,
    filename: artifact.filename,
    extractedAt: new Date().toISOString(),
    fullText: '',
    paragraphs: [],
    headings: [],
    sections: [],
    tables: [],
    extractionWarnings: ['Legacy import metadata without extraction body.'],
  });
}

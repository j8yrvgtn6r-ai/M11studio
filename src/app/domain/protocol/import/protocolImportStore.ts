import { loadProtocolSourceDocument } from './protocolImportStorage';
import { commitApprovedSectionToProtocol } from './protocolImportProcessor';
import { validateGeneratedSectionDraft } from './sectionDraftValidation';
import type {
  GeneratedSectionDraft,
  ProtocolImportReviewSummary,
  ProtocolImportState,
  ProtocolSourceArtifact,
} from './types';

const STORAGE_KEY = 'm11-protocol-import-v1';

const blobUrlCache = new Map<string, string>();
const listeners = new Set<() => void>();

let state: ProtocolImportState = {
  artifact: null,
  sectionDrafts: {},
  lastImportCompletedAt: null,
};

let hydrated = false;

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function persistMetadata(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      artifact: state.artifact,
      sectionDrafts: state.sectionDrafts,
      lastImportCompletedAt: state.lastImportCompletedAt,
    }),
  );
}

function loadPersistedMetadata(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as ProtocolImportState;
    state = {
      artifact: parsed.artifact ?? null,
      sectionDrafts: parsed.sectionDrafts ?? {},
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

export function setProtocolImportDrafts(
  drafts: GeneratedSectionDraft[],
  artifact: ProtocolSourceArtifact,
): void {
  state.sectionDrafts = Object.fromEntries(drafts.map((draft) => [draft.sectionId, draft]));
  state.artifact = artifact;
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

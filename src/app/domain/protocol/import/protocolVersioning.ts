import { getProtocolSnapshot } from '../store/protocolStore';
import type { GeneratedSectionDraft, ProtocolCommit, ProtocolVersion } from './types';

const VERSIONING_STORAGE_KEY = 'm11-protocol-versioning-v1';
const APP_SCHEMA_VERSION = '1.0.0';

export interface ProtocolVersioningState {
  protocolId: string;
  currentVersion: ProtocolVersion;
  commits: ProtocolCommit[];
}

function hashSnapshot(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < serialized.length; i += 1) {
    hash = (hash << 5) - hash + serialized.charCodeAt(i);
    hash |= 0;
  }
  return `snap-${Math.abs(hash).toString(16)}`;
}

function createCommitId(): string {
  return `commit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createVersionId(): string {
  return `version-${Date.now()}`;
}

function loadVersioningState(protocolId: string): ProtocolVersioningState {
  if (typeof localStorage === 'undefined') {
    return createEmptyVersioningState(protocolId);
  }
  const raw = localStorage.getItem(VERSIONING_STORAGE_KEY);
  if (!raw) {
    return createEmptyVersioningState(protocolId);
  }
  try {
    const parsed = JSON.parse(raw) as ProtocolVersioningState;
    if (parsed.protocolId !== protocolId) {
      return createEmptyVersioningState(protocolId);
    }
    if (!parsed.currentVersion?.id || !Array.isArray(parsed.commits)) {
      return createEmptyVersioningState(protocolId);
    }
    return {
      protocolId: parsed.protocolId,
      currentVersion: parsed.currentVersion,
      commits: parsed.commits.map((commit) => ({
        ...commit,
        changedSectionIds: commit.changedSectionIds ?? [],
        metadata: commit.metadata ?? {},
      })),
    };
  } catch {
    localStorage.removeItem(VERSIONING_STORAGE_KEY);
    return createEmptyVersioningState(protocolId);
  }
}

function createEmptyVersioningState(protocolId: string): ProtocolVersioningState {
  const versionId = createVersionId();
  const headCommitId = createCommitId();
  const now = new Date().toISOString();
  const initialCommit: ProtocolCommit = {
    id: headCommitId,
    protocolId,
    message: 'Initial protocol workspace',
    createdAt: now,
    createdBy: 'local-user',
    snapshotHash: hashSnapshot({ protocolId, seed: true }),
    source: 'manualEdit',
    changedSectionIds: [],
    validationSummary: 'Workspace initialized',
    metadata: { appSchemaVersion: APP_SCHEMA_VERSION },
  };
  return {
    protocolId,
    currentVersion: {
      id: versionId,
      label: 'v0.1-draft',
      lifecycleStatus: 'draft',
      headCommitId,
      createdAt: now,
      createdBy: 'local-user',
    },
    commits: [initialCommit],
  };
}

function persistVersioningState(state: ProtocolVersioningState): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(VERSIONING_STORAGE_KEY, JSON.stringify(state));
}

export function getProtocolVersioningState(protocolId: string): ProtocolVersioningState {
  return loadVersioningState(protocolId);
}

export function getProtocolCommits(protocolId: string): ProtocolCommit[] {
  return loadVersioningState(protocolId).commits;
}

export function getCurrentProtocolVersion(protocolId: string): ProtocolVersion {
  return loadVersioningState(protocolId).currentVersion;
}

function appendCommit(
  protocolId: string,
  commit: Omit<ProtocolCommit, 'id' | 'protocolId' | 'createdAt' | 'snapshotHash'> & {
    parentCommitId?: string;
    changedSectionIds: string[];
  },
): ProtocolCommit {
  const state = loadVersioningState(protocolId);
  const parentCommitId = commit.parentCommitId ?? state.currentVersion.headCommitId;
  const record: ProtocolCommit = {
    id: createCommitId(),
    protocolId,
    parentCommitId,
    message: commit.message,
    createdAt: new Date().toISOString(),
    createdBy: commit.createdBy ?? 'local-user',
    snapshotHash: hashSnapshot(getProtocolSnapshot()),
    source: commit.source,
    changedSectionIds: commit.changedSectionIds,
    validationSummary: commit.validationSummary,
    metadata: { ...commit.metadata, appSchemaVersion: APP_SCHEMA_VERSION },
  };

  state.commits.unshift(record);
  state.currentVersion = {
    ...state.currentVersion,
    headCommitId: record.id,
    createdAt: record.createdAt,
  };
  persistVersioningState(state);
  return record;
}

export function createImportProcessingCommit(protocolId: string, uploadFilename: string): ProtocolCommit {
  return appendCommit(protocolId, {
    parentCommitId: getCurrentProtocolVersion(protocolId).headCommitId,
    message: `Import processed: ${uploadFilename}`,
    createdBy: 'local-user',
    source: 'importRewrite',
    changedSectionIds: [],
    validationSummary: 'Import extraction completed; human review required.',
    metadata: { uploadFilename },
  });
}

export function createProtocolUnderstandingCommit(
  protocolId: string,
  metadata: Record<string, unknown>,
): ProtocolCommit {
  return appendCommit(protocolId, {
    message: 'Protocol understanding completed',
    createdBy: 'local-user',
    source: 'protocolUnderstanding',
    changedSectionIds: [],
    validationSummary: 'Global protocol knowledge model built from uploaded study document.',
    metadata,
  });
}

export function createM11GenerationCommit(
  protocolId: string,
  sectionIds: string[],
  metadata: Record<string, unknown>,
): ProtocolCommit {
  return appendCommit(protocolId, {
    message: `M11 generation completed (${sectionIds.length} sections)`,
    createdBy: 'local-user',
    source: 'm11Generation',
    changedSectionIds: sectionIds,
    validationSummary: 'M11 section proposals generated; awaiting human review.',
    metadata,
  });
}

export function createSectionRegeneratedCommit(
  protocolId: string,
  sectionId: string,
  metadata: Record<string, unknown>,
): ProtocolCommit {
  return appendCommit(protocolId, {
    message: `Regenerated section ${sectionId}`,
    createdBy: 'local-user',
    source: 'sectionRegeneration',
    changedSectionIds: [sectionId],
    validationSummary: 'Prior draft superseded by regenerated proposal.',
    metadata,
  });
}

export function createImportOverwriteCommit(protocolId: string, uploadFilename: string): ProtocolCommit {
  return appendCommit(protocolId, {
    message: `Import overwrote generated content: ${uploadFilename}`,
    createdBy: 'local-user',
    source: 'importRewrite',
    changedSectionIds: [],
    validationSummary: 'Prior import drafts superseded by new upload.',
    metadata: { uploadFilename, overwrite: true },
  });
}

export function createSectionApprovalCommit(
  protocolId: string,
  draft: GeneratedSectionDraft,
  validationSummary: string,
): ProtocolCommit {
  return appendCommit(protocolId, {
    message: `Approved section ${draft.sectionId}: ${draft.title}`,
    createdBy: draft.stateChangedBy ?? 'local-user',
    source: 'sectionApproval',
    changedSectionIds: [draft.sectionId],
    validationSummary,
    metadata: {
      sectionId: draft.sectionId,
      draftVersion: draft.draftVersion,
      validationStatus: draft.validationStatus,
    },
  });
}

export interface CommitComparisonPlaceholder {
  commitAId: string;
  commitBId: string;
  changedSectionIds: string[];
  note: string;
}

/** Scaffold — full diff viewer not implemented. */
export function compareProtocolCommits(
  protocolId: string,
  commitAId: string,
  commitBId: string,
): CommitComparisonPlaceholder {
  const commits = getProtocolCommits(protocolId);
  const commitA = commits.find((commit) => commit.id === commitAId);
  const commitB = commits.find((commit) => commit.id === commitBId);
  const changedSectionIds = [
    ...new Set([...(commitA?.changedSectionIds ?? []), ...(commitB?.changedSectionIds ?? [])]),
  ];
  return {
    commitAId,
    commitBId,
    changedSectionIds,
    note: 'Commit comparison scaffold only. Side-by-side diff is planned for hosted versioning.',
  };
}

export interface VersionComparisonPlaceholder {
  versionAId: string;
  versionBId: string;
  note: string;
}

/** Scaffold — version-level comparison not implemented. */
export function compareProtocolVersions(versionAId: string, versionBId: string): VersionComparisonPlaceholder {
  return {
    versionAId,
    versionBId,
    note: 'Version comparison scaffold only. Use commit history until hosted versioning ships.',
  };
}

export { APP_SCHEMA_VERSION };

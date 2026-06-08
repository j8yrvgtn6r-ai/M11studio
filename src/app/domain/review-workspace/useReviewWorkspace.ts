import { useSyncExternalStore } from 'react';

import { subscribe } from '../protocol/store/protocolStore';
import { subscribeProtocolImport } from '../protocol/import/protocolImportStore';
import { subscribeLintIssues } from '../protocol/authoring/linting/protocolLintStore';
import { subscribeSoAProposal } from '../soa-knowledge/soaProposalStore';
import { subscribeSoAEnrichmentProposal } from '../soa-knowledge/soaEnrichmentStore';
import { subscribeSoANarrativeSync } from '../soa-knowledge/soaNarrativeSyncStore';
import { subscribeStudyDesign } from '../study-design/StudyDesignStore';
import { subscribeStudyDesignProposals } from '../study-design/studyDesignProposalStore';
import { subscribeUsdmExport } from '../usdm/usdmExportStore';
import type { ReviewItem, ReviewWorkspaceSummary } from './ReviewItemTypes';
import {
  aggregateReviewItems,
  getReviewWorkspaceSummary,
  subscribeReviewWorkspace,
} from './index';

function subscribeAllReviewSources(onStoreChange: () => void): () => void {
  const unsubs = [
    subscribeReviewWorkspace(onStoreChange),
    subscribe(onStoreChange),
    subscribeProtocolImport(onStoreChange),
    subscribeLintIssues(onStoreChange),
    subscribeSoAProposal(onStoreChange),
    subscribeSoAEnrichmentProposal(onStoreChange),
    subscribeSoANarrativeSync(onStoreChange),
    subscribeStudyDesign(onStoreChange),
    subscribeStudyDesignProposals(onStoreChange),
    subscribeUsdmExport(onStoreChange),
  ];
  return () => unsubs.forEach((unsub) => unsub());
}

function reviewItemsFingerprint(items: ReviewItem[]): string {
  return items.map((item) => `${item.provenanceKey}:${item.status}:${item.severity}`).join('|');
}

function reviewSummaryFingerprint(summary: ReviewWorkspaceSummary): string {
  return [
    summary.open,
    summary.accepted,
    summary.rejected,
    summary.deferred,
    summary.errors,
    summary.warnings,
    summary.info,
    summary.usdmReadiness,
    summary.studyDesignHealth,
    summary.soaStatus,
    summary.narrativeSyncStatus,
  ].join(':');
}

let cachedSnapshotKey = '';
let cachedSnapshot: { items: ReviewItem[]; summary: ReviewWorkspaceSummary } | null = null;

function getReviewWorkspaceSnapshot(): { items: ReviewItem[]; summary: ReviewWorkspaceSummary } {
  const items = aggregateReviewItems();
  const summary = getReviewWorkspaceSummary(items);
  const key = `${reviewItemsFingerprint(items)}::${reviewSummaryFingerprint(summary)}`;
  if (key === cachedSnapshotKey && cachedSnapshot) {
    return cachedSnapshot;
  }
  cachedSnapshotKey = key;
  cachedSnapshot = { items, summary };
  return cachedSnapshot;
}

let cachedSummaryKey = '';
let cachedSummary: ReviewWorkspaceSummary | null = null;

function getReviewWorkspaceSummarySnapshot(): ReviewWorkspaceSummary {
  const snapshot = getReviewWorkspaceSnapshot();
  const key = reviewSummaryFingerprint(snapshot.summary);
  if (key === cachedSummaryKey && cachedSummary) {
    return cachedSummary;
  }
  cachedSummaryKey = key;
  cachedSummary = snapshot.summary;
  return cachedSummary;
}

export function useReviewWorkspaceSnapshot() {
  return useSyncExternalStore(
    subscribeAllReviewSources,
    getReviewWorkspaceSnapshot,
    () => ({ items: [], summary: getReviewWorkspaceSummary([]) }),
  );
}

export function useReviewWorkspaceQueueCounts() {
  return useSyncExternalStore(
    subscribeAllReviewSources,
    getReviewWorkspaceSummarySnapshot,
    () => getReviewWorkspaceSummary([]),
  );
}

export function resetReviewWorkspaceSnapshotCacheForTests(): void {
  cachedSnapshotKey = '';
  cachedSnapshot = null;
  cachedSummaryKey = '';
  cachedSummary = null;
}

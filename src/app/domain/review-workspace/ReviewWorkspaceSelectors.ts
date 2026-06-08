import type { ReviewItem, ReviewWorkspaceSummary } from './ReviewItemTypes';
import { aggregateReviewItems, getReviewWorkspaceDerivedSummary } from './ReviewWorkspaceAggregation';

export function getReviewWorkspaceItems(): ReviewItem[] {
  return aggregateReviewItems();
}

export function getReviewWorkspaceSummary(items: ReviewItem[] = getReviewWorkspaceItems()): ReviewWorkspaceSummary {
  const derived = getReviewWorkspaceDerivedSummary();
  const openItems = items.filter((item) => item.status === 'open');

  return {
    open: items.filter((item) => item.status === 'open').length,
    accepted: items.filter((item) => item.status === 'accepted').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    deferred: items.filter((item) => item.status === 'deferred').length,
    errors: openItems.filter((item) => item.severity === 'error').length,
    warnings: openItems.filter((item) => item.severity === 'warning').length,
    info: openItems.filter((item) => item.severity === 'info').length,
    usdmReadiness: derived.usdmReadiness,
    studyDesignHealth: derived.studyDesignHealth,
    soaStatus: derived.soaStatus,
    narrativeSyncStatus: derived.narrativeSyncStatus,
  };
}

export function getReviewWorkspaceQueueCounts(items: ReviewItem[] = getReviewWorkspaceItems()): {
  openErrors: number;
  openWarnings: number;
  openInfo: number;
  totalOpen: number;
} {
  const summary = getReviewWorkspaceSummary(items);
  return {
    openErrors: summary.errors,
    openWarnings: summary.warnings,
    openInfo: summary.info,
    totalOpen: summary.open,
  };
}

import { acceptCurrentSoAEnrichmentProposal, rejectCurrentSoAEnrichmentProposal } from '../../agents/soaAgentEnrichmentRunner';
import { acceptCurrentSoAProposal, rejectCurrentSoAProposal } from '../../agents/soaAgentRunner';
import {
  acceptSoANarrativeSyncProposal,
  rejectSoANarrativeSyncProposal,
} from '../soa-knowledge/soaNarrativeSyncStore';
import {
  acceptStudyDesignSyncProposal,
  getCurrentStudyDesignSyncProposal,
} from '../study-design';
import type { ReviewItem, ReviewWorkspaceNavigationContext } from './ReviewItemTypes';
import { aggregateReviewItems } from './ReviewWorkspaceAggregation';
import type { ReviewWorkspaceFiltersState } from './ReviewItemTypes';
import { DEFAULT_REVIEW_WORKSPACE_FILTERS, filterReviewItems } from './ReviewWorkspaceFilters';
import { clearResolvedReviewItems, setReviewItemStatus } from './ReviewWorkspaceStore';

function recordStatus(item: ReviewItem, status: ReviewItem['status']): void {
  setReviewItemStatus({
    itemId: item.id,
    provenanceKey: item.provenanceKey,
    source: item.source,
    status,
  });
}

export function acceptReviewItem(item: ReviewItem): { success: boolean; message?: string } {
  if (item.severity === 'error' && item.source === 'validation') {
    // Allow status-only accept for acknowledged errors without bulk accept
  }

  try {
    if (item.source === 'studyDesign' && item.metadata?.proposalKind === 'sync') {
      const proposal = getCurrentStudyDesignSyncProposal();
      if (proposal) {
        acceptStudyDesignSyncProposal(proposal);
      }
    } else if (item.source === 'soa') {
      acceptCurrentSoAProposal();
    } else if (item.source === 'soaEnrichment') {
      acceptCurrentSoAEnrichmentProposal();
    } else if (item.source === 'narrativeSync' && item.metadata?.impactedSectionIds) {
      acceptSoANarrativeSyncProposal();
    } else if (item.source === 'narrativeSync' && item.title.startsWith('SoA narrative')) {
      acceptSoANarrativeSyncProposal();
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  recordStatus(item, 'accepted');
  return { success: true };
}

export function rejectReviewItem(item: ReviewItem): { success: boolean; message?: string } {
  try {
    if (item.source === 'soa') {
      rejectCurrentSoAProposal();
    } else if (item.source === 'soaEnrichment') {
      rejectCurrentSoAEnrichmentProposal();
    } else if (item.source === 'narrativeSync' && item.title.startsWith('SoA narrative')) {
      rejectSoANarrativeSyncProposal();
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  recordStatus(item, 'rejected');
  return { success: true };
}

export function deferReviewItem(item: ReviewItem): void {
  recordStatus(item, 'deferred');
}

export function openReviewItemContext(
  item: ReviewItem,
  navigation: ReviewWorkspaceNavigationContext = {},
): void {
  switch (item.source) {
    case 'validation':
    case 'consistency':
    case 'narrativeSync':
      if (item.sectionId) {
        navigation.onNavigateSection?.(item.sectionId);
      }
      break;
    case 'lint':
      if (item.sectionId) {
        navigation.onNavigateLint?.(
          item.sectionId,
          item.metadata?.lineNumber as number | undefined,
          item.metadata?.startOffset as number | undefined,
        );
      }
      break;
    case 'studyDesign':
      navigation.onOpenStudyDesign?.(
        item.metadata?.entityKind as string | undefined,
        item.relatedEntityIds?.[0],
      );
      break;
    case 'soa':
    case 'soaEnrichment':
      navigation.onOpenSoAConfiguration?.();
      break;
    case 'usdm':
      navigation.onOpenUsdmExport?.();
      break;
    default:
      if (item.sectionId) {
        navigation.onNavigateSection?.(item.sectionId);
      }
  }
}

export function bulkAcceptReviewWarnings(): number {
  const items = filterReviewItems(aggregateReviewItems(), {
    ...DEFAULT_REVIEW_WORKSPACE_FILTERS,
    severities: ['warning'],
    statuses: ['open'],
  });
  let count = 0;
  for (const entry of items) {
    acceptReviewItem(entry);
    count += 1;
  }
  return count;
}

export function bulkAcceptReviewInfo(): number {
  const items = filterReviewItems(aggregateReviewItems(), {
    ...DEFAULT_REVIEW_WORKSPACE_FILTERS,
    severities: ['info'],
    statuses: ['open'],
  });
  let count = 0;
  for (const entry of items) {
    acceptReviewItem(entry);
    count += 1;
  }
  return count;
}

export function bulkDeferReviewItems(): number {
  const items = filterReviewItems(aggregateReviewItems(), {
    ...DEFAULT_REVIEW_WORKSPACE_FILTERS,
    statuses: ['open'],
  });
  let count = 0;
  for (const entry of items) {
    deferReviewItem(entry);
    count += 1;
  }
  return count;
}

export function clearResolvedReviewWorkspaceItems(): number {
  return clearResolvedReviewItems();
}

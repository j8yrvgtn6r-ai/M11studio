import type { ReviewItem, ReviewWorkspaceFiltersState } from './ReviewItemTypes';

export const DEFAULT_REVIEW_WORKSPACE_FILTERS: ReviewWorkspaceFiltersState = {
  sources: [],
  severities: [],
  statuses: ['open'],
  sectionId: undefined,
  entityId: undefined,
  searchText: '',
};

export function filterReviewItems(
  items: ReviewItem[],
  filters: ReviewWorkspaceFiltersState = DEFAULT_REVIEW_WORKSPACE_FILTERS,
): ReviewItem[] {
  const search = filters.searchText?.trim().toLowerCase() ?? '';

  return items.filter((entry) => {
    if (filters.sources.length > 0 && !filters.sources.includes(entry.source)) {
      return false;
    }
    if (filters.severities.length > 0 && !filters.severities.includes(entry.severity)) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(entry.status)) {
      return false;
    }
    if (filters.sectionId && entry.sectionId !== filters.sectionId) {
      return false;
    }
    if (filters.entityId && !(entry.relatedEntityIds ?? []).includes(filters.entityId)) {
      return false;
    }
    if (search) {
      const haystack = `${entry.title} ${entry.description} ${entry.source} ${entry.sectionId ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

export function listReviewFilterSections(items: ReviewItem[]): string[] {
  return [...new Set(items.map((item) => item.sectionId).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

export function listReviewFilterEntities(items: ReviewItem[]): string[] {
  return [
    ...new Set(items.flatMap((item) => item.relatedEntityIds ?? [])),
  ].sort();
}

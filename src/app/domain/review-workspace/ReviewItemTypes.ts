export type ReviewItemSource =
  | 'validation'
  | 'lint'
  | 'studyDesign'
  | 'narrativeSync'
  | 'soa'
  | 'soaEnrichment'
  | 'consistency'
  | 'usdm';

export type ReviewItemSeverity = 'info' | 'warning' | 'error';

export type ReviewItemStatus = 'open' | 'accepted' | 'rejected' | 'deferred';

export type ReviewItemActionKind = 'accept' | 'reject' | 'defer' | 'openContext';

export interface ReviewItem {
  id: string;
  /** Stable key for workspace status overrides — `${source}:${originId}` */
  provenanceKey: string;
  source: ReviewItemSource;
  severity: ReviewItemSeverity;
  status: ReviewItemStatus;
  title: string;
  description: string;
  sectionId?: string;
  relatedEntityIds?: string[];
  createdAt: string;
  actions: ReviewItemActionKind[];
  metadata?: Record<string, unknown>;
}

export interface ReviewActionRecord {
  itemId: string;
  provenanceKey: string;
  source: ReviewItemSource;
  userAction: Exclude<ReviewItemStatus, 'open'>;
  timestamp: string;
}

export interface ReviewWorkspaceSummary {
  open: number;
  accepted: number;
  rejected: number;
  deferred: number;
  errors: number;
  warnings: number;
  info: number;
  usdmReadiness: string;
  studyDesignHealth: string;
  soaStatus: string;
  narrativeSyncStatus: string;
}

export interface ReviewWorkspaceFiltersState {
  sources: ReviewItemSource[];
  severities: ReviewItemSeverity[];
  statuses: ReviewItemStatus[];
  sectionId?: string;
  entityId?: string;
  searchText?: string;
}

export interface ReviewWorkspaceNavigationContext {
  onNavigateSection?: (sectionId: string) => void;
  onNavigateLint?: (sectionId: string, lineNumber?: number, startOffset?: number) => void;
  onOpenSoAConfiguration?: () => void;
  onOpenUsdmExport?: () => void;
  onOpenStudyDesign?: (entityKind?: string, entityId?: string) => void;
}

export const REVIEW_ITEM_SOURCE_LABELS: Record<ReviewItemSource, string> = {
  validation: 'Validation',
  lint: 'Lint',
  studyDesign: 'Study Design',
  narrativeSync: 'Narrative Sync',
  soa: 'SoA',
  soaEnrichment: 'SoA Enrichment',
  consistency: 'Consistency',
  usdm: 'USDM',
};

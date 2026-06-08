import type { ReviewItemSource } from '../../domain/review-workspace/ReviewItemTypes';
import { REVIEW_ITEM_SOURCE_LABELS } from '../../domain/review-workspace/ReviewItemTypes';
import { Button } from '../ui/button';

interface ReviewWorkspaceSidebarProps {
  activeSource: ReviewItemSource | 'all';
  sourceCounts: Record<ReviewItemSource | 'all', number>;
  onSelectSource: (source: ReviewItemSource | 'all') => void;
}

const SIDEBAR_SOURCES: Array<ReviewItemSource | 'all'> = [
  'all',
  'validation',
  'lint',
  'studyDesign',
  'narrativeSync',
  'soa',
  'soaEnrichment',
  'consistency',
  'usdm',
];

export function ReviewWorkspaceSidebar({
  activeSource,
  sourceCounts,
  onSelectSource,
}: ReviewWorkspaceSidebarProps) {
  return (
    <aside className="w-52 border-r border-border bg-muted/10 shrink-0 p-2 space-y-1" data-testid="review-workspace-sidebar">
      <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Sources</p>
      {SIDEBAR_SOURCES.map((source) => (
        <Button
          key={source}
          variant={activeSource === source ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-between h-8 text-xs"
          onClick={() => onSelectSource(source)}
        >
          <span>{source === 'all' ? 'All findings' : REVIEW_ITEM_SOURCE_LABELS[source]}</span>
          <span className="text-muted-foreground">{sourceCounts[source] ?? 0}</span>
        </Button>
      ))}
    </aside>
  );
}

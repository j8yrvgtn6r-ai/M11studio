import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';

import {
  DEFAULT_REVIEW_WORKSPACE_FILTERS,
  filterReviewItems,
  getReviewActionHistory,
  listReviewFilterSections,
  type ReviewItemSource,
  type ReviewWorkspaceNavigationContext,
} from '../../domain/review-workspace';
import { useReviewWorkspaceSnapshot } from '../../domain/review-workspace/useReviewWorkspace';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { ReviewWorkspaceBulkActions } from './ReviewWorkspaceBulkActions';
import { ReviewWorkspaceFiltersPanel } from './ReviewWorkspaceFilters';
import { ReviewWorkspaceItemCard } from './ReviewWorkspaceItemCard';
import { ReviewWorkspaceSidebar } from './ReviewWorkspaceSidebar';
import { ReviewWorkspaceSummaryBar } from './ReviewWorkspaceSummaryBar';

interface ProtocolReviewWorkspaceProps {
  onBack: () => void;
  navigation: ReviewWorkspaceNavigationContext;
}

export function ProtocolReviewWorkspace({ onBack, navigation }: ProtocolReviewWorkspaceProps) {
  const { items, summary } = useReviewWorkspaceSnapshot();
  const [sidebarSource, setSidebarSource] = useState<ReviewItemSource | 'all'>('all');
  const [filters, setFilters] = useState(DEFAULT_REVIEW_WORKSPACE_FILTERS);
  const history = getReviewActionHistory();

  const sourceCounts = useMemo(() => {
    const openItems = items.filter((item) => item.status === 'open');
    const counts: Record<ReviewItemSource | 'all', number> = {
      all: openItems.length,
      validation: 0,
      lint: 0,
      studyDesign: 0,
      narrativeSync: 0,
      soa: 0,
      soaEnrichment: 0,
      consistency: 0,
      usdm: 0,
    };
    for (const item of openItems) {
      counts[item.source] += 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const base = filterReviewItems(items, filters);
    if (sidebarSource === 'all') return base;
    return base.filter((item) => item.source === sidebarSource);
  }, [items, filters, sidebarSource]);

  const sections = useMemo(() => listReviewFilterSections(items), [items]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background" data-testid="protocol-review-workspace">
      <header className="px-4 py-3 border-b border-border bg-card shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" className="h-8" onClick={onBack} data-testid="review-workspace-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <ClipboardList className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">Protocol Review Workspace</h2>
            <p className="text-[11px] text-muted-foreground truncate">
              Centralized findings, proposals, and governance actions
            </p>
          </div>
        </div>
      </header>

      <ReviewWorkspaceSummaryBar summary={summary} />
      <ReviewWorkspaceBulkActions openErrorCount={summary.errors} />

      <div className="flex flex-1 min-h-0">
        <ReviewWorkspaceSidebar
          activeSource={sidebarSource}
          sourceCounts={sourceCounts}
          onSelectSource={setSidebarSource}
        />

        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <ReviewWorkspaceFiltersPanel filters={filters} sections={sections} onChange={setFilters} />
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="review-workspace-empty">
                  No review items match the current filters.
                </p>
              ) : (
                filteredItems.map((item) => (
                  <ReviewWorkspaceItemCard key={item.id} item={item} navigation={navigation} />
                ))
              )}

              {history.length > 0 ? (
                <div className="pt-4 border-t border-border space-y-2" data-testid="review-workspace-history">
                  <p className="text-xs font-medium">Governance history</p>
                  {history.slice(-8).reverse().map((record) => (
                    <p key={`${record.timestamp}-${record.itemId}`} className="text-[10px] text-muted-foreground">
                      {record.userAction} · {record.source} · {new Date(record.timestamp).toLocaleString()}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

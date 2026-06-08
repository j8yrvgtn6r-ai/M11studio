import type { ReviewWorkspaceSummary } from '../../domain/review-workspace/ReviewItemTypes';
import { Badge } from '../ui/badge';

interface ReviewWorkspaceSummaryBarProps {
  summary: ReviewWorkspaceSummary;
}

export function ReviewWorkspaceSummaryBar({ summary }: ReviewWorkspaceSummaryBarProps) {
  return (
    <div className="px-4 py-3 border-b border-border bg-card shrink-0 space-y-2" data-testid="review-workspace-summary-bar">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Badge variant="outline">Open {summary.open}</Badge>
        <Badge variant="secondary">Accepted {summary.accepted}</Badge>
        <Badge variant="outline">Rejected {summary.rejected}</Badge>
        <Badge variant="outline">Deferred {summary.deferred}</Badge>
        <Badge variant="destructive">Errors {summary.errors}</Badge>
        <Badge variant="outline" className="text-amber-700 dark:text-amber-300">
          Warnings {summary.warnings}
        </Badge>
        <Badge variant="outline">Info {summary.info}</Badge>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
        <div>USDM: {summary.usdmReadiness}</div>
        <div>Study Design: {summary.studyDesignHealth}</div>
        <div>SoA: {summary.soaStatus}</div>
        <div>Narrative Sync: {summary.narrativeSyncStatus}</div>
      </div>
    </div>
  );
}

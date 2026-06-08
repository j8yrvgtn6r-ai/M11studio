import {
  bulkAcceptReviewInfo,
  bulkAcceptReviewWarnings,
  bulkDeferReviewItems,
  clearResolvedReviewWorkspaceItems,
} from '../../domain/review-workspace';
import { Button } from '../ui/button';

interface ReviewWorkspaceBulkActionsProps {
  openErrorCount: number;
}

export function ReviewWorkspaceBulkActions({ openErrorCount }: ReviewWorkspaceBulkActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-border bg-muted/10" data-testid="review-workspace-bulk-actions">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[10px]"
        onClick={() => bulkAcceptReviewWarnings()}
        data-testid="review-bulk-accept-warnings"
      >
        Accept All Warnings
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[10px]"
        onClick={() => bulkAcceptReviewInfo()}
        data-testid="review-bulk-accept-info"
      >
        Accept All Info
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[10px]"
        onClick={() => bulkDeferReviewItems()}
        data-testid="review-bulk-defer-all"
      >
        Defer All Open
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[10px]"
        onClick={() => clearResolvedReviewWorkspaceItems()}
        data-testid="review-bulk-clear-resolved"
      >
        Clear Resolved
      </Button>
      {openErrorCount > 0 ? (
        <span className="text-[10px] text-muted-foreground self-center">
          Errors must be resolved individually — bulk accept is disabled for errors.
        </span>
      ) : null}
    </div>
  );
}

import { ExternalLink } from 'lucide-react';

import {
  REVIEW_ITEM_SOURCE_LABELS,
  type ReviewItem,
  type ReviewWorkspaceNavigationContext,
} from '../../domain/review-workspace/ReviewItemTypes';
import {
  acceptReviewItem,
  deferReviewItem,
  openReviewItemContext,
  rejectReviewItem,
} from '../../domain/review-workspace';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

function severityVariant(severity: ReviewItem['severity']) {
  if (severity === 'error') return 'destructive' as const;
  if (severity === 'warning') return 'outline' as const;
  return 'secondary' as const;
}

function statusVariant(status: ReviewItem['status']) {
  if (status === 'accepted') return 'secondary' as const;
  if (status === 'rejected') return 'destructive' as const;
  if (status === 'deferred') return 'outline' as const;
  return 'outline' as const;
}

interface ReviewWorkspaceItemCardProps {
  item: ReviewItem;
  navigation: ReviewWorkspaceNavigationContext;
}

export function ReviewWorkspaceItemCard({ item, navigation }: ReviewWorkspaceItemCardProps) {
  const created = new Date(item.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? item.createdAt
    : created.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Card className="border-border/70" data-testid={`review-item-${item.id}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={severityVariant(item.severity)} className="text-[10px]">
                {item.severity}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {REVIEW_ITEM_SOURCE_LABELS[item.source]}
              </Badge>
              <Badge variant={statusVariant(item.status)} className="text-[10px]">
                {item.status}
              </Badge>
            </div>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {item.sectionId ? <span>Section {item.sectionId}</span> : null}
          {item.relatedEntityIds?.length ? <span>Entities: {item.relatedEntityIds.join(', ')}</span> : null}
          <span>{createdLabel}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() => openReviewItemContext(item, navigation)}
            data-testid={`review-open-context-${item.id}`}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open Context
          </Button>
          {item.status === 'open' ? (
            <>
              <Button
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => acceptReviewItem(item)}
                data-testid={`review-accept-${item.id}`}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={() => rejectReviewItem(item)}
                data-testid={`review-reject-${item.id}`}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px]"
                onClick={() => deferReviewItem(item)}
                data-testid={`review-defer-${item.id}`}
              >
                Defer
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

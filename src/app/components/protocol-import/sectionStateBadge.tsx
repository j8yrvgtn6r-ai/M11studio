import type { SectionReviewState } from '../../domain/protocol/import';
import { Badge } from '../ui/badge';

export function sectionStateLabel(state: SectionReviewState): string {
  const labels: Record<SectionReviewState, string> = {
    generated: 'Generated',
    pendingReview: 'Pending review',
    inReview: 'In review',
    changesRequested: 'Changes requested',
    approved: 'Approved',
    validationPending: 'Validation pending',
    validationPassed: 'Validation passed',
    validationFailed: 'Validation failed',
    superseded: 'Superseded',
  };
  return labels[state] ?? state;
}

export function SectionStateBadge({ state }: { state: SectionReviewState }) {
  const variant =
    state === 'validationPassed'
      ? 'default'
      : state === 'validationFailed'
        ? 'destructive'
        : state === 'changesRequested'
          ? 'outline'
          : 'secondary';

  return (
    <Badge variant={variant} data-testid={`section-state-${state}`}>
      {sectionStateLabel(state)}
    </Badge>
  );
}

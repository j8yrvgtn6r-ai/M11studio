import { AlertTriangle } from 'lucide-react';
import type { ConsistencyImpactRecord, GeneratedSectionDraft } from '../../domain/protocol/import';
import {
  clearSectionOutOfSyncState,
  regenerateSectionImportDraftAsync,
  runSectionValidation,
} from '../../domain/protocol/import';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

function suggestedActionLabel(action: ConsistencyImpactRecord['suggestedAction']): string {
  switch (action) {
    case 'validate':
      return 'Validate section';
    case 'regenerate':
      return 'Regenerate section';
    case 'edit':
      return 'Manually edit section';
    default:
      return action;
  }
}

export function ConsistencyImpactReviewPanel({
  sectionId,
  draft,
  onManualEdit,
}: {
  sectionId: string;
  draft: GeneratedSectionDraft;
  onManualEdit?: () => void;
}) {
  const impacts = draft.consistencyImpacts ?? [];
  if (impacts.length === 0) {
    return null;
  }

  const primaryReason = impacts[0]?.reason;

  return (
    <div className="space-y-3 mb-6" data-testid="consistency-out-of-sync-banner">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              This section may be out of sync because related study facts changed.
            </p>
            {primaryReason ? <p className="text-muted-foreground">{primaryReason}</p> : null}
          </div>
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" data-testid="consistency-review-impact">
            Review Impact
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="consistency-impact-dialog">
          <DialogHeader>
            <DialogTitle>Review downstream impact</DialogTitle>
            <DialogDescription>
              Related study facts changed elsewhere. Review affected relationships before updating this section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {impacts.map((impact) => (
              <div key={impact.impactId} className="rounded-md border border-border p-3 space-y-2 text-sm">
                <p>
                  <span className="font-medium">Changed item:</span> {impact.changedItemName}
                </p>
                <p>
                  <span className="font-medium">Source section:</span>{' '}
                  {impact.sourceSectionTitle
                    ? `${impact.sourceSectionTitle} (${impact.sourceSectionId})`
                    : impact.sourceSectionId}
                </p>
                <p>
                  <span className="font-medium">Relationship:</span> {impact.relationship}
                </p>
                <p className="text-muted-foreground">{impact.reason}</p>
                <p>
                  <span className="font-medium">Suggested action:</span>{' '}
                  {suggestedActionLabel(impact.suggestedAction)}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              data-testid="consistency-action-validate"
              onClick={() => {
                clearSectionOutOfSyncState(sectionId);
                runSectionValidation(sectionId);
              }}
            >
              Validate section
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="consistency-action-regenerate"
              onClick={() => {
                clearSectionOutOfSyncState(sectionId);
                void regenerateSectionImportDraftAsync(sectionId);
              }}
            >
              Regenerate section
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="consistency-action-edit"
              onClick={() => {
                clearSectionOutOfSyncState(sectionId);
                onManualEdit?.();
              }}
            >
              Manually edit section
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

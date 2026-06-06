import { useMemo, useState } from 'react';
import { buildTrackChangeSegments } from '../../agents/validationRules';
import type { GeneratedSectionDraft } from '../../domain/protocol/import/types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

type ValidationViewMode = 'track-changes' | 'side-by-side';

interface SectionValidationReviewPanelProps {
  draft: GeneratedSectionDraft;
  onAccept: () => void;
  onReject: () => void;
}

export function SectionValidationReviewPanel({ draft, onAccept, onReject }: SectionValidationReviewPanelProps) {
  const [viewMode, setViewMode] = useState<ValidationViewMode>('track-changes');
  const originalText = draft.sourceText ?? draft.generatedText;
  const validatedText = draft.validatedTargetText ?? draft.generatedText;
  const trackChanges = useMemo(
    () => buildTrackChangeSegments(originalText, validatedText, draft.validationChanges ?? []),
    [originalText, validatedText, draft.validationChanges],
  );

  return (
    <div className="space-y-4" data-testid="section-validation-review-panel">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Validation review</Label>
        <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
          <button
            type="button"
            className={`px-2 py-1 ${viewMode === 'track-changes' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
            data-testid="validation-view-track-changes"
            onClick={() => setViewMode('track-changes')}
          >
            Track Changes
          </button>
          <button
            type="button"
            className={`px-2 py-1 border-l border-border ${viewMode === 'side-by-side' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
            data-testid="validation-view-side-by-side"
            onClick={() => setViewMode('side-by-side')}
          >
            Side-by-Side
          </button>
        </div>
      </div>

      {viewMode === 'track-changes' ? (
        <div
          className="rounded-lg border border-border bg-card p-3 text-sm leading-relaxed whitespace-pre-wrap"
          data-testid="validation-track-changes-view"
        >
          {trackChanges.map((part, index) => {
            if (part.kind === 'deletion') {
              return (
                <span key={index} className="bg-red-500/15 text-red-700 dark:text-red-300 line-through">
                  {part.text}
                </span>
              );
            }
            if (part.kind === 'addition') {
              return (
                <span key={index} className="bg-green-500/15 text-green-700 dark:text-green-300">
                  {part.text}
                </span>
              );
            }
            if (part.kind === 'terminology') {
              return (
                <span
                  key={index}
                  className="bg-blue-500/15 text-blue-700 dark:text-blue-300 underline decoration-dotted"
                  title={part.replacementText ? `→ ${part.replacementText}` : undefined}
                >
                  {part.text}
                </span>
              );
            }
            return (
              <span key={index} className="text-foreground">
                {part.text}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3" data-testid="validation-side-by-side-view">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Original imported text</p>
            <p className="text-sm whitespace-pre-wrap">{originalText}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Validated target text</p>
            <p className="text-sm whitespace-pre-wrap">{validatedText}</p>
          </div>
        </div>
      )}

      {(draft.validationFindings ?? []).length > 0 ? (
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1" data-testid="validation-findings-list">
          {draft.validationFindings.map((finding) => (
            <li key={`${finding.code}-${finding.message}`}>
              [{finding.severity}] {finding.message}
            </li>
          ))}
        </ul>
      ) : null}

      {(draft.validationChanges ?? []).length > 0 ? (
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1" data-testid="validation-changes-list">
          {draft.validationChanges.map((change) => (
            <li key={change.id}>
              {change.type}: {change.reason}
              {change.originalText && change.replacementText
                ? ` (${change.originalText} → ${change.replacementText})`
                : null}
            </li>
          ))}
        </ul>
      ) : null}

      {(draft.validationMessages ?? []).length > 0 ? (
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1" data-testid="validation-target-messages">
          {draft.validationMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" data-testid="validation-accept-button" onClick={onAccept}>
          Accept Validation
        </Button>
        <Button size="sm" variant="outline" data-testid="validation-reject-button" onClick={onReject}>
          Reject Validation
        </Button>
      </div>
    </div>
  );
}

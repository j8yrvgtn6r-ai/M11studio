import { useMemo, useState } from 'react';
import type { GeneratedSectionDraft } from '../../domain/protocol/import/types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

type ValidationViewMode = 'track-changes' | 'side-by-side';

function buildTrackChanges(original: string, updated: string): Array<{ type: 'same' | 'add'; text: string }> {
  if (original === updated) {
    return [{ type: 'same', text: original }];
  }
  if (updated.startsWith(original)) {
    return [
      { type: 'same', text: original },
      { type: 'add', text: updated.slice(original.length) },
    ];
  }
  return [
    { type: 'same', text: original },
    { type: 'add', text: updated.slice(original.length) },
  ];
}

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
    () => buildTrackChanges(originalText, validatedText),
    [originalText, validatedText],
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
        <div className="rounded-lg border border-border bg-card p-3 text-sm leading-relaxed" data-testid="validation-track-changes-view">
          {trackChanges.map((part, index) =>
            part.type === 'add' ? (
              <span key={index} className="bg-green-500/15 text-green-700 dark:text-green-300">
                {part.text}
              </span>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3" data-testid="validation-side-by-side-view">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Original</p>
            <p className="text-sm whitespace-pre-wrap">{originalText}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Validated Target</p>
            <p className="text-sm whitespace-pre-wrap">{validatedText}</p>
          </div>
        </div>
      )}

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

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  buildSideBySidePanels,
  buildValidationReviewCompactSummary,
  enrichTrackChangeSegments,
  formatValidationChangeTooltip,
  formatValidationProviderLabel,
  summarizeValidationChanges,
  type TrackChangeSegment,
} from '../../agents/validationRules';
import type { GeneratedSectionDraft, ValidationChange } from '../../domain/protocol/import/types';
import {
  revertToDeterministicValidationProposal,
  runLlmSectionValidation,
} from '../../domain/protocol/import/protocolImportStore';
import { getLlmValidationAvailability } from '../../domain/protocol/import/llm/llmConfig';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AlertTriangle, Loader2 } from 'lucide-react';

type ValidationViewMode = 'track-changes' | 'side-by-side';

interface SectionValidationReviewPanelProps {
  sectionId: string;
  draft: GeneratedSectionDraft;
  onAccept: () => void;
  onReject: () => void;
}

function segmentHighlightClass(kind: TrackChangeSegment['kind'], side: 'track' | 'left' | 'right'): string {
  if (kind === 'unchanged' || kind === 'empty') {
    return 'text-foreground';
  }
  if (kind === 'deletion') {
    return 'bg-red-500/15 text-red-700 dark:text-red-300 line-through';
  }
  if (kind === 'addition') {
    return 'bg-green-500/15 text-green-700 dark:text-green-300';
  }
  if (kind === 'terminology') {
    if (side === 'left') {
      return 'bg-red-500/10 text-red-700 dark:text-red-300 line-through decoration-dotted';
    }
    return 'bg-green-500/15 text-green-700 dark:text-green-300 underline decoration-dotted';
  }
  return 'bg-amber-500/15 text-amber-800 dark:text-amber-200';
}

function ValidationChangeHighlight({
  change,
  kind,
  side,
  segmentId,
  children,
}: {
  change?: ValidationChange;
  kind: TrackChangeSegment['kind'] | 'empty';
  side: 'track' | 'left' | 'right';
  segmentId: string;
  children: ReactNode;
}) {
  if (kind === 'unchanged' || kind === 'empty' || !children) {
    return <span data-segment-id={segmentId}>{children}</span>;
  }

  const className = segmentHighlightClass(kind as TrackChangeSegment['kind'], side);
  const tooltip = formatValidationChangeTooltip(change);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`${className} cursor-help rounded-sm`}
          data-testid="validation-change-highlight"
          data-change-id={change?.id}
          data-segment-id={segmentId}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-sm whitespace-pre-wrap bg-popover text-popover-foreground border border-border"
        data-testid="validation-change-tooltip"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function SectionValidationReviewPanel({
  sectionId,
  draft,
  onAccept,
  onReject,
}: SectionValidationReviewPanelProps) {
  const [viewMode, setViewMode] = useState<ValidationViewMode>('track-changes');
  const [llmMessage, setLlmMessage] = useState<string | null>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);

  const originalText = draft.sourceText ?? draft.generatedText;
  const validatedText = draft.validatedTargetText ?? draft.generatedText;
  const changes = draft.validationChanges ?? [];
  const findings = draft.validationFindings ?? [];
  const summary = useMemo(() => summarizeValidationChanges(changes), [changes]);
  const compactSummary = useMemo(
    () => buildValidationReviewCompactSummary(changes, findings),
    [changes, findings],
  );
  const warningCount = useMemo(
    () =>
      findings.filter(
        (finding) =>
          finding.severity === 'warning' &&
          finding.code !== 'controlled_terminology' &&
          !finding.message.includes('narrative validation pending'),
      ).length,
    [findings],
  );
  const trackSegments = useMemo(
    () => enrichTrackChangeSegments(originalText, validatedText, changes),
    [originalText, validatedText, changes],
  );
  const sideBySide = useMemo(
    () => buildSideBySidePanels(originalText, validatedText, changes),
    [originalText, validatedText, changes],
  );

  const llmAvailability = getLlmValidationAvailability();
  const showDeterministicProvider =
    (draft.validationProvider ?? 'local-deterministic') === 'local-deterministic';
  const showLlmProposalActions =
    draft.validationProvider !== 'local-deterministic' && draft.deterministicValidationBackup;
  const llmRunning = draft.llmValidationInProgress === true;

  const syncScroll = useCallback((source: 'left' | 'right') => {
    if (syncingScroll.current) {
      return;
    }
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) {
      return;
    }
    syncingScroll.current = true;
    const sourceEl = source === 'left' ? left : right;
    const targetEl = source === 'left' ? right : left;
    const maxSource = sourceEl.scrollHeight - sourceEl.clientHeight;
    const maxTarget = targetEl.scrollHeight - targetEl.clientHeight;
    const ratio = maxSource > 0 ? sourceEl.scrollTop / maxSource : 0;
    targetEl.scrollTop = ratio * maxTarget;
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  }, []);

  const handleRunLlmValidation = () => {
    setLlmMessage(null);
    if (!llmAvailability.available) {
      setLlmMessage(llmAvailability.message);
      return;
    }
    runLlmSectionValidation(sectionId);
  };

  const handleRevertDeterministic = () => {
    revertToDeterministicValidationProposal(sectionId);
    setLlmMessage(null);
  };

  return (
    <div
      className="flex flex-col flex-1 min-h-[min(520px,calc(100vh-16rem))] rounded-lg border border-border bg-card/40"
      data-testid="section-validation-review-panel"
    >
      <div className="shrink-0 space-y-3 p-3 border-b border-border">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Validation review</Label>
            <p className="text-xs font-medium text-foreground" data-testid="validation-compact-summary">
              {compactSummary}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="validation-change-summary">
              {summary.label}
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden text-xs shrink-0">
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

        {warningCount > 0 ? (
          <Alert
            className="border-amber-500/40 bg-amber-500/10 py-2"
            data-testid="validation-warning-callout"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
              {warningCount} validation warning{warningCount === 1 ? '' : 's'} — see Validation tab for details.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span data-testid="validation-provider-label">
            Provider: {formatValidationProviderLabel(draft.validationProvider, draft.validationModel)}
          </span>
          {draft.lastValidatedAt ? (
            <span>Validated: {new Date(draft.lastValidatedAt).toLocaleString()}</span>
          ) : null}
        </div>

        {showDeterministicProvider ? (
          !llmAvailability.available ? (
            <p className="text-xs text-muted-foreground" data-testid="validation-llm-unavailable-message">
              {llmAvailability.message}
            </p>
          ) : null
        ) : null}

        {llmMessage ? (
          <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="validation-llm-message">
            {llmMessage}
          </p>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-3" data-testid="validation-comparison-region">
        {viewMode === 'track-changes' ? (
          <div
            className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-3 text-sm leading-relaxed whitespace-pre-wrap"
            data-testid="validation-track-changes-view"
          >
            {trackSegments.map((part) => (
              <ValidationChangeHighlight
                key={part.segmentId}
                change={part.change}
                kind={part.kind}
                side="track"
                segmentId={part.segmentId}
              >
                {part.text}
              </ValidationChangeHighlight>
            ))}
          </div>
        ) : (
          <div
            className="flex-1 min-h-0 grid grid-cols-2 gap-3"
            data-testid="validation-side-by-side-view"
          >
            <div className="flex flex-col min-h-0 rounded-lg border border-border bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground px-3 pt-3 pb-2 shrink-0">
                Original imported text
              </p>
              <div
                ref={leftScrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 text-sm leading-relaxed whitespace-pre-wrap"
                data-testid="validation-side-by-side-left"
                onScroll={() => syncScroll('left')}
              >
                {sideBySide.left.map((part) => (
                  <ValidationChangeHighlight
                    key={part.segmentId}
                    change={part.change}
                    kind={part.kind}
                    side="left"
                    segmentId={part.segmentId}
                  >
                    {part.text}
                  </ValidationChangeHighlight>
                ))}
              </div>
            </div>
            <div className="flex flex-col min-h-0 rounded-lg border border-border bg-card">
              <p className="text-xs font-medium text-muted-foreground px-3 pt-3 pb-2 shrink-0">
                Validated target text
              </p>
              <div
                ref={rightScrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 text-sm leading-relaxed whitespace-pre-wrap"
                data-testid="validation-side-by-side-right"
                onScroll={() => syncScroll('right')}
              >
                {sideBySide.right.map((part) => (
                  <ValidationChangeHighlight
                    key={part.segmentId}
                    change={part.change}
                    kind={part.kind}
                    side="right"
                    segmentId={part.segmentId}
                  >
                    {part.text}
                  </ValidationChangeHighlight>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {findings.length > 0 ? (
        <div
          className="shrink-0 border-t border-border bg-muted/20 px-3 py-2 max-h-32 overflow-y-auto"
          data-testid="validation-findings-panel"
        >
          <p className="text-xs font-medium mb-1">Validation findings</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {findings.map((finding) => (
              <li key={finding.id}>
                <span className="font-medium text-foreground">{finding.code}</span>: {finding.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className="sticky bottom-0 shrink-0 border-t border-border bg-card/95 backdrop-blur px-3 py-2 flex flex-wrap justify-end gap-2 z-10"
        data-testid="validation-action-bar"
      >
        {showLlmProposalActions ? (
          <Button
            size="sm"
            variant="outline"
            data-testid="validation-revert-deterministic-button"
            onClick={handleRevertDeterministic}
          >
            Revert to deterministic proposal
          </Button>
        ) : null}
        {showDeterministicProvider ? (
          <Button
            size="sm"
            variant="outline"
            data-testid="validation-run-llm-button"
            disabled={llmRunning}
            onClick={handleRunLlmValidation}
          >
            {llmRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Running LLM Validation…
              </>
            ) : (
              'Run LLM Validation'
            )}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" data-testid="validation-reject-button" onClick={onReject}>
          Reject Validation
        </Button>
        <Button size="sm" data-testid="validation-accept-button" onClick={onAccept}>
          Accept Validation
        </Button>
      </div>
    </div>
  );
}

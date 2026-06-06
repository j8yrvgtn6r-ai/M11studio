import type { M11GenerationProgressSnapshot } from '../domain/protocol/import/llm/m11GenerationProgress';
import { formatEstimatedRemaining } from '../domain/protocol/import/llm/m11GenerationProgress';
import { formatBuildDurationMs } from '../domain/protocol/build/formatBuildDuration';
import type { ProtocolBuildStatus } from '../domain/protocol/build/protocolBuildConsoleStore';

interface GenerationProgressSummaryProps {
  progress: M11GenerationProgressSnapshot | null;
  status: ProtocolBuildStatus;
  mode?: string;
}

export function GenerationProgressSummary({ progress, status, mode = 'Full' }: GenerationProgressSummaryProps) {
  if (!progress && status === 'idle') {
    return null;
  }

  const completed = progress?.completedSections ?? 0;
  const total = progress?.totalSections ?? 0;
  const failed = progress?.failedSections ?? 0;
  const queued = progress?.queuedSections ?? Math.max(0, total - completed - failed);
  const currentLabel = progress?.currentSectionId
    ? `${progress.currentSectionId}${progress.currentSectionTitle ? ` ${progress.currentSectionTitle}` : ''}`
    : status === 'complete'
      ? 'Review package ready'
      : status === 'paused'
        ? 'Paused'
        : '—';

  return (
    <div
      className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-2 text-xs"
      data-testid="protocol-build-progress-summary"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm">Protocol Reconstruction Progress</p>
        {status === 'paused' ? (
          <span className="text-amber-600 font-medium" data-testid="protocol-build-paused-badge">
            Paused
          </span>
        ) : null}
        {status === 'complete' ? (
          <span className="text-green-600 font-medium" data-testid="protocol-build-complete-badge">
            Completed
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1">
        <span className="text-muted-foreground">Mode</span>
        <span data-testid="protocol-build-mode">{mode}</span>
        <span className="text-muted-foreground">Completed</span>
        <span data-testid="protocol-build-completed-count">
          {completed} / {total || '—'}
        </span>
        <span className="text-muted-foreground">Failed</span>
        <span data-testid="protocol-build-failed-count">{failed}</span>
        <span className="text-muted-foreground">Queued</span>
        <span data-testid="protocol-build-queued-count">{queued}</span>
        <span className="text-muted-foreground">Currently generating</span>
        <span data-testid="protocol-build-current-section" className="truncate">
          {currentLabel}
        </span>
        <span className="text-muted-foreground">Provider</span>
        <span data-testid="protocol-build-provider-model">
          {progress?.providerLabel ?? '—'}
          {progress?.model ? ` · ${progress.model}` : ''}
        </span>
        <span className="text-muted-foreground">Elapsed</span>
        <span data-testid="protocol-build-elapsed">
          {progress ? formatBuildDurationMs(progress.elapsedMs) : '—'}
        </span>
        <span className="text-muted-foreground">Current section</span>
        <span data-testid="protocol-build-current-duration">
          {progress?.currentRequestDurationMs !== undefined
            ? formatBuildDurationMs(progress.currentRequestDurationMs)
            : '—'}
        </span>
        <span className="text-muted-foreground">Average</span>
        <span data-testid="protocol-build-average-duration">
          {progress?.averageSectionDurationMs !== undefined
            ? `${formatBuildDurationMs(progress.averageSectionDurationMs)} / section`
            : 'Estimating…'}
        </span>
        <span className="text-muted-foreground">Estimated remaining</span>
        <span data-testid="protocol-build-estimated-remaining">
          {progress ? formatEstimatedRemaining(progress) : 'Estimating…'}
        </span>
      </div>
    </div>
  );
}

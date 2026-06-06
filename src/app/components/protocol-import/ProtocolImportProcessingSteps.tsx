import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

import type { ImportProcessingStep } from '../../domain/protocol/import';
import { cn } from '../ui/utils';

interface ProtocolImportProcessingStepsProps {
  steps: ImportProcessingStep[];
}

function StepIcon({ state }: { state: ImportProcessingStep['state'] }) {
  if (state === 'complete') {
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />;
  }
  if (state === 'active') {
    return <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />;
  }
  if (state === 'failed') {
    return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function GenerationProgressPanel({
  progress,
}: {
  progress: NonNullable<ImportProcessingStep['generationProgress']>;
}) {
  return (
    <div
      className="mt-3 rounded-md border border-border/80 bg-background/80 p-3 space-y-2 text-xs"
      data-testid="import-generation-progress"
    >
      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1">
        <span className="text-muted-foreground">Current section</span>
        <span data-testid="import-generation-current-section">
          {progress.currentSectionId
            ? `${progress.currentSectionId}${progress.currentSectionTitle ? ` · ${progress.currentSectionTitle}` : ''}`
            : '—'}
        </span>
        <span className="text-muted-foreground">Completed</span>
        <span data-testid="import-generation-completed-count">
          {progress.completedSections}/{progress.totalSections}
        </span>
        <span className="text-muted-foreground">Failed</span>
        <span data-testid="import-generation-failed-count">
          {progress.failedSections}/{progress.totalSections}
        </span>
        <span className="text-muted-foreground">Elapsed</span>
        <span data-testid="import-generation-elapsed">{Math.round(progress.elapsedMs / 1000)}s</span>
        <span className="text-muted-foreground">Request</span>
        <span data-testid="import-generation-request-duration">
          {progress.currentRequestDurationMs !== undefined
            ? `${Math.round(progress.currentRequestDurationMs / 1000)}s`
            : '—'}
        </span>
        <span className="text-muted-foreground">Provider</span>
        <span data-testid="import-generation-provider-model">
          {progress.providerLabel ?? '—'}
          {progress.model ? ` / ${progress.model}` : ''}
        </span>
      </div>
      {progress.lastError ? (
        <p className="text-destructive" data-testid="import-generation-last-error">
          {progress.lastError}
        </p>
      ) : null}
    </div>
  );
}

export function ProtocolImportProcessingSteps({ steps }: ProtocolImportProcessingStepsProps) {
  return (
    <ol className="space-y-3" data-testid="protocol-import-processing-steps">
      {steps.map((step) => (
        <li
          key={step.id}
          data-testid={`import-step-${step.id}`}
          data-state={step.state}
          className={cn(
            'rounded-lg border px-3 py-2 text-sm transition-colors',
            step.state === 'active' && 'border-primary/40 bg-primary/5',
            step.state === 'complete' && 'border-border bg-muted/30',
            step.state === 'failed' && 'border-destructive/40 bg-destructive/5',
            step.state === 'pending' && 'border-border/60 text-muted-foreground',
          )}
        >
          <div className="flex items-start gap-3">
            <StepIcon state={step.state} />
            <div className="min-w-0 flex-1">
              <p className={step.state === 'active' ? 'font-medium' : undefined}>{step.label}</p>
              {step.detail ? (
                <p
                  className="text-xs text-muted-foreground mt-0.5 break-words"
                  data-testid={`import-step-detail-${step.id}`}
                >
                  {step.detail}
                </p>
              ) : null}
              {step.id === 'rewriting-m11' && step.generationProgress ? (
                <GenerationProgressPanel progress={step.generationProgress} />
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

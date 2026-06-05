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
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

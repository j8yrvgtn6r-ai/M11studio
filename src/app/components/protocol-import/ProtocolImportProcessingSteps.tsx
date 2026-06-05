import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

import type { ImportProcessingStep } from '../../domain/protocol/import';
import { cn } from '../ui/utils';

interface ProtocolImportProcessingStepsProps {
  steps: ImportProcessingStep[];
}

function StepIcon({ state }: { state: ImportProcessingStep['state'] }) {
  if (state === 'complete') {
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
  }
  if (state === 'active') {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  if (state === 'failed') {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground" />;
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
            'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
            step.state === 'active' && 'border-primary/40 bg-primary/5',
            step.state === 'complete' && 'border-border bg-muted/30',
            step.state === 'failed' && 'border-destructive/40 bg-destructive/5',
            step.state === 'pending' && 'border-border/60 text-muted-foreground',
          )}
        >
          <StepIcon state={step.state} />
          <span className={step.state === 'active' ? 'font-medium' : undefined}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

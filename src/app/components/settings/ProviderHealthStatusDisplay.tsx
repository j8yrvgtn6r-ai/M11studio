import type { LlmProviderHealthRecord } from '../../domain/protocol/import/llm/llmProviderSettings';
import { healthStatusLabel } from '../../domain/protocol/import/llm/llmProviderSettings';
import { Badge } from '../ui/badge';

function statusVariant(status: LlmProviderHealthRecord['status']) {
  if (status === 'connected') return 'default' as const;
  if (status === 'authentication-error' || status === 'configuration-error') return 'destructive' as const;
  return 'secondary' as const;
}

interface ProviderHealthStatusDisplayProps {
  health: LlmProviderHealthRecord | null | undefined;
  testId?: string;
}

export function ProviderHealthStatusDisplay({ health, testId }: ProviderHealthStatusDisplayProps) {
  if (!health) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={testId}>
        Connection not tested yet.
      </p>
    );
  }

  return (
    <div className="text-xs space-y-1" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(health.status)}>{healthStatusLabel(health.status)}</Badge>
        {health.success ? (
          <span>
            {health.model ?? 'model unknown'} · {health.latencyMs}ms
          </span>
        ) : (
          <span className="text-destructive">{health.errorMessage}</span>
        )}
      </div>
      <p className="text-muted-foreground">
        Last test: {new Date(health.testedAt).toLocaleString()}
        {health.lastSuccessAt
          ? ` · Last success: ${new Date(health.lastSuccessAt).toLocaleString()}`
          : ''}
      </p>
    </div>
  );
}

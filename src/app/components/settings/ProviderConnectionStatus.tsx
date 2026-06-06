import type { LlmProviderHealthRecord } from '../../domain/protocol/import/llm/llmProviderSettings';
import { healthStatusLabel } from '../../domain/protocol/import/llm/llmProviderSettings';
import { Badge } from '../ui/badge';

function statusVariant(status: LlmProviderHealthRecord['status']) {
  if (status === 'connected') return 'default' as const;
  if (status === 'authentication-error' || status === 'configuration-error') return 'destructive' as const;
  return 'secondary' as const;
}

interface ProviderConnectionStatusProps {
  health: LlmProviderHealthRecord | null | undefined;
  modelFallback?: string;
  testId?: string;
}

export function ProviderConnectionStatus({
  health,
  modelFallback,
  testId = 'connection-status-panel',
}: ProviderConnectionStatusProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3" data-testid={testId}>
      <h3 className="font-semibold text-sm">Connection Status</h3>

      {!health ? (
        <p className="text-sm text-muted-foreground" data-testid="connection-not-tested">
          Not tested yet.
        </p>
      ) : (
        <dl className="text-sm space-y-2">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Status</dt>
            <dd>
              <Badge variant={statusVariant(health.status)} data-testid="connection-status-badge">
                {healthStatusLabel(health.status)}
              </Badge>
            </dd>
          </div>

          {health.success ? (
            <>
              <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-mono" data-testid="connection-status-model">
                  {health.model ?? modelFallback ?? 'Unknown'}
                </dd>
                <dt className="text-muted-foreground">Latency</dt>
                <dd data-testid="connection-status-latency">{health.latencyMs} ms</dd>
                <dt className="text-muted-foreground">Last tested</dt>
                <dd data-testid="connection-status-last-tested">
                  {new Date(health.testedAt).toLocaleString()}
                </dd>
              </div>
            </>
          ) : (
            <p className="text-sm text-destructive" data-testid="connection-status-error">
              {health.errorMessage ?? healthStatusLabel(health.status)}
            </p>
          )}

          {!health.success && health.lastSuccessAt ? (
            <p className="text-xs text-muted-foreground" data-testid="connection-last-success">
              Last successful test: {new Date(health.lastSuccessAt).toLocaleString()}
            </p>
          ) : null}
        </dl>
      )}
    </div>
  );
}

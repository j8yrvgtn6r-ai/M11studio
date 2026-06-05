import { Bot, CheckCircle2, Circle, XCircle } from 'lucide-react';

import {
  getLlmProviderStatus,
  type LlmProviderCardInfo,
  type LlmProviderCardStatus,
} from '../../domain/protocol/import/llm/llmConfig';
import { LlmSafetyNotice } from '../protocol-import/LlmSafetyNotice';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';

function statusBadge(status: LlmProviderCardStatus) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-600/90" data-testid="provider-card-status-active">
          Active
        </Badge>
      );
    case 'available':
      return <Badge variant="outline">Available</Badge>;
    default:
      return <Badge variant="secondary">Unavailable</Badge>;
  }
}

function statusIcon(status: LlmProviderCardStatus) {
  switch (status) {
    case 'active':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'available':
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function ProviderCard({ card }: { card: LlmProviderCardInfo }) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-3"
      data-testid={`ai-provider-card-${card.providerId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {statusIcon(card.status)}
          <h3 className="font-semibold text-sm">{card.displayName}</h3>
        </div>
        {statusBadge(card.status)}
      </div>
      <p className="text-xs text-muted-foreground">{card.description}</p>
      <dl className="text-xs space-y-1">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">API key configured</dt>
          <dd>{card.apiKeyConfigured ? 'Yes' : 'No'}</dd>
        </div>
        {card.modelName ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Model / deployment</dt>
            <dd className="font-mono text-right">{card.modelName}</dd>
          </div>
        ) : null}
        {card.requiredEnvVars.length > 0 ? (
          <div>
            <dt className="text-muted-foreground mb-1">Required environment variables</dt>
            <dd>
              <ul className="list-disc pl-4 space-y-0.5 font-mono text-[11px]">
                {card.requiredEnvVars.map((envVar) => (
                  <li key={envVar}>{envVar}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function AiProvidersSettingsPanel() {
  const status = getLlmProviderStatus();

  return (
    <div className="space-y-6 max-w-4xl" data-testid="ai-providers-settings-panel">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Providers
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Protocol import uses these providers for global protocol understanding and M11 section
          reconstruction. Configuration is read-only here — set via environment variables or
          localStorage key <code className="text-xs">m11-protocol-llm-provider</code>.
        </p>
      </div>

      <LlmSafetyNotice />

      <div
        className="rounded-lg border border-border bg-muted/10 p-4 space-y-3"
        data-testid="ai-provider-active-status"
      >
        <h3 className="font-semibold text-sm">Active configuration</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Active provider</dt>
            <dd className="font-medium" data-testid="ai-active-provider-label">
              {status.activeProviderLabel}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Active model</dt>
            <dd className="font-mono text-sm" data-testid="ai-active-model">
              {status.activeModel}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Provider source</dt>
            <dd data-testid="ai-provider-source">{status.providerSource}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">API key configured</dt>
            <dd data-testid="ai-api-key-configured">
              {status.apiKeyConfiguredForActive ? 'Yes' : 'No'}
            </dd>
          </div>
        </dl>
        {status.fellBackToFixture && status.requestedProviderId ? (
          <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="ai-fallback-notice">
            Requested provider <strong>{status.requestedProviderId}</strong> is unavailable without
            API credentials. Running with Fixture provider.
          </p>
        ) : null}
      </div>

      {status.browserSideApiKeyInUse ? (
        <Alert variant="destructive" data-testid="ai-browser-key-warning">
          <AlertTitle>Production warning</AlertTitle>
          <AlertDescription className="text-xs">
            A browser-side API key is configured via Vite environment variables. This exposes
            credentials in the client bundle and should only be used for local development.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        {status.cards.map((card) => (
          <ProviderCard key={card.providerId} card={card} />
        ))}
      </div>
    </div>
  );
}

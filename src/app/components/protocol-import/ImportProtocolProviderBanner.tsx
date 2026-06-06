import { AlertTriangle } from 'lucide-react';

import { getLlmProviderStatus, isRealLlmProvider } from '../../domain/protocol/import/llm/llmConfig';
import { healthStatusLabel } from '../../domain/protocol/import/llm/llmProviderSettings';
import { getProviderHealth } from '../../domain/protocol/import/llm/llmProviderSettings';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { LlmSafetyNotice } from './LlmSafetyNotice';

export function ImportProtocolProviderBanner() {
  const status = getLlmProviderStatus();
  const activeHealth =
    status.activeProviderId === 'fixture'
      ? getProviderHealth('fixture')
      : isRealLlmProvider(status.activeProviderId)
        ? getProviderHealth(status.activeProviderId)
        : null;

  const showUntestedWarning =
    isRealLlmProvider(status.activeProviderId) && !status.providerTestedSuccessfully;

  return (
    <div className="space-y-3" data-testid="import-protocol-provider-banner">
      <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Active import provider</span>
          <Badge variant="outline" data-testid="import-dialog-active-provider">
            {status.activeProviderLabel}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]" data-testid="import-dialog-active-model">
            {status.activeModel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="import-dialog-provider-source">
          Source: {status.providerSource}
          {status.fellBackToFixture ? ' · using Simulation Mode fallback' : ''}
        </p>
        {activeHealth ? (
          <p className="text-xs" data-testid="import-dialog-connection-status">
            Connection: {healthStatusLabel(activeHealth.status)}
            {activeHealth.lastSuccessAt
              ? ` · last success ${new Date(activeHealth.lastSuccessAt).toLocaleString()}`
              : ''}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="import-dialog-connection-status">
            Connection: not tested
          </p>
        )}
      </div>

      {showUntestedWarning ? (
        <Alert
          variant="destructive"
          className="border-amber-500/40 bg-amber-500/5"
          data-testid="import-provider-untested-warning"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">Provider has not been tested</AlertTitle>
          <AlertDescription className="text-xs">
            Open Settings → AI Providers and run Test connection before importing with a live provider.
          </AlertDescription>
        </Alert>
      ) : null}

      <LlmSafetyNotice compact />

      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1" data-testid="import-protocol-expectations">
        <li>Large protocols may take several minutes. M11 Studio reconstructs the protocol section by section.</li>
        <li>You can review drafts after processing completes.</li>
        <li>For v1, SoA extraction is not yet included.</li>
      </ul>
    </div>
  );
}

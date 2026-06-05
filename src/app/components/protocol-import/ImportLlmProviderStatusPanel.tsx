import { useMemo } from 'react';

import { getLlmProviderStatus, isRealLlmProvider } from '../../domain/protocol/import/llm/llmConfig';
import { useProtocolImport } from '../../domain/protocol/import/ProtocolImportContext';
import { Badge } from '../ui/badge';
import { LlmSafetyNotice } from './LlmSafetyNotice';

function providerLabel(providerId: string): string {
  switch (providerId) {
    case 'openai':
      return 'OpenAI';
    case 'azure-openai':
      return 'Azure OpenAI';
    case 'fixture':
    case 'local':
      return 'Fixture';
    default:
      return providerId;
  }
}

export function ImportLlmProviderStatusPanel() {
  const { protocolKnowledge, state } = useProtocolImport();
  const configured = useMemo(() => getLlmProviderStatus(), []);

  const sampleDraft = useMemo(() => {
    const drafts = Object.values(state.sectionDrafts);
    if (drafts.length === 0) return null;
    return drafts.sort(
      (left, right) =>
        new Date(right.provenance?.generationTimestamp ?? right.generatedAt).getTime() -
        new Date(left.provenance?.generationTimestamp ?? left.generatedAt).getTime(),
    )[0];
  }, [state.sectionDrafts]);

  const understandingProvider = protocolKnowledge?.knowledgeProvider ?? configured.activeProviderId;
  const understandingModel = protocolKnowledge?.understandingModel ?? configured.activeModel;
  const understandingAt = protocolKnowledge?.extractedAt;

  const generationProvider =
    sampleDraft?.provenance?.generationProvider ?? sampleDraft?.generationProvider ?? configured.activeProviderId;
  const generationModel = sampleDraft?.provenance?.generationModel ?? configured.activeModel;
  const generationAt =
    sampleDraft?.provenance?.generationTimestamp ?? sampleDraft?.generatedAt ?? null;

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-3"
      data-testid="import-llm-provider-status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-sm">LLM provider status</h3>
        <Badge variant="outline" data-testid="import-configured-provider-badge">
          Configured: {configured.activeProviderLabel}
        </Badge>
        {isRealLlmProvider(understandingProvider) || isRealLlmProvider(generationProvider) ? (
          <Badge variant="outline" className="text-amber-700 border-amber-500/40">
            Live provider in use
          </Badge>
        ) : (
          <Badge variant="secondary" data-testid="import-fixture-provider-badge">
            Fixture provider
          </Badge>
        )}
      </div>

      <LlmSafetyNotice compact />

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">
            Protocol understanding
          </dt>
          <dd data-testid="import-understanding-provider">
            Provider: <span className="font-medium">{providerLabel(understandingProvider)}</span>
          </dd>
          <dd data-testid="import-understanding-model" className="font-mono text-xs">
            Model: {understandingModel}
          </dd>
          {understandingAt ? (
            <dd className="text-xs text-muted-foreground" data-testid="import-understanding-timestamp">
              {new Date(understandingAt).toLocaleString()}
            </dd>
          ) : null}
        </div>

        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">Section generation</dt>
          <dd data-testid="import-generation-provider">
            Provider: <span className="font-medium">{providerLabel(generationProvider)}</span>
          </dd>
          <dd data-testid="import-generation-model" className="font-mono text-xs">
            Model: {generationModel}
          </dd>
          {generationAt ? (
            <dd className="text-xs text-muted-foreground" data-testid="import-generation-timestamp">
              {new Date(generationAt).toLocaleString()}
            </dd>
          ) : null}
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        Provider source: {configured.providerSource}
        {configured.fellBackToFixture ? ' (requested provider unavailable — fixture fallback)' : ''}
        {isRealLlmProvider(configured.activeProviderId) && !configured.providerTestedSuccessfully
          ? ' · Provider has not been tested successfully.'
          : ''}
      </p>
    </div>
  );
}

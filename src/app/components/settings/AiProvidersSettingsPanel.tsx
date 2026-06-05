import { Bot } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  getLlmProviderStatus,
  setConfiguredLlmProviderId,
} from '../../domain/protocol/import/llm/llmConfig';
import { testLlmProviderConnection } from '../../domain/protocol/import/llm/llmProviderHealthCheck';
import {
  clearAzureOpenAiStoredConfig,
  clearOpenAiStoredConfig,
  DEFAULT_AZURE_API_VERSION,
  DEFAULT_OPENAI_MODEL,
  loadAzureOpenAiStoredConfig,
  loadOpenAiStoredConfig,
  maskApiKey,
  saveAzureOpenAiStoredConfig,
  saveOpenAiStoredConfig,
} from '../../domain/protocol/import/llm/llmProviderSettings';
import { LlmSafetyNotice } from '../protocol-import/LlmSafetyNotice';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { ProviderHealthStatusDisplay } from './ProviderHealthStatusDisplay';

type SelectableProvider = 'fixture' | 'openai' | 'azure-openai';

export function AiProvidersSettingsPanel() {
  const [revision, setRevision] = useState(0);
  const [testingProvider, setTestingProvider] = useState<SelectableProvider | null>(null);
  const status = useMemo(() => getLlmProviderStatus(), [revision]);

  const storedOpenAi = useMemo(() => loadOpenAiStoredConfig(), [revision]);
  const storedAzure = useMemo(() => loadAzureOpenAiStoredConfig(), [revision]);

  const [openAiEnabled, setOpenAiEnabled] = useState(storedOpenAi?.enabled ?? false);
  const [openAiKeyInput, setOpenAiKeyInput] = useState('');
  const [openAiModel, setOpenAiModel] = useState(storedOpenAi?.model ?? DEFAULT_OPENAI_MODEL);
  const [openAiOrganization, setOpenAiOrganization] = useState(storedOpenAi?.organization ?? '');
  const [openAiProject, setOpenAiProject] = useState(storedOpenAi?.project ?? '');

  const [azureEnabled, setAzureEnabled] = useState(storedAzure?.enabled ?? false);
  const [azureKeyInput, setAzureKeyInput] = useState('');
  const [azureEndpoint, setAzureEndpoint] = useState(storedAzure?.endpoint ?? '');
  const [azureDeployment, setAzureDeployment] = useState(storedAzure?.deployment ?? '');
  const [azureApiVersion, setAzureApiVersion] = useState(
    storedAzure?.apiVersion ?? DEFAULT_AZURE_API_VERSION,
  );

  useEffect(() => {
    const openAi = loadOpenAiStoredConfig();
    const azure = loadAzureOpenAiStoredConfig();
    setOpenAiEnabled(openAi?.enabled ?? false);
    setOpenAiModel(openAi?.model ?? DEFAULT_OPENAI_MODEL);
    setOpenAiOrganization(openAi?.organization ?? '');
    setOpenAiProject(openAi?.project ?? '');
    setAzureEnabled(azure?.enabled ?? false);
    setAzureEndpoint(azure?.endpoint ?? '');
    setAzureDeployment(azure?.deployment ?? '');
    setAzureApiVersion(azure?.apiVersion ?? DEFAULT_AZURE_API_VERSION);
  }, [revision]);

  const refresh = () => setRevision((value) => value + 1);

  const selectProvider = (providerId: SelectableProvider) => {
    setConfiguredLlmProviderId(providerId);
    refresh();
  };

  const handleSaveFixture = () => {
    selectProvider('fixture');
    void testLlmProviderConnection('fixture').then(refresh);
  };

  const handleSaveOpenAi = () => {
    const existing = loadOpenAiStoredConfig();
    const apiKey = openAiKeyInput.trim() || existing?.apiKey || '';
    if (!apiKey) {
      return;
    }
    saveOpenAiStoredConfig({
      enabled: openAiEnabled,
      apiKey,
      model: openAiModel,
      organization: openAiOrganization.trim() || undefined,
      project: openAiProject.trim() || undefined,
    });
    setOpenAiKeyInput('');
    if (openAiEnabled) {
      selectProvider('openai');
    }
    refresh();
  };

  const handleClearOpenAi = () => {
    clearOpenAiStoredConfig();
    setOpenAiKeyInput('');
    setOpenAiEnabled(false);
    selectProvider('fixture');
    refresh();
  };

  const handleSaveAzure = () => {
    const existing = loadAzureOpenAiStoredConfig();
    const apiKey = azureKeyInput.trim() || existing?.apiKey || '';
    if (!apiKey || !azureEndpoint.trim() || !azureDeployment.trim()) {
      return;
    }
    saveAzureOpenAiStoredConfig({
      enabled: azureEnabled,
      apiKey,
      endpoint: azureEndpoint.trim(),
      deployment: azureDeployment.trim(),
      apiVersion: azureApiVersion.trim() || DEFAULT_AZURE_API_VERSION,
    });
    setAzureKeyInput('');
    if (azureEnabled) {
      selectProvider('azure-openai');
    }
    refresh();
  };

  const handleClearAzure = () => {
    clearAzureOpenAiStoredConfig();
    setAzureKeyInput('');
    setAzureEnabled(false);
    setAzureEndpoint('');
    setAzureDeployment('');
    setAzureApiVersion(DEFAULT_AZURE_API_VERSION);
    selectProvider('fixture');
    refresh();
  };

  const runTest = async (providerId: SelectableProvider) => {
    setTestingProvider(providerId);
    try {
      await testLlmProviderConnection(providerId);
    } finally {
      setTestingProvider(null);
      refresh();
    }
  };

  const openAiCard = status.cards.find((card) => card.providerId === 'openai');
  const azureCard = status.cards.find((card) => card.providerId === 'azure-openai');
  const fixtureCard = status.cards.find((card) => card.providerId === 'fixture');

  return (
    <div className="space-y-6 max-w-4xl" data-testid="ai-providers-settings-panel">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Providers
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure protocol import providers in this browser. UI settings take priority over Vite
          environment variables, with fixture as the safe fallback.
        </p>
      </div>

      <LlmSafetyNotice />

      <Alert variant="destructive" data-testid="ai-production-security-warning">
        <AlertTitle>Security notice</AlertTitle>
        <AlertDescription className="text-xs">
          Do not use browser-stored keys for production or PHI/PII-containing protocols. Use a secure
          backend proxy for production.
        </AlertDescription>
      </Alert>

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
            Requested provider <strong>{status.requestedProviderId}</strong> is unavailable. Running
            with Fixture provider.
          </p>
        ) : null}
      </div>

      <div className="space-y-2" data-testid="ai-provider-selection">
        <h3 className="font-semibold text-sm">Active provider selection</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={status.activeProviderId === 'fixture' ? 'default' : 'outline'}
            size="sm"
            data-testid="ai-select-fixture"
            onClick={() => void handleSaveFixture()}
          >
            Fixture
          </Button>
          <Button
            variant={status.activeProviderId === 'openai' ? 'default' : 'outline'}
            size="sm"
            data-testid="ai-select-openai"
            onClick={() => selectProvider('openai')}
            disabled={!openAiCard?.apiKeyConfigured}
          >
            OpenAI
          </Button>
          <Button
            variant={status.activeProviderId === 'azure-openai' ? 'default' : 'outline'}
            size="sm"
            data-testid="ai-select-azure-openai"
            onClick={() => selectProvider('azure-openai')}
            disabled={!azureCard?.apiKeyConfigured}
          >
            Azure OpenAI
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div
          className="rounded-lg border border-border bg-card p-4 space-y-3"
          data-testid="ai-provider-card-fixture"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">Fixture Provider</h3>
            {fixtureCard?.status === 'active' ? (
              <Badge className="bg-green-600/90" data-testid="provider-card-status-active">
                Active
              </Badge>
            ) : (
              <Badge variant="outline">Available</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{fixtureCard?.description}</p>
          <ProviderHealthStatusDisplay health={fixtureCard?.health} testId="fixture-health-status" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" data-testid="fixture-save-config" onClick={() => void handleSaveFixture()}>
              Use Fixture provider
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="fixture-test-connection"
              disabled={testingProvider === 'fixture'}
              onClick={() => void runTest('fixture')}
            >
              {testingProvider === 'fixture' ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
        </div>

        <div
          className="rounded-lg border border-border bg-card p-4 space-y-4"
          data-testid="openai-config-form"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">OpenAI Provider</h3>
            {openAiCard?.status === 'active' ? <Badge className="bg-green-600/90">Active</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">{openAiCard?.description}</p>
          <p className="text-xs text-muted-foreground">
            Your API key is stored locally in this browser for development/testing. Production
            deployments should use a secure server-side proxy.
          </p>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="openai-enabled">Enable OpenAI provider</Label>
            <Switch
              id="openai-enabled"
              checked={openAiEnabled}
              onCheckedChange={setOpenAiEnabled}
              data-testid="openai-enabled-switch"
            />
          </div>

          {storedOpenAi?.apiKey ? (
            <p className="text-xs font-mono" data-testid="openai-masked-key">
              Saved key: {maskApiKey(storedOpenAi.apiKey)}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="openai-api-key">API key</Label>
              <Input
                id="openai-api-key"
                type="password"
                placeholder="sk-..."
                value={openAiKeyInput}
                onChange={(event) => setOpenAiKeyInput(event.target.value)}
                data-testid="openai-api-key-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="openai-model">Model</Label>
              <Input
                id="openai-model"
                value={openAiModel}
                onChange={(event) => setOpenAiModel(event.target.value)}
                data-testid="openai-model-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="openai-organization">Organization (optional)</Label>
              <Input
                id="openai-organization"
                value={openAiOrganization}
                onChange={(event) => setOpenAiOrganization(event.target.value)}
                data-testid="openai-organization-input"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="openai-project">Project (optional)</Label>
              <Input
                id="openai-project"
                value={openAiProject}
                onChange={(event) => setOpenAiProject(event.target.value)}
                data-testid="openai-project-input"
              />
            </div>
          </div>

          <ProviderHealthStatusDisplay health={openAiCard?.health} testId="openai-health-status" />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" data-testid="openai-save-config" onClick={handleSaveOpenAi}>
              Save configuration
            </Button>
            <Button size="sm" variant="outline" data-testid="openai-clear-config" onClick={handleClearOpenAi}>
              Clear configuration
            </Button>
            <Button
              size="sm"
              variant="secondary"
              data-testid="openai-test-connection"
              disabled={testingProvider === 'openai'}
              onClick={() => void runTest('openai')}
            >
              {testingProvider === 'openai' ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
        </div>

        <div
          className="rounded-lg border border-border bg-card p-4 space-y-4"
          data-testid="azure-config-form"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">Azure OpenAI Provider</h3>
            {azureCard?.status === 'active' ? <Badge className="bg-green-600/90">Active</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">{azureCard?.description}</p>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="azure-enabled">Enable Azure OpenAI provider</Label>
            <Switch
              id="azure-enabled"
              checked={azureEnabled}
              onCheckedChange={setAzureEnabled}
              data-testid="azure-enabled-switch"
            />
          </div>

          {storedAzure?.apiKey ? (
            <p className="text-xs font-mono" data-testid="azure-masked-key">
              Saved key: {maskApiKey(storedAzure.apiKey)}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="azure-api-key">API key</Label>
              <Input
                id="azure-api-key"
                type="password"
                value={azureKeyInput}
                onChange={(event) => setAzureKeyInput(event.target.value)}
                data-testid="azure-api-key-input"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="azure-endpoint">Endpoint</Label>
              <Input
                id="azure-endpoint"
                placeholder="https://your-resource.openai.azure.com"
                value={azureEndpoint}
                onChange={(event) => setAzureEndpoint(event.target.value)}
                data-testid="azure-endpoint-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="azure-deployment">Deployment name</Label>
              <Input
                id="azure-deployment"
                value={azureDeployment}
                onChange={(event) => setAzureDeployment(event.target.value)}
                data-testid="azure-deployment-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="azure-api-version">API version</Label>
              <Input
                id="azure-api-version"
                value={azureApiVersion}
                onChange={(event) => setAzureApiVersion(event.target.value)}
                data-testid="azure-api-version-input"
              />
            </div>
          </div>

          <ProviderHealthStatusDisplay health={azureCard?.health} testId="azure-health-status" />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" data-testid="azure-save-config" onClick={handleSaveAzure}>
              Save configuration
            </Button>
            <Button size="sm" variant="outline" data-testid="azure-clear-config" onClick={handleClearAzure}>
              Clear configuration
            </Button>
            <Button
              size="sm"
              variant="secondary"
              data-testid="azure-test-connection"
              disabled={testingProvider === 'azure-openai'}
              onClick={() => void runTest('azure-openai')}
            >
              {testingProvider === 'azure-openai' ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

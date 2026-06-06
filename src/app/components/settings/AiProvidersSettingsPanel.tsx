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
  getProviderHealth,
  healthStatusLabel,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ProviderConnectionStatus } from './ProviderConnectionStatus';

type SelectableProvider = 'openai' | 'azure-openai' | 'fixture';

const PROVIDER_LABELS: Record<SelectableProvider, string> = {
  openai: 'OpenAI',
  'azure-openai': 'Azure OpenAI',
  fixture: 'Simulation Mode',
};

const OPENAI_MODEL_PRESETS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4o',
  'gpt-4o-mini',
] as const;

const OPENAI_MODEL_CUSTOM = 'custom';

function normalizeSelectableProvider(providerId: string): SelectableProvider {
  if (providerId === 'openai') return 'openai';
  if (providerId === 'azure-openai') return 'azure-openai';
  return 'fixture';
}

function resolveOpenAiModelSelection(model: string): {
  preset: (typeof OPENAI_MODEL_PRESETS)[number] | typeof OPENAI_MODEL_CUSTOM;
  customModel: string;
} {
  if ((OPENAI_MODEL_PRESETS as readonly string[]).includes(model)) {
    return { preset: model as (typeof OPENAI_MODEL_PRESETS)[number], customModel: '' };
  }
  if (!model || model === DEFAULT_OPENAI_MODEL) {
    return { preset: DEFAULT_OPENAI_MODEL as (typeof OPENAI_MODEL_PRESETS)[number], customModel: '' };
  }
  return { preset: OPENAI_MODEL_CUSTOM, customModel: model };
}

function effectiveOpenAiModel(
  preset: (typeof OPENAI_MODEL_PRESETS)[number] | typeof OPENAI_MODEL_CUSTOM,
  customModel: string,
): string {
  if (preset === OPENAI_MODEL_CUSTOM) {
    return customModel.trim() || DEFAULT_OPENAI_MODEL;
  }
  return preset;
}

export function AiProvidersSettingsPanel() {
  const [revision, setRevision] = useState(0);
  const [testingProvider, setTestingProvider] = useState<SelectableProvider | null>(null);
  const status = useMemo(() => getLlmProviderStatus(), [revision]);

  const [activeTab, setActiveTab] = useState<SelectableProvider>(() =>
    normalizeSelectableProvider(status.activeProviderId),
  );

  const storedOpenAi = useMemo(() => loadOpenAiStoredConfig(), [revision]);
  const storedAzure = useMemo(() => loadAzureOpenAiStoredConfig(), [revision]);

  const [openAiKeyInput, setOpenAiKeyInput] = useState('');
  const [openAiModelPreset, setOpenAiModelPreset] = useState<
    (typeof OPENAI_MODEL_PRESETS)[number] | typeof OPENAI_MODEL_CUSTOM
  >(DEFAULT_OPENAI_MODEL);
  const [openAiCustomModel, setOpenAiCustomModel] = useState('');
  const [openAiOrganization, setOpenAiOrganization] = useState(storedOpenAi?.organization ?? '');
  const [openAiProject, setOpenAiProject] = useState(storedOpenAi?.project ?? '');

  const [azureKeyInput, setAzureKeyInput] = useState('');
  const [azureEndpoint, setAzureEndpoint] = useState(storedAzure?.endpoint ?? '');
  const [azureDeployment, setAzureDeployment] = useState(storedAzure?.deployment ?? '');
  const [azureApiVersion, setAzureApiVersion] = useState(
    storedAzure?.apiVersion ?? DEFAULT_AZURE_API_VERSION,
  );

  const activeHealth = getProviderHealth(normalizeSelectableProvider(status.activeProviderId));
  const openAiModel = effectiveOpenAiModel(openAiModelPreset, openAiCustomModel);

  useEffect(() => {
    const openAi = loadOpenAiStoredConfig();
    const azure = loadAzureOpenAiStoredConfig();
    const modelSelection = resolveOpenAiModelSelection(openAi?.model ?? DEFAULT_OPENAI_MODEL);
    setOpenAiModelPreset(modelSelection.preset);
    setOpenAiCustomModel(modelSelection.customModel);
    setOpenAiOrganization(openAi?.organization ?? '');
    setOpenAiProject(openAi?.project ?? '');
    setAzureEndpoint(azure?.endpoint ?? '');
    setAzureDeployment(azure?.deployment ?? '');
    setAzureApiVersion(azure?.apiVersion ?? DEFAULT_AZURE_API_VERSION);
  }, [revision]);

  const refresh = () => setRevision((value) => value + 1);

  const applyProviderSelection = (providerId: SelectableProvider) => {
    setConfiguredLlmProviderId(providerId);
    refresh();
  };

  const handleSaveOpenAi = () => {
    const existing = loadOpenAiStoredConfig();
    const apiKey = openAiKeyInput.trim() || existing?.apiKey || '';
    if (!apiKey) return;
    saveOpenAiStoredConfig({
      enabled: true,
      apiKey,
      model: openAiModel,
      organization: openAiOrganization.trim() || undefined,
      project: openAiProject.trim() || undefined,
    });
    setOpenAiKeyInput('');
    applyProviderSelection('openai');
  };

  const handleClearOpenAi = () => {
    clearOpenAiStoredConfig();
    setOpenAiKeyInput('');
    setOpenAiModelPreset(DEFAULT_OPENAI_MODEL);
    setOpenAiCustomModel('');
    applyProviderSelection('fixture');
  };

  const handleSaveAzure = () => {
    const existing = loadAzureOpenAiStoredConfig();
    const apiKey = azureKeyInput.trim() || existing?.apiKey || '';
    if (!apiKey || !azureEndpoint.trim() || !azureDeployment.trim()) return;
    saveAzureOpenAiStoredConfig({
      enabled: true,
      apiKey,
      endpoint: azureEndpoint.trim(),
      deployment: azureDeployment.trim(),
      apiVersion: azureApiVersion.trim() || DEFAULT_AZURE_API_VERSION,
    });
    setAzureKeyInput('');
    applyProviderSelection('azure-openai');
  };

  const handleClearAzure = () => {
    clearAzureOpenAiStoredConfig();
    setAzureKeyInput('');
    setAzureEndpoint('');
    setAzureDeployment('');
    setAzureApiVersion(DEFAULT_AZURE_API_VERSION);
    applyProviderSelection('fixture');
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

  const openAiActive = status.activeProviderId === 'openai' && !status.fellBackToFixture;
  const azureActive = status.activeProviderId === 'azure-openai' && !status.fellBackToFixture;
  const simulationActive = status.activeProviderId === 'fixture' || status.fellBackToFixture;

  return (
    <div className="space-y-6 max-w-2xl" data-testid="ai-providers-settings-panel">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Providers
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a provider and configure credentials locally in this browser.
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
        className="rounded-lg border border-border bg-muted/10 p-4 space-y-2"
        data-testid="ai-provider-status-summary"
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Active provider</span>
          <Badge variant="outline" data-testid="ai-active-provider-label">
            {PROVIDER_LABELS[normalizeSelectableProvider(status.activeProviderId)]}
            {status.fellBackToFixture ? ' (fallback)' : ''}
          </Badge>
        </div>
        <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Model</dt>
          <dd className="font-mono" data-testid="ai-active-model-label">
            {status.activeModel}
          </dd>
          <dt className="text-muted-foreground">Connection</dt>
          <dd data-testid="ai-active-connection-label">
            {activeHealth ? healthStatusLabel(activeHealth.status) : 'Not tested'}
            {activeHealth?.testedAt
              ? ` · last tested ${new Date(activeHealth.testedAt).toLocaleString()}`
              : ''}
            {activeHealth?.success ? ` · ${activeHealth.latencyMs} ms` : ''}
          </dd>
        </dl>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SelectableProvider)}
        className="space-y-4"
        data-testid="ai-provider-selection"
      >
        <TabsList className="w-full grid grid-cols-3" data-testid="ai-provider-tabs">
          <TabsTrigger value="openai" data-testid="ai-tab-openai">
            OpenAI
          </TabsTrigger>
          <TabsTrigger value="azure-openai" data-testid="ai-tab-azure-openai">
            Azure OpenAI
          </TabsTrigger>
          <TabsTrigger value="fixture" data-testid="ai-tab-simulation-mode">
            Simulation Mode
          </TabsTrigger>
        </TabsList>

        <TabsContent value="openai" className="space-y-4 mt-0" data-testid="openai-config-form">
          <div className="flex items-center gap-3">
            <Switch
              id="openai-enable"
              checked={openAiActive}
              disabled={!storedOpenAi?.apiKey}
              onCheckedChange={(checked) => {
                if (checked) applyProviderSelection('openai');
                else applyProviderSelection('fixture');
              }}
              data-testid="openai-enable-switch"
            />
            <Label htmlFor="openai-enable" className="font-normal cursor-pointer">
              Use OpenAI provider
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">
            Your API key is stored locally in this browser for development/testing. Production
            deployments should use a secure server-side proxy.
          </p>

          {storedOpenAi?.apiKey ? (
            <p className="text-xs font-mono" data-testid="openai-masked-key">
              Saved key: {maskApiKey(storedOpenAi.apiKey)}
            </p>
          ) : null}

          <div className="grid gap-3">
            <div className="space-y-1">
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
              <Select
                value={openAiModelPreset}
                onValueChange={(value) =>
                  setOpenAiModelPreset(value as (typeof OPENAI_MODEL_PRESETS)[number] | 'custom')
                }
              >
                <SelectTrigger id="openai-model" data-testid="openai-model-select">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_MODEL_PRESETS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                      {model === DEFAULT_OPENAI_MODEL ? ' (recommended)' : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value={OPENAI_MODEL_CUSTOM}>Custom…</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground" data-testid="openai-model-helper">
                Recommended for protocol reconstruction: {DEFAULT_OPENAI_MODEL}.
              </p>
              {openAiModelPreset === OPENAI_MODEL_CUSTOM ? (
                <Input
                  className="mt-2"
                  placeholder="Enter custom model id"
                  value={openAiCustomModel}
                  onChange={(event) => setOpenAiCustomModel(event.target.value)}
                  data-testid="openai-model-input"
                />
              ) : null}
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

            <div className="space-y-1">
              <Label htmlFor="openai-project">Project (optional)</Label>
              <Input
                id="openai-project"
                value={openAiProject}
                onChange={(event) => setOpenAiProject(event.target.value)}
                data-testid="openai-project-input"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" data-testid="openai-save-config" onClick={handleSaveOpenAi}>
              Save configuration
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="openai-clear-config"
              onClick={handleClearOpenAi}
            >
              Clear configuration
            </Button>
          </div>

          <ProviderConnectionStatus
            health={getProviderHealth('openai')}
            modelFallback={openAiModel}
            testId="openai-health-status"
          />

          <Button
            variant="secondary"
            data-testid="openai-test-connection"
            disabled={testingProvider === 'openai'}
            onClick={() => void runTest('openai')}
          >
            {testingProvider === 'openai' ? 'Testing…' : 'Test Connection'}
          </Button>
        </TabsContent>

        <TabsContent
          value="azure-openai"
          className="space-y-4 mt-0"
          data-testid="azure-config-form"
        >
          <div className="flex items-center gap-3">
            <Switch
              id="azure-enable"
              checked={azureActive}
              disabled={!storedAzure?.apiKey}
              onCheckedChange={(checked) => {
                if (checked) applyProviderSelection('azure-openai');
                else applyProviderSelection('fixture');
              }}
              data-testid="azure-enable-switch"
            />
            <Label htmlFor="azure-enable" className="font-normal cursor-pointer">
              Use Azure OpenAI provider
            </Label>
          </div>

          {storedAzure?.apiKey ? (
            <p className="text-xs font-mono" data-testid="azure-masked-key">
              Saved key: {maskApiKey(storedAzure.apiKey)}
            </p>
          ) : null}

          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="azure-api-key">API key</Label>
              <Input
                id="azure-api-key"
                type="password"
                value={azureKeyInput}
                onChange={(event) => setAzureKeyInput(event.target.value)}
                data-testid="azure-api-key-input"
              />
            </div>
            <div className="space-y-1">
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

          <div className="flex flex-wrap gap-2">
            <Button size="sm" data-testid="azure-save-config" onClick={handleSaveAzure}>
              Save configuration
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="azure-clear-config"
              onClick={handleClearAzure}
            >
              Clear configuration
            </Button>
          </div>

          <ProviderConnectionStatus
            health={getProviderHealth('azure-openai')}
            modelFallback={azureDeployment || status.activeModel}
            testId="azure-health-status"
          />

          <Button
            variant="secondary"
            data-testid="azure-test-connection"
            disabled={testingProvider === 'azure-openai'}
            onClick={() => void runTest('azure-openai')}
          >
            {testingProvider === 'azure-openai' ? 'Testing…' : 'Test Connection'}
          </Button>
        </TabsContent>

        <TabsContent
          value="fixture"
          className="space-y-4 mt-0"
          data-testid="ai-provider-card-fixture"
        >
          <p className="text-sm text-muted-foreground">
            Simulation Mode uses deterministic local generation with no network calls. Intended for
            testing and smoke workflows only — not for production protocol reconstruction.
          </p>

          <Button
            size="sm"
            data-testid="fixture-save-config"
            onClick={() => {
              applyProviderSelection('fixture');
              void runTest('fixture');
            }}
          >
            Use Simulation Mode
          </Button>

          {simulationActive ? (
            <p className="text-xs text-muted-foreground" data-testid="simulation-mode-active-hint">
              Simulation Mode is the active provider.
            </p>
          ) : null}

          <ProviderConnectionStatus
            health={getProviderHealth('fixture')}
            modelFallback="fixture-m11-reconstruct-v1"
            testId="fixture-health-status"
          />

          <Button
            variant="secondary"
            data-testid="fixture-test-connection"
            disabled={testingProvider === 'fixture'}
            onClick={() => void runTest('fixture')}
          >
            {testingProvider === 'fixture' ? 'Testing…' : 'Test Connection'}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import {
  DEFAULT_AZURE_API_VERSION,
  DEFAULT_OPENAI_MODEL,
  loadAzureOpenAiStoredConfig,
  loadOpenAiStoredConfig,
  getProviderHealth,
  type LlmProviderHealthRecord,
} from './llmProviderSettings';
import type { LlmProviderConfig, LlmProviderId } from './types';

const PROVIDER_STORAGE_KEY = 'm11-protocol-llm-provider';

const VALID_PROVIDER_IDS: LlmProviderId[] = [
  'openai',
  'azure-openai',
  'anthropic',
  'local',
  'fixture',
];

export type LlmProviderSourceKind =
  | 'UI configuration'
  | 'localStorage override'
  | 'VITE_PROTOCOL_LLM_PROVIDER'
  | 'auto-detected'
  | 'fallback fixture';

export type LlmProviderCardStatus = 'active' | 'available' | 'unavailable';

export interface LlmProviderCardInfo {
  providerId: 'fixture' | 'openai' | 'azure-openai';
  displayName: string;
  status: LlmProviderCardStatus;
  requiredEnvVars: string[];
  modelName?: string;
  description: string;
  apiKeyConfigured: boolean;
  health?: LlmProviderHealthRecord | null;
}

export interface LlmProviderStatusSnapshot {
  activeProviderId: LlmProviderId;
  activeProviderLabel: string;
  activeModel: string;
  providerSource: LlmProviderSourceKind;
  requestedProviderId: LlmProviderId | null;
  fellBackToFixture: boolean;
  apiKeyConfiguredForActive: boolean;
  browserSideApiKeyInUse: boolean;
  credentialsFromUi: boolean;
  providerTestedSuccessfully: boolean;
  cards: LlmProviderCardInfo[];
}

function readEnv(key: string): string | undefined {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function openAiCredentials(): {
  apiKey?: string;
  model: string;
  organization?: string;
  project?: string;
  fromUi: boolean;
} {
  const stored = loadOpenAiStoredConfig();
  if (stored?.apiKey) {
    return {
      apiKey: stored.apiKey,
      model: stored.model || DEFAULT_OPENAI_MODEL,
      organization: stored.organization,
      project: stored.project,
      fromUi: true,
    };
  }
  const envKey = readEnv('VITE_OPENAI_API_KEY');
  return {
    apiKey: envKey,
    model: readEnv('VITE_OPENAI_MODEL') ?? DEFAULT_OPENAI_MODEL,
    fromUi: false,
  };
}

function azureCredentials(): {
  apiKey?: string;
  endpoint?: string;
  deployment?: string;
  apiVersion: string;
  fromUi: boolean;
} {
  const stored = loadAzureOpenAiStoredConfig();
  if (stored?.apiKey) {
    return {
      apiKey: stored.apiKey,
      endpoint: stored.endpoint,
      deployment: stored.deployment,
      apiVersion: stored.apiVersion || DEFAULT_AZURE_API_VERSION,
      fromUi: true,
    };
  }
  return {
    apiKey: readEnv('VITE_AZURE_OPENAI_API_KEY'),
    endpoint: readEnv('VITE_AZURE_OPENAI_ENDPOINT'),
    deployment: readEnv('VITE_AZURE_OPENAI_DEPLOYMENT'),
    apiVersion: DEFAULT_AZURE_API_VERSION,
    fromUi: false,
  };
}

function hasLlmApiKey(providerId: LlmProviderId): boolean {
  if (providerId === 'azure-openai') {
    const creds = azureCredentials();
    return Boolean(creds.apiKey && creds.endpoint && creds.deployment);
  }
  if (providerId === 'openai' || providerId === 'anthropic') {
    return Boolean(openAiCredentials().apiKey);
  }
  return true;
}

function resolveRequestedLlmProviderId(): LlmProviderId | null {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY) as LlmProviderId | null;
    if (stored && VALID_PROVIDER_IDS.includes(stored)) {
      return stored;
    }
  }

  const fromEnv = readEnv('VITE_PROTOCOL_LLM_PROVIDER') as LlmProviderId | undefined;
  if (fromEnv && VALID_PROVIDER_IDS.includes(fromEnv)) {
    return fromEnv;
  }

  if (readEnv('VITE_AZURE_OPENAI_API_KEY')) {
    return 'azure-openai';
  }
  if (readEnv('VITE_OPENAI_API_KEY')) {
    return 'openai';
  }

  return null;
}

export function getConfiguredLlmProviderId(): LlmProviderId {
  const requested = resolveRequestedLlmProviderId();
  if (!requested || requested === 'fixture' || requested === 'local') {
    return 'fixture';
  }

  if (isRealLlmProvider(requested) && !hasLlmApiKey(requested)) {
    return 'fixture';
  }

  return requested;
}

export function setConfiguredLlmProviderId(providerId: LlmProviderId): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PROVIDER_STORAGE_KEY, providerId);
  }
}

export function resolveLlmProviderConfigForProvider(
  providerId: Extract<LlmProviderId, 'openai' | 'azure-openai' | 'fixture'>,
): LlmProviderConfig {
  if (providerId === 'fixture') {
    return { providerId: 'fixture', model: 'fixture-m11-reconstruct-v1' };
  }

  if (providerId === 'azure-openai') {
    const creds = azureCredentials();
    return {
      providerId: 'azure-openai',
      apiKey: creds.apiKey,
      baseUrl: creds.endpoint,
      azureDeployment: creds.deployment,
      azureApiVersion: creds.apiVersion,
      model: creds.deployment,
    };
  }

  const creds = openAiCredentials();
  return {
    providerId: 'openai',
    apiKey: creds.apiKey,
    baseUrl: readEnv('VITE_OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
    model: creds.model,
    organization: creds.organization,
    project: creds.project,
  };
}

export function resolveLlmProviderConfig(): LlmProviderConfig {
  const providerId = getConfiguredLlmProviderId();
  if (providerId === 'azure-openai') {
    return resolveLlmProviderConfigForProvider('azure-openai');
  }
  if (providerId === 'openai') {
    return resolveLlmProviderConfigForProvider('openai');
  }
  return resolveLlmProviderConfigForProvider('fixture');
}

export function isRealLlmProvider(providerId: LlmProviderId): boolean {
  return providerId === 'openai' || providerId === 'azure-openai' || providerId === 'anthropic';
}

function providerDisplayLabel(providerId: LlmProviderId): string {
  switch (providerId) {
    case 'openai':
      return 'OpenAI';
    case 'azure-openai':
      return 'Azure OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'local':
      return 'Simulation Mode';
    default:
      return 'Simulation Mode';
  }
}

function resolveProviderSource(): { source: LlmProviderSourceKind; requested: LlmProviderId | null } {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY) as LlmProviderId | null;
    if (stored && VALID_PROVIDER_IDS.includes(stored)) {
      return { source: 'UI configuration', requested: stored };
    }
  }

  const fromEnv = readEnv('VITE_PROTOCOL_LLM_PROVIDER') as LlmProviderId | undefined;
  if (fromEnv && VALID_PROVIDER_IDS.includes(fromEnv)) {
    return { source: 'VITE_PROTOCOL_LLM_PROVIDER', requested: fromEnv };
  }

  if (readEnv('VITE_AZURE_OPENAI_API_KEY')) {
    return { source: 'auto-detected', requested: 'azure-openai' };
  }
  if (readEnv('VITE_OPENAI_API_KEY')) {
    return { source: 'auto-detected', requested: 'openai' };
  }

  return { source: 'fallback fixture', requested: null };
}

function cardStatus(
  providerId: LlmProviderCardInfo['providerId'],
  activeProviderId: LlmProviderId,
  available: boolean,
): LlmProviderCardStatus {
  const normalizedActive =
    activeProviderId === 'local' || activeProviderId === 'anthropic' ? 'fixture' : activeProviderId;
  if (normalizedActive === providerId) {
    return 'active';
  }
  return available ? 'available' : 'unavailable';
}

function credentialsFromUiForActive(activeProviderId: LlmProviderId): boolean {
  if (activeProviderId === 'openai') return openAiCredentials().fromUi;
  if (activeProviderId === 'azure-openai') return azureCredentials().fromUi;
  return false;
}

/** Read-only snapshot for Settings and import review provider visibility. */
export function getLlmProviderStatus(): LlmProviderStatusSnapshot {
  const config = resolveLlmProviderConfig();
  const activeProviderId = getConfiguredLlmProviderId();
  const { source, requested } = resolveProviderSource();
  const fellBackToFixture =
    activeProviderId === 'fixture' &&
    requested !== null &&
    requested !== 'fixture' &&
    requested !== 'local';

  const openAi = openAiCredentials();
  const azure = azureCredentials();
  const openAiKeyConfigured = Boolean(openAi.apiKey);
  const azureKeyConfigured = Boolean(azure.apiKey && azure.endpoint && azure.deployment);

  const activeModel =
    activeProviderId === 'azure-openai'
      ? config.azureDeployment ?? config.model ?? 'not configured'
      : activeProviderId === 'openai'
        ? config.model ?? DEFAULT_OPENAI_MODEL
        : 'fixture-m11-reconstruct-v1';

  const apiKeyConfiguredForActive =
    activeProviderId === 'azure-openai'
      ? azureKeyConfigured
      : activeProviderId === 'openai' || activeProviderId === 'anthropic'
        ? openAiKeyConfigured
        : false;

  const credentialsFromUi = credentialsFromUiForActive(activeProviderId);
  const browserSideApiKeyInUse =
    isRealLlmProvider(activeProviderId) && apiKeyConfiguredForActive;

  const activeHealth =
    activeProviderId === 'fixture'
      ? getProviderHealth('fixture')
      : isRealLlmProvider(activeProviderId)
        ? getProviderHealth(activeProviderId)
        : null;

  const providerTestedSuccessfully =
    activeProviderId === 'fixture' || activeProviderId === 'local'
      ? true
      : Boolean(activeHealth?.lastSuccessAt);

  const cards: LlmProviderCardInfo[] = [
    {
      providerId: 'fixture',
      displayName: 'Simulation Mode',
      status: cardStatus('fixture', activeProviderId, true),
      requiredEnvVars: [],
      modelName: 'fixture-m11-reconstruct-v1',
      description:
        'Deterministic development/smoke provider. No network calls; safe default when no API key is configured.',
      apiKeyConfigured: true,
      health: getProviderHealth('fixture'),
    },
    {
      providerId: 'openai',
      displayName: 'OpenAI Provider',
      status: cardStatus('openai', activeProviderId, openAiKeyConfigured),
      requiredEnvVars: ['VITE_OPENAI_API_KEY (optional if configured in UI)', 'VITE_OPENAI_MODEL (optional)'],
      modelName: openAi.model,
      description: 'Live OpenAI chat completions for protocol understanding and M11 section reconstruction.',
      apiKeyConfigured: openAiKeyConfigured,
      health: getProviderHealth('openai'),
    },
    {
      providerId: 'azure-openai',
      displayName: 'Azure OpenAI Provider',
      status: cardStatus('azure-openai', activeProviderId, azureKeyConfigured),
      requiredEnvVars: [
        'VITE_AZURE_OPENAI_API_KEY (optional if configured in UI)',
        'VITE_AZURE_OPENAI_ENDPOINT',
        'VITE_AZURE_OPENAI_DEPLOYMENT',
      ],
      modelName: azure.deployment,
      description: 'Azure-hosted OpenAI deployment for protocol understanding and M11 reconstruction.',
      apiKeyConfigured: azureKeyConfigured,
      health: getProviderHealth('azure-openai'),
    },
  ];

  return {
    activeProviderId,
    activeProviderLabel: providerDisplayLabel(activeProviderId),
    activeModel,
    providerSource: fellBackToFixture ? 'Simulation Mode fallback' : source,
    requestedProviderId: requested,
    fellBackToFixture,
    apiKeyConfiguredForActive,
    browserSideApiKeyInUse,
    credentialsFromUi,
    providerTestedSuccessfully,
    cards,
  };
}

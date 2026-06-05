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
  cards: LlmProviderCardInfo[];
}

function readEnv(key: string): string | undefined {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function hasLlmApiKey(providerId: LlmProviderId): boolean {
  if (providerId === 'azure-openai') {
    return Boolean(readEnv('VITE_AZURE_OPENAI_API_KEY') && readEnv('VITE_AZURE_OPENAI_DEPLOYMENT'));
  }
  if (providerId === 'openai' || providerId === 'anthropic') {
    return Boolean(readEnv('VITE_OPENAI_API_KEY'));
  }
  return true;
}

function resolveRequestedLlmProviderId(): LlmProviderId | null {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY) as LlmProviderId | null;
    if (
      stored &&
      ['openai', 'azure-openai', 'anthropic', 'local', 'fixture'].includes(stored)
    ) {
      return stored;
    }
  }

  const fromEnv = readEnv('VITE_PROTOCOL_LLM_PROVIDER') as LlmProviderId | undefined;
  if (fromEnv && ['openai', 'azure-openai', 'anthropic', 'local', 'fixture'].includes(fromEnv)) {
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

export function resolveLlmProviderConfig(): LlmProviderConfig {
  const providerId = getConfiguredLlmProviderId();
  const openAiKey = readEnv('VITE_OPENAI_API_KEY');
  const azureKey = readEnv('VITE_AZURE_OPENAI_API_KEY');

  return {
    providerId,
    apiKey: providerId === 'azure-openai' ? azureKey : openAiKey,
    baseUrl:
      providerId === 'azure-openai'
        ? readEnv('VITE_AZURE_OPENAI_ENDPOINT')
        : readEnv('VITE_OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
    model: readEnv('VITE_OPENAI_MODEL') ?? 'gpt-4o-mini',
    azureDeployment: readEnv('VITE_AZURE_OPENAI_DEPLOYMENT'),
  };
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
      return 'Fixture';
    default:
      return 'Fixture';
  }
}

function resolveProviderSource(): { source: LlmProviderSourceKind; requested: LlmProviderId | null } {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY) as LlmProviderId | null;
    if (stored && VALID_PROVIDER_IDS.includes(stored)) {
      return { source: 'localStorage override', requested: stored };
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
  const openAiKeyConfigured = Boolean(readEnv('VITE_OPENAI_API_KEY'));
  const azureKeyConfigured = Boolean(
    readEnv('VITE_AZURE_OPENAI_API_KEY') && readEnv('VITE_AZURE_OPENAI_DEPLOYMENT'),
  );

  const activeModel =
    activeProviderId === 'azure-openai'
      ? config.azureDeployment ?? config.model ?? 'not configured'
      : activeProviderId === 'openai'
        ? config.model ?? 'gpt-4o-mini'
        : 'fixture-m11-reconstruct-v1';

  const apiKeyConfiguredForActive =
    activeProviderId === 'azure-openai'
      ? azureKeyConfigured
      : activeProviderId === 'openai' || activeProviderId === 'anthropic'
        ? openAiKeyConfigured
        : false;

  const browserSideApiKeyInUse =
    isRealLlmProvider(activeProviderId) && apiKeyConfiguredForActive;

  const cards: LlmProviderCardInfo[] = [
    {
      providerId: 'fixture',
      displayName: 'Fixture Provider',
      status: cardStatus('fixture', activeProviderId, true),
      requiredEnvVars: [],
      modelName: 'fixture-m11-reconstruct-v1',
      description:
        'Deterministic development/smoke provider. No network calls; safe default when no API key is configured.',
      apiKeyConfigured: true,
    },
    {
      providerId: 'openai',
      displayName: 'OpenAI Provider',
      status: cardStatus('openai', activeProviderId, openAiKeyConfigured),
      requiredEnvVars: ['VITE_OPENAI_API_KEY', 'VITE_OPENAI_MODEL (optional)'],
      modelName: readEnv('VITE_OPENAI_MODEL') ?? 'gpt-4o-mini',
      description: 'Live OpenAI chat completions for protocol understanding and M11 section reconstruction.',
      apiKeyConfigured: openAiKeyConfigured,
    },
    {
      providerId: 'azure-openai',
      displayName: 'Azure OpenAI Provider',
      status: cardStatus('azure-openai', activeProviderId, azureKeyConfigured),
      requiredEnvVars: [
        'VITE_AZURE_OPENAI_API_KEY',
        'VITE_AZURE_OPENAI_ENDPOINT',
        'VITE_AZURE_OPENAI_DEPLOYMENT',
      ],
      modelName: readEnv('VITE_AZURE_OPENAI_DEPLOYMENT') ?? undefined,
      description: 'Azure-hosted OpenAI deployment for protocol understanding and M11 reconstruction.',
      apiKeyConfigured: azureKeyConfigured,
    },
  ];

  return {
    activeProviderId,
    activeProviderLabel: providerDisplayLabel(activeProviderId),
    activeModel,
    providerSource: fellBackToFixture ? 'fallback fixture' : source,
    requestedProviderId: requested,
    fellBackToFixture,
    apiKeyConfiguredForActive,
    browserSideApiKeyInUse,
    cards,
  };
}

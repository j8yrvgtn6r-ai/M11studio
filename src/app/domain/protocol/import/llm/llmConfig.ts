import type { LlmProviderConfig, LlmProviderId } from './types';

const PROVIDER_STORAGE_KEY = 'm11-protocol-llm-provider';

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

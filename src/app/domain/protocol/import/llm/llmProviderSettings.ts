import type { LlmProviderId } from './types';

const OPENAI_CONFIG_KEY = 'm11-protocol-openai-config-v1';
const AZURE_CONFIG_KEY = 'm11-protocol-azure-openai-config-v1';
const HEALTH_KEY = 'm11-protocol-llm-health-v1';

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_AZURE_API_VERSION = '2024-02-15-preview';

export interface OpenAiStoredConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  organization?: string;
  project?: string;
  updatedAt: string;
}

export interface AzureOpenAiStoredConfig {
  enabled: boolean;
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
  updatedAt: string;
}

export type LlmHealthStatusKind =
  | 'connected'
  | 'disconnected'
  | 'configuration-error'
  | 'authentication-error'
  | 'rate-limit-error'
  | 'unknown-error';

export interface LlmProviderHealthRecord {
  providerId: 'openai' | 'azure-openai' | 'fixture';
  status: LlmHealthStatusKind;
  success: boolean;
  model?: string;
  latencyMs: number;
  errorMessage?: string;
  testedAt: string;
  lastSuccessAt?: string;
}

export interface LlmHealthStorage {
  openai?: LlmProviderHealthRecord;
  'azure-openai'?: LlmProviderHealthRecord;
  fixture?: LlmProviderHealthRecord;
}

function readJson<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '••••••••';
  const prefix = apiKey.startsWith('sk-') ? 'sk-' : apiKey.slice(0, 3);
  return `${prefix}••••••••${apiKey.slice(-4)}`;
}

export function loadOpenAiStoredConfig(): OpenAiStoredConfig | null {
  return readJson<OpenAiStoredConfig>(OPENAI_CONFIG_KEY);
}

export function saveOpenAiStoredConfig(
  config: Omit<OpenAiStoredConfig, 'updatedAt'> & { updatedAt?: string },
): OpenAiStoredConfig {
  const saved: OpenAiStoredConfig = {
    ...config,
    model: config.model.trim() || DEFAULT_OPENAI_MODEL,
    updatedAt: config.updatedAt ?? new Date().toISOString(),
  };
  writeJson(OPENAI_CONFIG_KEY, saved);
  return saved;
}

export function clearOpenAiStoredConfig(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(OPENAI_CONFIG_KEY);
  clearProviderHealth('openai');
}

export function loadAzureOpenAiStoredConfig(): AzureOpenAiStoredConfig | null {
  return readJson<AzureOpenAiStoredConfig>(AZURE_CONFIG_KEY);
}

export function saveAzureOpenAiStoredConfig(
  config: Omit<AzureOpenAiStoredConfig, 'updatedAt'> & { updatedAt?: string },
): AzureOpenAiStoredConfig {
  const saved: AzureOpenAiStoredConfig = {
    ...config,
    apiVersion: config.apiVersion.trim() || DEFAULT_AZURE_API_VERSION,
    updatedAt: config.updatedAt ?? new Date().toISOString(),
  };
  writeJson(AZURE_CONFIG_KEY, saved);
  return saved;
}

export function clearAzureOpenAiStoredConfig(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(AZURE_CONFIG_KEY);
  clearProviderHealth('azure-openai');
}

export function loadLlmHealthStorage(): LlmHealthStorage {
  return readJson<LlmHealthStorage>(HEALTH_KEY) ?? {};
}

export function saveProviderHealth(record: LlmProviderHealthRecord): void {
  const current = loadLlmHealthStorage();
  if (record.providerId === 'fixture') {
    current.fixture = record;
  } else {
    current[record.providerId] = record;
  }
  writeJson(HEALTH_KEY, current);
}

export function getProviderHealth(
  providerId: 'openai' | 'azure-openai' | 'fixture',
): LlmProviderHealthRecord | null {
  const storage = loadLlmHealthStorage();
  return storage[providerId] ?? null;
}

export function clearProviderHealth(providerId: 'openai' | 'azure-openai' | 'fixture'): void {
  const current = loadLlmHealthStorage();
  delete current[providerId];
  writeJson(HEALTH_KEY, current);
}

export function hasSuccessfulProviderTest(providerId: LlmProviderId): boolean {
  if (providerId === 'fixture' || providerId === 'local') {
    return true;
  }
  const health = getProviderHealth(providerId);
  return Boolean(health?.lastSuccessAt);
}

export function healthStatusLabel(status: LlmHealthStatusKind): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Disconnected';
    case 'configuration-error':
      return 'Configuration error';
    case 'authentication-error':
      return 'Authentication error';
    case 'rate-limit-error':
      return 'Rate limit / quota error';
    default:
      return 'Unknown error';
  }
}

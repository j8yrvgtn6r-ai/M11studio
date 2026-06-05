import { callOpenAiChat } from './openAiClient';
import {
  getProviderHealth,
  saveProviderHealth,
  type LlmHealthStatusKind,
  type LlmProviderHealthRecord,
} from './llmProviderSettings';
import { resolveLlmProviderConfigForProvider } from './llmConfig';
import type { LlmProviderId } from './types';

function classifyHealthError(status: number, message: string): LlmHealthStatusKind {
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes('invalid api key') || lower.includes('incorrect api key')) {
    return 'authentication-error';
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('quota')) {
    return 'rate-limit-error';
  }
  if (
    status === 400 ||
    status === 404 ||
    lower.includes('deployment') ||
    lower.includes('endpoint') ||
    lower.includes('not found')
  ) {
    return 'configuration-error';
  }
  if (status === 0 || lower.includes('failed to fetch') || lower.includes('network')) {
    return 'disconnected';
  }
  return 'unknown-error';
}

function buildHealthRecord(
  providerId: LlmProviderHealthRecord['providerId'],
  success: boolean,
  latencyMs: number,
  options: {
    status: LlmHealthStatusKind;
    model?: string;
    errorMessage?: string;
    previousSuccessAt?: string;
  },
): LlmProviderHealthRecord {
  const testedAt = new Date().toISOString();
  return {
    providerId,
    status: options.status,
    success,
    model: options.model,
    latencyMs,
    errorMessage: options.errorMessage,
    testedAt,
    lastSuccessAt: success ? testedAt : options.previousSuccessAt,
  };
}

/** Minimal non-protocol health probe — never sends uploaded protocol content. */
export async function testLlmProviderConnection(
  providerId: Extract<LlmProviderId, 'openai' | 'azure-openai' | 'fixture'>,
): Promise<LlmProviderHealthRecord> {
  const previous = getProviderHealth(providerId);
  const started = performance.now();

  if (providerId === 'fixture') {
    const record = buildHealthRecord('fixture', true, 0, {
      status: 'connected',
      model: 'fixture-m11-reconstruct-v1',
      previousSuccessAt: previous?.lastSuccessAt,
    });
    saveProviderHealth(record);
    return record;
  }

  try {
    const config = resolveLlmProviderConfigForProvider(providerId);
    if (!config.apiKey) {
      const record = buildHealthRecord(providerId, false, Math.round(performance.now() - started), {
        status: 'configuration-error',
        errorMessage: 'API key is not configured.',
        previousSuccessAt: previous?.lastSuccessAt,
      });
      saveProviderHealth(record);
      return record;
    }

    if (providerId === 'azure-openai' && (!config.baseUrl || !config.azureDeployment)) {
      const record = buildHealthRecord(providerId, false, Math.round(performance.now() - started), {
        status: 'configuration-error',
        errorMessage: 'Azure endpoint and deployment are required.',
        previousSuccessAt: previous?.lastSuccessAt,
      });
      saveProviderHealth(record);
      return record;
    }

    const result = await callOpenAiChat(
      config,
      [
        {
          role: 'system',
          content: 'You are a connectivity health check. Reply with the single word OK.',
        },
        { role: 'user', content: 'ping' },
      ],
      { temperature: 0, jsonMode: false },
    );

    const record = buildHealthRecord(providerId, true, Math.round(performance.now() - started), {
      status: 'connected',
      model: result.model,
      previousSuccessAt: previous?.lastSuccessAt,
    });
    saveProviderHealth(record);
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed.';
    const statusMatch = message.match(/\((\d{3})\)/);
    const httpStatus = statusMatch ? Number(statusMatch[1]) : 0;
    const status = classifyHealthError(httpStatus, message);
    const record = buildHealthRecord(providerId, false, Math.round(performance.now() - started), {
      status,
      errorMessage: message,
      previousSuccessAt: previous?.lastSuccessAt,
    });
    saveProviderHealth(record);
    return record;
  }
}

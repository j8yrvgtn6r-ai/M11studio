import type { LlmProviderConfig } from './types';
import type { OpenAiChatMessage } from './types';

export interface OpenAiChatCompletionRequest {
  model?: string;
  messages: OpenAiChatMessage[];
  temperature?: number;
  response_format?: { type: 'json_object' };
}

/** Model id used for request compatibility (OpenAI model id or Azure deployment name). */
export function resolveOpenAiModelId(config: LlmProviderConfig): string {
  return (config.model ?? config.azureDeployment ?? '').trim();
}

export function isGpt5FamilyModel(modelId: string): boolean {
  return modelId.toLowerCase().startsWith('gpt-5');
}

export function isGpt4FamilyModel(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return normalized.startsWith('gpt-4') || normalized.startsWith('gpt-4o');
}

/**
 * GPT-5 models reject non-default temperature values (including 0).
 * Omit the field entirely so OpenAI uses its default (1).
 */
export function resolveTemperatureForModel(
  modelId: string,
  requestedTemperature?: number,
): number | undefined {
  if (isGpt5FamilyModel(modelId)) {
    return undefined;
  }

  if (isGpt4FamilyModel(modelId)) {
    return requestedTemperature ?? 0.2;
  }

  return requestedTemperature ?? 0.2;
}

export function buildOpenAiChatCompletionBody(
  config: LlmProviderConfig,
  messages: OpenAiChatMessage[],
  options?: { jsonMode?: boolean; temperature?: number },
): OpenAiChatCompletionRequest {
  const isAzure = config.providerId === 'azure-openai';
  const modelId = resolveOpenAiModelId(config);
  const body: OpenAiChatCompletionRequest = {
    model: isAzure ? undefined : config.model,
    messages,
  };

  const temperature = resolveTemperatureForModel(modelId, options?.temperature);
  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  return body;
}

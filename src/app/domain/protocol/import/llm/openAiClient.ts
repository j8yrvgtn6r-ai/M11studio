import { buildOpenAiChatCompletionBody } from './openAiRequestCompat';
import {
  fetchWithLlmTimeout,
  formatLlmUserError,
  ImportProcessingAbortedError,
  LlmRequestTimeoutError,
  type LlmRequestOperation,
} from './llmRequestTimeouts';
import type { LlmProviderConfig } from './types';
import type { OpenAiChatMessage } from './types';

export interface OpenAiChatResult {
  content: string;
  model: string;
}

export interface OpenAiChatOptions {
  jsonMode?: boolean;
  temperature?: number;
  signal?: AbortSignal;
  operation?: LlmRequestOperation;
  timeoutMs?: number;
}

export async function callOpenAiChat(
  config: LlmProviderConfig,
  messages: OpenAiChatMessage[],
  options?: OpenAiChatOptions,
): Promise<OpenAiChatResult> {
  if (!config.apiKey) {
    throw new Error('LLM API key is not configured. Set VITE_OPENAI_API_KEY or choose the fixture provider.');
  }

  const operation = options?.operation ?? 'sectionGeneration';
  const isAzure = config.providerId === 'azure-openai';
  const apiVersion = config.azureApiVersion ?? '2024-02-15-preview';
  const url = isAzure
    ? `${config.baseUrl?.replace(/\/$/, '')}/openai/deployments/${config.azureDeployment}/chat/completions?api-version=${apiVersion}`
    : `${config.baseUrl?.replace(/\/$/, '')}/chat/completions`;

  const requestBody = buildOpenAiChatCompletionBody(config, messages, options);

  try {
    const response = await fetchWithLlmTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          ...(isAzure ? { 'api-key': config.apiKey } : {}),
          ...(config.organization ? { 'OpenAI-Organization': config.organization } : {}),
          ...(config.project ? { 'OpenAI-Project': config.project } : {}),
        },
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      },
      operation,
      options?.timeoutMs,
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${body.slice(0, 400)}`);
    }

    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('LLM returned an empty response.');
    }

    return {
      content,
      model: payload.model ?? config.model ?? 'unknown',
    };
  } catch (error) {
    if (error instanceof ImportProcessingAbortedError || error instanceof LlmRequestTimeoutError) {
      throw error;
    }
    throw new Error(formatLlmUserError(error));
  }
}

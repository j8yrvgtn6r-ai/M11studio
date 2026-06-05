import type { LlmProviderConfig } from './types';
import type { OpenAiChatMessage } from './types';

export interface OpenAiChatResult {
  content: string;
  model: string;
}

export async function callOpenAiChat(
  config: LlmProviderConfig,
  messages: OpenAiChatMessage[],
  options?: { jsonMode?: boolean; temperature?: number },
): Promise<OpenAiChatResult> {
  if (!config.apiKey) {
    throw new Error('LLM API key is not configured. Set VITE_OPENAI_API_KEY or choose the fixture provider.');
  }

  const isAzure = config.providerId === 'azure-openai';
  const url = isAzure
    ? `${config.baseUrl?.replace(/\/$/, '')}/openai/deployments/${config.azureDeployment}/chat/completions?api-version=2024-02-15-preview`
    : `${config.baseUrl?.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(isAzure ? { 'api-key': config.apiKey } : {}),
    },
    body: JSON.stringify({
      model: isAzure ? undefined : config.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
    }),
  });

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
}

/**
 * Asserts OpenAI chat completion payload compatibility for GPT-5 vs GPT-4 families.
 * Run: npx vite-node scripts/verify-openai-request-compat.ts
 */
import {
  buildOpenAiChatCompletionBody,
  isGpt4FamilyModel,
  isGpt5FamilyModel,
  resolveTemperatureForModel,
} from '../src/app/domain/protocol/import/llm/openAiRequestCompat';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const messages = [{ role: 'user' as const, content: 'ping' }];

assert(isGpt5FamilyModel('gpt-5'), 'gpt-5 should match GPT-5 family');
assert(isGpt5FamilyModel('gpt-5-mini'), 'gpt-5-mini should match GPT-5 family');
assert(!isGpt5FamilyModel('gpt-4o'), 'gpt-4o should not match GPT-5 family');

assert(isGpt4FamilyModel('gpt-4o'), 'gpt-4o should match GPT-4 family');
assert(isGpt4FamilyModel('gpt-4o-mini'), 'gpt-4o-mini should match GPT-4 family');
assert(isGpt4FamilyModel('gpt-4'), 'gpt-4 should match GPT-4 family');

assert(resolveTemperatureForModel('gpt-5', 0) === undefined, 'GPT-5 must omit temperature');
assert(resolveTemperatureForModel('gpt-5-mini', 0.25) === undefined, 'GPT-5 mini must omit temperature');
assert(resolveTemperatureForModel('gpt-4o-mini', 0.1) === 0.1, 'GPT-4 should keep requested temperature');
assert(resolveTemperatureForModel('gpt-4o-mini') === 0.2, 'GPT-4 should default temperature to 0.2');

const gpt5HealthBody = buildOpenAiChatCompletionBody(
  { providerId: 'openai', model: 'gpt-5', apiKey: 'test' },
  messages,
  { temperature: 0, jsonMode: false },
);
assert(!('temperature' in gpt5HealthBody), 'GPT-5 health payload must not include temperature');
assert(gpt5HealthBody.model === 'gpt-5', 'GPT-5 health payload must include model');
assert(!gpt5HealthBody.response_format, 'GPT-5 health payload must not set response_format');

const gpt5JsonBody = buildOpenAiChatCompletionBody(
  { providerId: 'openai', model: 'gpt-5', apiKey: 'test' },
  messages,
  { temperature: 0.25, jsonMode: true },
);
assert(!('temperature' in gpt5JsonBody), 'GPT-5 JSON payload must not include temperature');
assert(gpt5JsonBody.response_format?.type === 'json_object', 'GPT-5 JSON payload must use json_object');

const gpt4Body = buildOpenAiChatCompletionBody(
  { providerId: 'openai', model: 'gpt-4o-mini', apiKey: 'test' },
  messages,
  { temperature: 0.1, jsonMode: true },
);
assert(gpt4Body.temperature === 0.1, 'GPT-4 payload must preserve temperature');
assert(gpt4Body.response_format?.type === 'json_object', 'GPT-4 JSON payload must use json_object');

const azureGpt5Body = buildOpenAiChatCompletionBody(
  {
    providerId: 'azure-openai',
    model: 'gpt-5',
    azureDeployment: 'gpt-5',
    apiKey: 'test',
    baseUrl: 'https://example.openai.azure.com',
  },
  messages,
  { temperature: 0 },
);
assert(azureGpt5Body.model === undefined, 'Azure payload must omit model field');
assert(!('temperature' in azureGpt5Body), 'Azure GPT-5 deployment must omit temperature');

console.log('OpenAI request compatibility verification: PASS');

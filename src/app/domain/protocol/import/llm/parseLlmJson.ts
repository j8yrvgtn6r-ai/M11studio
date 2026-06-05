export function parseLlmJson<T>(content: string): T {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonText) as T;
}

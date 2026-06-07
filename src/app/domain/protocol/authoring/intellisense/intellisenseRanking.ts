import type {
  ProtocolIntellisenseContext,
  ProtocolIntellisenseKind,
  ProtocolIntellisenseSuggestion,
} from './intellisenseTypes';

const KIND_PRIORITY: Record<ProtocolIntellisenseKind, number> = {
  terminology: 100,
  synonym: 95,
  knowledgeEntity: 85,
  objective: 80,
  endpoint: 80,
  estimand: 78,
  population: 75,
  intervention: 74,
  arm: 72,
  assessment: 70,
  visit: 68,
  soa: 66,
  phrase: 55,
  ghostText: 40,
};

function suggestionKey(suggestion: ProtocolIntellisenseSuggestion): string {
  return `${suggestion.insertText.toLowerCase().trim()}:${suggestion.label.toLowerCase().trim()}`;
}

function prefixBoost(label: string, query: string): number {
  const lowerLabel = label.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) {
    return 0;
  }
  if (lowerLabel === lowerQuery) {
    return 30;
  }
  if (lowerLabel.startsWith(lowerQuery)) {
    return 20;
  }
  if (lowerLabel.includes(lowerQuery)) {
    return 8;
  }
  return 0;
}

export function rankIntellisenseSuggestion(
  suggestion: ProtocolIntellisenseSuggestion,
  context: ProtocolIntellisenseContext,
): number {
  const query = context.explicitQuery ?? context.currentToken;
  let score = suggestion.score + (KIND_PRIORITY[suggestion.kind] ?? 0) / 100;
  score += prefixBoost(suggestion.label, query);
  score += prefixBoost(suggestion.insertText, query);
  if (context.trigger === 'explicit') {
    score += 5;
  }
  return score;
}

export function rankAndDedupeIntellisenseSuggestions(
  suggestions: ProtocolIntellisenseSuggestion[],
  context: ProtocolIntellisenseContext,
): ProtocolIntellisenseSuggestion[] {
  const byKey = new Map<string, ProtocolIntellisenseSuggestion>();
  for (const suggestion of suggestions) {
    if (suggestion.kind === 'ghostText') {
      continue;
    }
    const key = suggestionKey(suggestion);
    const ranked = { ...suggestion, score: rankIntellisenseSuggestion(suggestion, context) };
    const existing = byKey.get(key);
    if (!existing || ranked.score > existing.score) {
      byKey.set(key, ranked);
    }
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score);
}

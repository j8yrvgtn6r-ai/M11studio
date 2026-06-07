import { searchTerminology } from '../../../terminology/terminologyService';
import type { ProtocolIntellisenseContext, ProtocolIntellisenseSuggestion } from './intellisenseTypes';
import { getPhraseRangeAtOffset, getTokenRangeAtOffset } from './textRange';

const PHRASE_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'this',
  'that',
  'these',
  'those',
  'is',
  'are',
  'was',
  'were',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'and',
  'or',
  'with',
  'use',
  'uses',
  'using',
]);

function resolveTerminologySearchQuery(context: ProtocolIntellisenseContext, query: string): string {
  const phrase = getPhraseRangeAtOffset(context.currentText, context.cursorOffset);
  if (!phrase?.text.includes(' ')) {
    return query;
  }
  const words = phrase.text.split(/\s+/);
  if (words.length < 2 || words.length > 5) {
    return query;
  }
  if (words[words.length - 1]?.toLowerCase() !== query.toLowerCase()) {
    return query;
  }
  if (words.some((word, index) => index < words.length - 1 && PHRASE_STOP_WORDS.has(word.toLowerCase()))) {
    return query;
  }
  return phrase.text;
}

function resolveReplacementRange(
  context: ProtocolIntellisenseContext,
  matchedQuery: string,
  isMultiWordSynonym: boolean,
): ProtocolIntellisenseSuggestion['replacementRange'] {
  if (isMultiWordSynonym) {
    const phrase = getPhraseRangeAtOffset(context.currentText, context.cursorOffset);
    if (phrase && phrase.text.toLowerCase().includes(matchedQuery.toLowerCase())) {
      return { startOffset: phrase.startOffset, endOffset: phrase.endOffset };
    }
  }
  const token = getTokenRangeAtOffset(context.currentText, context.cursorOffset);
  if (token) {
    return { startOffset: token.startOffset, endOffset: token.endOffset };
  }
  return undefined;
}

export function terminologyCompletionProvider(
  context: ProtocolIntellisenseContext,
): ProtocolIntellisenseSuggestion[] {
  const query = (context.explicitQuery ?? context.currentToken).trim();
  if (query.length < 2 && context.trigger !== 'explicit') {
    return [];
  }

  const searchQuery = resolveTerminologySearchQuery(context, query);
  const result = searchTerminology(searchQuery);
  const suggestions: ProtocolIntellisenseSuggestion[] = [];

  for (const match of result.matches.slice(0, 8)) {
    const preferred = match.entry.ichPreferredTerm || match.entry.preferredTerm;
    const isSynonym =
      match.entry.preferredTerm.toLowerCase() !== searchQuery.toLowerCase() &&
      match.entry.synonyms.some((synonym) => synonym.toLowerCase().includes(searchQuery.toLowerCase()));
    const isMultiWord = searchQuery.includes(' ') || isSynonym;
    suggestions.push({
      id: `term.${match.entry.code ?? match.entry.preferredTerm}.${match.entry.codelistId ?? match.entry.codelistName}`,
      label: preferred,
      insertText: preferred,
      detail: match.entry.codelistName,
      description: match.entry.definition,
      kind: isSynonym ? 'synonym' : 'terminology',
      source: 'm11Terminology',
      score: match.score / 100 + (isSynonym ? 12 : 10),
      replacementRange: resolveReplacementRange(context, searchQuery, isMultiWord),
      metadata: {
        code: match.entry.code ?? '',
        codelistId: match.entry.codelistId ?? '',
        codelistName: match.entry.codelistName,
        originalQuery: searchQuery,
      },
    });
  }

  return suggestions;
}

import { entityCompletionProvider } from '../../entities/entityCompletionProvider';
import { getKnowledgeGraph } from '../../../knowledge-graph/knowledgeGraphStore';
import { getSoAKnowledge } from '../../../soa-knowledge/soaKnowledgeStore';
import { getStudyModel } from '../../../study-model/studyModelStore';
import { ghostTextProvider, selectGhostTextSuggestion } from './ghostTextProvider';
import type {
  ProtocolIntellisenseContext,
  ProtocolIntellisenseResult,
  ProtocolIntellisenseSuggestion,
} from './intellisenseTypes';
import { rankAndDedupeIntellisenseSuggestions } from './intellisenseRanking';
import { getSectionContextBoost, sectionContextCompletionProvider } from './sectionContextCompletionProvider';
import { terminologyCompletionProvider } from './terminologyCompletionProvider';
import { getLineAtOffset, getNearbyText, getTokenRangeAtOffset } from './textRange';

export interface BuildIntellisenseContextInput {
  sectionId: string;
  sectionTitle?: string;
  currentText: string;
  cursorOffset: number;
  trigger?: ProtocolIntellisenseContext['trigger'];
  explicitQuery?: string;
  knowledgeGraph?: ProtocolIntellisenseContext['knowledgeGraph'];
  studyModel?: ProtocolIntellisenseContext['studyModel'];
  soaKnowledge?: ProtocolIntellisenseContext['soaKnowledge'];
}

export function buildProtocolIntellisenseContext(input: BuildIntellisenseContextInput): ProtocolIntellisenseContext {
  const token = getTokenRangeAtOffset(input.currentText, input.cursorOffset);
  return {
    sectionId: input.sectionId,
    sectionTitle: input.sectionTitle,
    currentText: input.currentText,
    cursorOffset: input.cursorOffset,
    currentToken: input.explicitQuery ?? token?.text ?? '',
    currentLine: getLineAtOffset(input.currentText, input.cursorOffset),
    nearbyText: getNearbyText(input.currentText, input.cursorOffset),
    knowledgeGraph: input.knowledgeGraph ?? getKnowledgeGraph(),
    studyModel: input.studyModel ?? getStudyModel(),
    soaKnowledge: input.soaKnowledge ?? getSoAKnowledge(),
    trigger: input.trigger ?? 'typing',
    explicitQuery: input.explicitQuery,
  };
}

export function getProtocolIntellisenseSuggestions(
  context: ProtocolIntellisenseContext,
): ProtocolIntellisenseResult {
  const raw: ProtocolIntellisenseSuggestion[] = [
    ...entityCompletionProvider(context),
    ...terminologyCompletionProvider(context),
    ...sectionContextCompletionProvider(context),
  ].map((suggestion) => ({
    ...suggestion,
    score: suggestion.score + getSectionContextBoost(context, suggestion.kind) / 10,
  }));

  const ghostCandidates = ghostTextProvider(context);
  const suggestions = rankAndDedupeIntellisenseSuggestions(raw, context).slice(0, 8);
  const ghostText = selectGhostTextSuggestion(ghostCandidates);

  return { suggestions, ghostText };
}

export function findIntellisenseSuggestionForFix(
  context: ProtocolIntellisenseContext,
  suggestedFix: string,
): ProtocolIntellisenseSuggestion | null {
  const explicitContext = {
    ...context,
    explicitQuery: suggestedFix,
    trigger: 'explicit' as const,
  };
  const { suggestions } = getProtocolIntellisenseSuggestions(explicitContext);
  const normalized = suggestedFix.trim().toLowerCase();
  return (
    suggestions.find(
      (entry) =>
        entry.insertText.toLowerCase() === normalized ||
        entry.label.toLowerCase() === normalized ||
        entry.insertText.toLowerCase().includes(normalized),
    ) ?? suggestions[0] ??
    null
  );
}

export function applyIntellisenseSuggestion(
  text: string,
  suggestion: ProtocolIntellisenseSuggestion,
  fallbackRange?: { startOffset: number; endOffset: number },
): string {
  const range = suggestion.replacementRange ?? fallbackRange;
  if (!range) {
    return `${text}${suggestion.insertText}`;
  }
  return `${text.slice(0, range.startOffset)}${suggestion.insertText}${text.slice(range.endOffset)}`;
}

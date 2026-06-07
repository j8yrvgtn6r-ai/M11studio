import type { TerminologyAcceptanceRecord } from '../import/types';
import { getProtocolImportState, updateSectionImportDraft } from '../import/protocolImportStore';
import type { TerminologySuggestion } from './editorIntegration';
import { searchTerminology, findTerm } from '../../terminology/terminologyService';

export interface TokenRange {
  token: string;
  startOffset: number;
  endOffset: number;
}

export interface TerminologyHoverInfo {
  term: string;
  preferredTerm: string;
  code?: string;
  codelistName: string;
  codelistId?: string;
  definition: string;
  synonyms: string[];
  isSynonymMatch: boolean;
  suggestedPreferredTerm?: string;
}

/** Extracts the word/token immediately before the caret in plain text. */
export function getTokenAtOffset(text: string, offset: number): TokenRange | null {
  const before = text.slice(0, offset);
  const match = /([A-Za-z0-9][A-Za-z0-9\-_/]*)\s*$/.exec(before);
  if (!match?.[1] || match[1].length < 2) {
    return null;
  }
  const token = match[1];
  return {
    token,
    startOffset: offset - token.length,
    endOffset: offset,
  };
}

export function recordTerminologyAcceptance(
  sectionId: string,
  acceptance: Omit<TerminologyAcceptanceRecord, 'acceptedAt'>,
): void {
  const draft = getProtocolImportState().sectionDrafts[sectionId];
  if (!draft) {
    return;
  }
  const entry: TerminologyAcceptanceRecord = {
    ...acceptance,
    acceptedAt: new Date().toISOString(),
  };
  updateSectionImportDraft(sectionId, {
    terminologyAcceptanceLog: [...(draft.terminologyAcceptanceLog ?? []), entry],
  });
}

export function resolveTerminologyHoverInfo(token: string): TerminologyHoverInfo | null {
  const query = token.trim();
  if (query.length < 2) {
    return null;
  }

  const direct = searchTerminology(query, undefined);
  const top = direct.matches[0];
  if (top) {
    return {
      term: top.entry.preferredTerm,
      preferredTerm: top.entry.ichPreferredTerm,
      code: top.entry.code,
      codelistName: top.entry.codelistName,
      codelistId: top.entry.codelistId,
      definition: top.entry.definition,
      synonyms: top.entry.synonyms,
      isSynonymMatch: top.entry.preferredTerm.toLowerCase() !== query.toLowerCase(),
    };
  }

  const fallbackLists = ['Trial Phase', 'C217045', 'C217046'];
  for (const list of fallbackLists) {
    const match = findTerm(list, query);
    if (match) {
      return {
        term: match.entry.preferredTerm,
        preferredTerm: match.entry.ichPreferredTerm,
        code: match.entry.code,
        codelistName: match.entry.codelistName,
        codelistId: match.entry.codelistId,
        definition: match.entry.definition,
        synonyms: match.entry.synonyms,
        isSynonymMatch: true,
        suggestedPreferredTerm: match.entry.ichPreferredTerm,
      };
    }
  }

  return null;
}

export function suggestionToAcceptance(
  suggestion: TerminologySuggestion,
  originalToken: string,
): Omit<TerminologyAcceptanceRecord, 'acceptedAt'> {
  return {
    acceptedTerm: suggestion.preferredTerm,
    preferredTerm: suggestion.preferredTerm,
    codelistName: suggestion.codelistName,
    originalToken,
  };
}

export function applyTokenReplacement(text: string, range: TokenRange, replacement: string): string {
  return `${text.slice(0, range.startOffset)}${replacement}${text.slice(range.endOffset)}`;
}

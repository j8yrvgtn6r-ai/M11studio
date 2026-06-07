import {
  findM11Term,
  getM11Codelists,
  searchM11Terminology,
  type M11ControlledTerm,
  type M11Codelist,
} from '../protocol/ichM11/ichM11ControlledTerminology';
import type { TerminologyEntry, TerminologyLookupResult, TerminologySearchResult } from './types';

function toEntry(codelist: M11Codelist, term: M11ControlledTerm): TerminologyEntry {
  const synonyms = [term.preferredTerm]
    .filter((value) => value && value !== term.ichPreferredTerm);
  return {
    id: `${codelist.id}:${term.code}`,
    codelistId: codelist.id,
    codelistName: codelist.name,
    code: term.code,
    preferredTerm: term.preferredTerm,
    ichPreferredTerm: term.ichPreferredTerm,
    definition: term.definition,
    synonyms,
  };
}

/** Finds a term in a codelist by code or label. */
export function findTerm(codelistIdOrName: string, value: string): TerminologyLookupResult | null {
  const match = findM11Term(codelistIdOrName, value);
  if (!match) {
    return null;
  }
  return {
    entry: toEntry(match.codelist, match.term),
    matchType: 'exact',
    score: 1,
  };
}

/** Returns the ICH-preferred label for a value when known. */
export function findPreferredTerm(codelistIdOrName: string, value: string): string | null {
  const match = findTerm(codelistIdOrName, value);
  return match?.entry.ichPreferredTerm ?? null;
}

/** Returns synonym labels for a term code within a codelist. */
export function findSynonyms(codelistIdOrName: string, value: string): string[] {
  const match = findTerm(codelistIdOrName, value);
  return match?.entry.synonyms ?? [];
}

/** Full-text search across loaded M11 terminology. */
export function searchTerminology(query: string, codelistFilter?: string): TerminologySearchResult {
  const raw = searchM11Terminology(query, codelistFilter);
  const matches: TerminologyLookupResult[] = raw.slice(0, 50).map((item) => ({
    entry: toEntry(item.codelist, item.term),
    matchType: 'partial',
    score: 0.5,
  }));
  return {
    query,
    matches,
    total: raw.length,
  };
}

/** True when terminology JSON has been loaded. */
export function isTerminologyCatalogAvailable(): boolean {
  return getM11Codelists().length > 0;
}

export type { TerminologyEntry, TerminologyLookupResult, TerminologySearchResult } from './types';

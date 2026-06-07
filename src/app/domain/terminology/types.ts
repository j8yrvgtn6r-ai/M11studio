/** Controlled terminology entry for IDE lookup (M11 + future sources). */
export interface TerminologyEntry {
  id: string;
  codelistId: string;
  codelistName: string;
  code: string;
  preferredTerm: string;
  ichPreferredTerm: string;
  definition: string;
  synonyms: string[];
}

export interface TerminologyLookupResult {
  entry: TerminologyEntry;
  matchType: 'exact' | 'synonym' | 'partial';
  score: number;
}

export interface TerminologySearchResult {
  query: string;
  matches: TerminologyLookupResult[];
  total: number;
}

import { useMemo, useState } from 'react';
import type { GeneratedSectionDraft } from '../../domain/protocol/import/types';
import type { FieldDefinition, ProtocolSection } from '../../types/protocol';
import {
  searchProtocolContent,
  type ProtocolSearchMatch,
} from '../../domain/protocol/search/protocolSearch';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Switch } from '../ui/switch';
import { FileText } from 'lucide-react';

export interface ProtocolSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: ProtocolSection[];
  sectionDrafts: Record<string, GeneratedSectionDraft>;
  fields: FieldDefinition[];
  currentSectionId: string | null;
  onNavigateToMatch: (match: ProtocolSearchMatch, query: string) => void;
}

export function ProtocolSearchDialog({
  open,
  onOpenChange,
  sections,
  sectionDrafts,
  fields,
  currentSectionId,
  onNavigateToMatch,
}: ProtocolSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [searchAllSections, setSearchAllSections] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  const result = useMemo(
    () =>
      searchProtocolContent(
        {
          query,
          scopeSectionId: searchAllSections ? null : currentSectionId,
          caseSensitive,
          wholeWord,
        },
        sections,
        sectionDrafts,
        fields,
      ),
    [query, searchAllSections, currentSectionId, caseSensitive, wholeWord, sections, sectionDrafts, fields],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ProtocolSearchMatch[]>();
    for (const match of result.matches) {
      const list = map.get(match.sectionId) ?? [];
      list.push(match);
      map.set(match.sectionId, list);
    }
    return map;
  }, [result.matches]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} data-testid="protocol-search-dialog">
      <div className="px-3 pt-3 pb-2 border-b border-border space-y-2">
        <p className="text-sm font-medium">Protocol Search</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <Switch
              checked={searchAllSections}
              onCheckedChange={setSearchAllSections}
              aria-label="Search all sections"
              data-testid="protocol-search-all-sections"
            />
            All sections
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={caseSensitive}
              onCheckedChange={setCaseSensitive}
              aria-label="Case sensitive"
              data-testid="protocol-search-case-sensitive"
            />
            Case sensitive
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={wholeWord}
              onCheckedChange={setWholeWord}
              aria-label="Whole word"
              data-testid="protocol-search-whole-word"
            />
            Whole word
          </label>
        </div>
      </div>
      <CommandInput
        placeholder={searchAllSections ? 'Find across protocol…' : 'Find in current section…'}
        value={query}
        onValueChange={setQuery}
        data-testid="protocol-search-input"
      />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>
        {[...grouped.entries()].map(([sectionId, matches]) => (
          <CommandGroup key={sectionId} heading={matches[0]?.sectionTitle ?? sectionId}>
            {matches.slice(0, 8).map((match, index) => (
              <CommandItem
                key={`${sectionId}-${match.matchStart}-${index}`}
                onSelect={() => {
                  onNavigateToMatch(match, query);
                  onOpenChange(false);
                }}
                data-testid={`protocol-search-result-${sectionId}-${index}`}
              >
                <FileText className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate text-xs">
                  L{match.lineNumber}: {match.snippet}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      {query.trim() ? (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground" data-testid="protocol-search-summary">
          {result.matches.length} match(es) in {result.sectionsWithMatches} section(s)
        </div>
      ) : null}
    </CommandDialog>
  );
}

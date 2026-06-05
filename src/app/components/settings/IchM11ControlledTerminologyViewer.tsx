import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import {
  getM11Codelists,
  searchM11Terminology,
} from '../../domain/protocol/ichM11/ichM11ControlledTerminology';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

export function IchM11ControlledTerminologyViewer() {
  const codelists = getM11Codelists();
  const [query, setQuery] = useState('');
  const [codelistFilter, setCodelistFilter] = useState<string>('all');

  const filteredResults = useMemo(() => {
    if (!query.trim()) {
      if (codelistFilter === 'all') {
        return [];
      }
      const list = codelists.find((item) => item.id === codelistFilter);
      return list ? list.terms.map((term) => ({ codelist: list, term })) : [];
    }
    return searchM11Terminology(
      query,
      codelistFilter === 'all' ? undefined : codelistFilter,
    ).slice(0, 200);
  }, [query, codelistFilter, codelists]);

  const showCodelistTable = !query.trim() && codelistFilter !== 'all';
  const selectedCodelist = codelists.find((list) => list.id === codelistFilter);

  return (
    <div className="space-y-4" data-testid="ich-m11-controlled-terminology-viewer">
      <h3 className="text-sm font-semibold">Terminology browser</h3>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search codelists and terms…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="ich-m11-terminology-search"
          />
        </div>
        <div className="w-full sm:w-72">
          <Label htmlFor="codelist-filter" className="sr-only">
            Filter by codelist
          </Label>
          <Select value={codelistFilter} onValueChange={setCodelistFilter}>
            <SelectTrigger id="codelist-filter">
              <SelectValue placeholder="All codelists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All codelists</SelectItem>
              {codelists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="h-[420px] rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Codelist</TableHead>
              <TableHead className="text-xs">Code</TableHead>
              <TableHead className="text-xs">ICH preferred term</TableHead>
              <TableHead className="text-xs">Preferred term</TableHead>
              <TableHead className="text-xs">Definition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showCodelistTable && selectedCodelist
              ? selectedCodelist.terms.map((term) => (
                  <TableRow key={`${selectedCodelist.id}-${term.code}`}>
                    <TableCell className="text-xs align-top">
                      <div className="font-medium">{selectedCodelist.name}</div>
                      <div className="text-muted-foreground font-mono">{selectedCodelist.id}</div>
                      {selectedCodelist.extensible ? (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          Extensible
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{term.code}</TableCell>
                    <TableCell className="text-xs">{term.ichPreferredTerm}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{term.preferredTerm}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">{term.definition}</TableCell>
                  </TableRow>
                ))
              : null}

            {!showCodelistTable && query.trim() && filteredResults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No matching terms. Try &quot;Control Type&quot; or &quot;Trial Phase&quot;.
                </TableCell>
              </TableRow>
            ) : null}

            {!showCodelistTable
              ? filteredResults.map(({ codelist, term }) => (
                  <TableRow key={`${codelist.id}-${term.code}`}>
                    <TableCell className="text-xs align-top">
                      <div className="font-medium">{codelist.name}</div>
                      <div className="text-muted-foreground font-mono">{codelist.id}</div>
                      {codelist.extensible ? (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          Extensible
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{term.code}</TableCell>
                    <TableCell className="text-xs">{term.ichPreferredTerm}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{term.preferredTerm}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">{term.definition}</TableCell>
                  </TableRow>
                ))
              : null}

            {!query.trim() && codelistFilter === 'all' ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Enter a search term or select a codelist to browse terminology.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

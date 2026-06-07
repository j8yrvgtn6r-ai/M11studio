import { useMemo, useState } from 'react';
import type { GeneratedSectionDraft } from '../../domain/protocol/import/types';
import type { ProtocolSection } from '../../types/protocol';
import {
  applyReplaceTransaction,
  buildReplacePreviewWithMatches,
  getLastAppliedReplaceTransaction,
  groupMatchesBySection,
  undoLastReplaceTransaction,
  type ReplaceTransactionMatch,
} from '../../domain/protocol/search/replaceTransaction';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export interface FindReplacePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: ProtocolSection[];
  sectionDrafts: Record<string, GeneratedSectionDraft>;
  currentSectionId: string | null;
  initialMode?: 'find' | 'replace';
  onApplied?: () => void;
}

export function FindReplacePanel({
  open,
  onOpenChange,
  sections,
  sectionDrafts,
  currentSectionId,
  initialMode = 'replace',
  onApplied,
}: FindReplacePanelProps) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [scopeAll, setScopeAll] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () => ({
      find,
      replace,
      scope: scopeAll ? ('protocol' as const) : ('section' as const),
      scopeSectionId: currentSectionId,
      caseSensitive,
      wholeWord,
    }),
    [find, replace, scopeAll, currentSectionId, caseSensitive, wholeWord],
  );

  const matches = useMemo(
    () => buildReplacePreviewWithMatches(options, sections, sectionDrafts),
    [options, sections, sectionDrafts],
  );

  const grouped = useMemo(() => groupMatchesBySection(matches), [matches]);
  const selectedCount = matches.filter((match) => included[match.id] ?? true).length;
  const lastApplied = getLastAppliedReplaceTransaction();

  const toggleMatch = (match: ReplaceTransactionMatch, checked: boolean) => {
    setIncluded((current) => ({ ...current, [match.id]: checked }));
  };

  const handleApply = async () => {
    if (scopeAll && selectedCount > 0) {
      const confirmed = window.confirm(`Replace ${selectedCount} match(es) across ${grouped.size} section(s)?`);
      if (!confirmed) {
        return;
      }
    }
    setBusy(true);
    const selectedIds = matches.filter((match) => included[match.id] ?? true).map((match) => match.id);
    const result = await applyReplaceTransaction(options, sections, sectionDrafts, selectedIds);
    setBusy(false);
    if (!result.applied) {
      setStatus(result.reason ?? 'Replace failed.');
      return;
    }
    setStatus(`Applied ${selectedIds.length} replacement(s) across ${result.transaction?.affectedSectionIds.length ?? 0} section(s).`);
    onApplied?.();
  };

  const handleUndo = async () => {
    setBusy(true);
    const result = await undoLastReplaceTransaction(sections);
    setBusy(false);
    setStatus(result.reverted ? 'Last replace transaction undone.' : result.reason ?? 'Undo failed.');
    onApplied?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="find-replace-panel">
        <DialogHeader>
          <DialogTitle>{initialMode === 'find' ? 'Find' : 'Find and Replace'}</DialogTitle>
          <DialogDescription>
            Preview replacements, choose matches, then apply as a single undoable transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="find-replace-find">Find</Label>
            <Input id="find-replace-find" value={find} onChange={(event) => setFind(event.target.value)} data-testid="find-replace-find-input" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="find-replace-replace">Replace with</Label>
            <Input
              id="find-replace-replace"
              value={replace}
              onChange={(event) => setReplace(event.target.value)}
              disabled={initialMode === 'find'}
              data-testid="find-replace-replace-input"
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2">
              <Switch checked={scopeAll} onCheckedChange={setScopeAll} data-testid="find-replace-scope-all" />
              All sections
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={caseSensitive} onCheckedChange={setCaseSensitive} data-testid="find-replace-case-sensitive" />
              Case sensitive
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={wholeWord} onCheckedChange={setWholeWord} data-testid="find-replace-whole-word" />
              Whole word
            </label>
          </div>

          <div className="rounded-md border border-border max-h-56 overflow-auto" data-testid="find-replace-preview">
            {matches.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No preview matches.</p>
            ) : (
              [...grouped.entries()].map(([sectionId, sectionMatches]) => (
                <div key={sectionId} className="border-b border-border last:border-0">
                  <div className="bg-muted/30 px-3 py-1.5 text-xs font-medium">{sectionMatches[0]?.sectionTitle ?? sectionId}</div>
                  {sectionMatches.map((item) => (
                    <label key={item.id} className="flex items-start gap-2 border-b border-border px-3 py-2 text-xs last:border-0">
                      <Checkbox
                        checked={included[item.id] ?? true}
                        onCheckedChange={(checked) => toggleMatch(item, Boolean(checked))}
                        data-testid={`find-replace-include-${item.id}`}
                      />
                      <span>
                        <span className="font-medium">L{item.lineNumber}</span> · {item.before} → {item.after}
                        <span className="block text-muted-foreground mt-0.5">{item.snippet}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground space-y-1">
              <p data-testid="find-replace-preview-count">{selectedCount} of {matches.length} match(es) selected · {grouped.size} section(s)</p>
              {status ? <p data-testid="find-replace-status">{status}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={busy || !lastApplied || Boolean(lastApplied.revertedAt)} onClick={handleUndo} data-testid="find-replace-undo">
                Undo Last Replace
              </Button>
              <Button type="button" disabled={busy || selectedCount === 0 || initialMode === 'find'} onClick={handleApply} data-testid="find-replace-apply">
                Apply Selected
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

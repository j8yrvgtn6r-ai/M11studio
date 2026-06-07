import { useMemo, useState } from 'react';
import type { GeneratedSectionDraft } from '../../domain/protocol/import/types';
import type { ProtocolSection } from '../../types/protocol';
import { previewFindReplace } from '../../domain/protocol/search/findReplace';
import { Button } from '../ui/button';
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
}

export function FindReplacePanel({
  open,
  onOpenChange,
  sections,
  sectionDrafts,
  currentSectionId,
  initialMode = 'replace',
}: FindReplacePanelProps) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [scopeAll, setScopeAll] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  const preview = useMemo(
    () =>
      previewFindReplace(
        {
          find,
          replace,
          scope: scopeAll ? 'protocol' : 'section',
          scopeSectionId: currentSectionId,
          caseSensitive,
          wholeWord,
        },
        sections,
        sectionDrafts,
      ),
    [find, replace, scopeAll, currentSectionId, caseSensitive, wholeWord, sections, sectionDrafts],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="find-replace-panel">
        <DialogHeader>
          <DialogTitle>{initialMode === 'find' ? 'Find' : 'Find and Replace'}</DialogTitle>
          <DialogDescription>
            Preview replacements across the protocol. Apply is disabled in Protocol IDE v1.
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

          <div className="rounded-md border border-border max-h-48 overflow-auto" data-testid="find-replace-preview">
            {preview.items.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No preview matches.</p>
            ) : (
              preview.items.slice(0, 20).map((item, index) => (
                <div key={`${item.sectionId}-${index}`} className="border-b border-border px-3 py-2 text-xs last:border-0">
                  <p className="font-medium">{item.sectionTitle} · L{item.lineNumber}</p>
                  <p className="text-muted-foreground">{item.before} → {item.after}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground" data-testid="find-replace-preview-count">
              {preview.totalReplacements} replacement(s) previewed
            </span>
            <Button type="button" disabled data-testid="find-replace-apply-disabled">
              Apply replacements (v2)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

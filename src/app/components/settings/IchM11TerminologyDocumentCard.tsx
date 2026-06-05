import { FileDown, ListTree } from 'lucide-react';

import {
  ICH_M11_TERMINOLOGY_META,
  getM11CodelistCount,
  getM11ControlledTerminologyDocument,
  getM11TermCount,
} from '../../domain/protocol/ichM11/ichM11ControlledTerminology';
import {
  downloadIchM11ReferenceDocument,
  viewIchM11TerminologyJson,
} from '../../domain/protocol/ichM11/ichM11ReferenceDocuments';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';

function formatDate(iso?: string): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function IchM11TerminologyDocumentCard() {
  const meta = ICH_M11_TERMINOLOGY_META;
  const document = getM11ControlledTerminologyDocument();
  const codelistCount = getM11CodelistCount();
  const termCount = getM11TermCount();

  return (
    <Card data-testid="ich-m11-doc-card-controlled-terminology">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListTree className="h-4 w-4" />
          ICH M11 Controlled Terminology
        </CardTitle>
        <CardDescription>{meta.title}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Terminology date</p>
          <p className="font-medium">{formatDate(meta.terminologyDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Loaded status</p>
          <Badge variant="secondary">Static local — loaded</Badge>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Source URL</p>
          <a
            href={meta.sourceUrl}
            className="text-xs text-primary hover:underline break-all"
            target="_blank"
            rel="noopener noreferrer"
          >
            {meta.sourceUrl}
          </a>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Codelists</p>
          <p className="font-medium tabular-nums">{codelistCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Terms</p>
          <p className="font-medium tabular-nums">{termCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ingestion</p>
          <p className="font-medium capitalize">{meta.ingestionMode}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Source host</p>
          <p>{document.source}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Source filename</p>
          <p className="font-mono text-xs break-all">{meta.sourceFilename}</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          data-testid="ich-m11-download-controlled-terminology"
          onClick={() => downloadIchM11ReferenceDocument('controlled-terminology')}
        >
          <FileDown className="h-3.5 w-3.5" />
          Export JSON
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => viewIchM11TerminologyJson()}>
          Open JSON
        </Button>
      </CardFooter>
    </Card>
  );
}

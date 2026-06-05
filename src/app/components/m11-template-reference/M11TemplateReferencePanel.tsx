import { useState } from 'react';
import { AlertCircle, BookOpen, Copy, ExternalLink, FileText, Check } from 'lucide-react';

import {
  getTemplateReferenceCopyText,
  getTemplateSectionReference,
  hasMappedTemplateReference,
} from '../../domain/protocol/ichM11/ichM11TemplateSectionReference';
import { useReferenceDocument, viewIchM11UploadedPdf } from '../../domain/referenceDocuments';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

interface M11TemplateReferencePanelProps {
  sectionId: string | null;
  sectionTitle?: string | null;
}

export function M11TemplateReferencePanel({ sectionId, sectionTitle }: M11TemplateReferencePanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [renderError] = useState<string | null>(null);
  const templateDocument = useReferenceDocument('ich-m11-template');
  const templatePdfUploaded = templateDocument.status === 'uploaded';

  let reference = null;
  try {
    reference = getTemplateSectionReference(sectionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load template reference';
    return (
      <div className="flex flex-col h-full bg-muted/30 border-l border-border">
        <PanelHeader />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Template reference unavailable</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const displayTitle = sectionTitle ?? reference?.title;
  const mapped = hasMappedTemplateReference(sectionId);

  const handleCopy = async () => {
    const text = getTemplateReferenceCopyText(sectionId);
    if (!text) {
      setCopyState('error');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
    }
  };

  if (renderError) {
    return (
      <div className="flex flex-col h-full bg-muted/30 border-l border-border">
        <PanelHeader />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{renderError}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/30 border-l border-border" data-testid="m11-template-reference-panel">
      <PanelHeader />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {!sectionId ? (
            <p className="text-sm text-muted-foreground">Select a protocol section to view M11 Template reference text.</p>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Section</p>
                <h3 className="text-sm font-semibold mt-1">{displayTitle ?? '—'}</h3>
                {reference?.sectionNumber && reference.sectionNumber !== reference.title && (
                  <p className="text-xs text-muted-foreground mt-0.5">Number {reference.sectionNumber}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  Source: ICH M11 Template
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Read-only reference
                </Badge>
                {reference?.instructionalOnly && (
                  <Badge variant="outline" className="text-xs">
                    Template instruction
                  </Badge>
                )}
                {reference?.headingOnly && (
                  <Badge variant="outline" className="text-xs">
                    Heading only
                  </Badge>
                )}
              </div>

              {reference?.pageRange ? (
                <p className="text-xs text-muted-foreground">
                  Template location: {reference.pageRange}
                </p>
              ) : null}

              {mapped && reference?.instructionalText ? (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Template guidance</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{reference.instructionalText}</p>
                </div>
              ) : (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    No M11 Template reference text is mapped for this section yet.
                  </AlertDescription>
                </Alert>
              )}

              {reference?.placeholderPrompts && reference.placeholderPrompts.length > 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Placeholder prompts</p>
                  <ul className="list-disc pl-4 text-sm space-y-1 text-muted-foreground">
                    {reference.placeholderPrompts.map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border flex flex-col gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={!templatePdfUploaded}
          onClick={() => viewIchM11UploadedPdf('template')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full template PDF
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={!mapped}
          onClick={handleCopy}
        >
          {copyState === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy template prompt'}
        </Button>
      </div>
    </div>
  );
}

function PanelHeader() {
  return (
    <div className="px-3 py-2 border-b border-border bg-card/80 shrink-0">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">M11 Template Reference</h2>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">Reference only — does not edit the protocol</p>
    </div>
  );
}


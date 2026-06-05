import { AlertTriangle, FileSearch } from 'lucide-react';

import { useProtocolImport } from '../../domain/protocol/import/ProtocolImportContext';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { ImportProtocolSourceActions } from './ImportProtocolSourceActions';

export function SourceExtractionPanel() {
  const { state, importedSource } = useProtocolImport();
  const summary = state.importedSourceSummary;

  if (!summary) {
    return (
      <div className="p-6 text-sm text-muted-foreground" data-testid="source-extraction-empty">
        No source extraction available. Import a DOCX to extract structure.
      </div>
    );
  }

  const sections = importedSource?.sections ?? [];

  return (
    <div className="flex flex-col h-full" data-testid="source-extraction-panel">
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              Source Extraction
            </h2>
            <p className="text-sm text-muted-foreground font-mono mt-1">{summary.filename}</p>
          </div>
          <ImportProtocolSourceActions />
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          data-testid="source-extraction-summary"
        >
          <Stat label="Paragraphs" value={summary.paragraphCount} testId="source-paragraph-count" />
          <Stat label="Headings" value={summary.headingCount} testId="source-heading-count" />
          <Stat
            label="Source sections"
            value={summary.sectionCandidateCount}
            testId="source-section-candidate-count"
          />
          <Stat label="Tables" value={summary.tableCount} />
        </div>
      </div>

      {summary.extractionWarnings.length > 0 ? (
        <div className="px-4 pt-3 shrink-0">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Extraction warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
                {summary.extractionWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {sections.map((section) => (
            <div
              key={section.id}
              className="rounded-lg border border-border bg-card p-3 text-sm"
              data-testid={`source-section-candidate-${section.id}`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="font-medium">{section.headingText}</p>
                <Badge variant="outline" className="text-[10px]">
                  {Math.round(section.confidence * 100)}% confidence
                </Badge>
                {section.possibleM11SectionId ? (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    M11 {section.possibleM11SectionId}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">{section.text}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                {section.detectionMethod}
                {section.detectedNumber ? ` · ${section.detectedNumber}` : ''}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

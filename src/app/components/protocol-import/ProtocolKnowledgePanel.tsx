import { useProtocolImport } from '../../domain/protocol/import/ProtocolImportContext';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

function FieldRow({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <ul className="text-sm space-y-1 list-disc pl-4">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProtocolKnowledgePanel() {
  const { protocolKnowledge } = useProtocolImport();

  if (!protocolKnowledge) {
    return (
      <div className="p-6 text-sm text-muted-foreground" data-testid="protocol-knowledge-panel">
        No protocol knowledge model available. Run an import to build the knowledge layer from DOCX extraction.
      </div>
    );
  }

  const providerLabel =
    protocolKnowledge.knowledgeProvider === 'llm'
      ? 'LLM-generated'
      : 'Local deterministic (not AI-generated)';

  return (
    <div className="flex flex-col h-full" data-testid="protocol-knowledge-panel">
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-sm">Protocol Knowledge Layer</h2>
          <Badge variant="outline" data-testid="knowledge-provider-badge">
            {providerLabel}
          </Badge>
          <Badge variant="secondary" data-testid="knowledge-confidence-badge">
            Confidence {Math.round(protocolKnowledge.confidence * 100)}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="protocol-knowledge-summary">
          Global summary assembled from uploaded DOCX before M11 section draft generation. Human review is
          required for all generated proposals.
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 max-w-3xl space-y-4" data-testid="source-extraction-summary">
          <FieldRow label="Study title" value={protocolKnowledge.studyTitle} />
          <FieldRow label="Short title" value={protocolKnowledge.shortTitle} />
          <FieldRow label="Sponsor" value={protocolKnowledge.sponsor} />
          <FieldRow label="Protocol ID" value={protocolKnowledge.protocolIdentifier} />
          <FieldRow label="Version" value={protocolKnowledge.version} />
          <FieldRow label="Phase" value={protocolKnowledge.phase} />
          <FieldRow label="Indication" value={protocolKnowledge.indication} />
          <FieldRow label="Population" value={protocolKnowledge.population} />
          <FieldRow label="Eligibility" value={protocolKnowledge.eligibilitySummary} />
          <FieldRow label="Statistics" value={protocolKnowledge.statisticalSummary} />
          <ListField label="Objectives" items={protocolKnowledge.objectives} />
          <ListField label="Endpoints" items={protocolKnowledge.endpoints} />
          <ListField label="Estimands" items={protocolKnowledge.estimands} />
          <ListField label="Arms" items={protocolKnowledge.arms} />
          <ListField label="Interventions" items={protocolKnowledge.interventions} />
          <ListField label="Safety assessments" items={protocolKnowledge.safetyAssessments} />
          <ListField label="Efficacy assessments" items={protocolKnowledge.efficacyAssessments} />
          {protocolKnowledge.extractionNotes.length > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
              <p className="font-medium text-amber-700 dark:text-amber-400">Extraction notes</p>
              {protocolKnowledge.extractionNotes.map((note) => (
                <p key={note} className="text-muted-foreground">
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

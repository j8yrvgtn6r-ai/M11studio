import { useProtocolImport } from '../../domain/protocol/import/ProtocolImportContext';
import { isRealLlmProvider } from '../../domain/protocol/import/llm/llmConfig';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { SoAKnowledgeSummaryPanel } from '../soa-knowledge/SoAKnowledgeSummaryPanel';
import { SoAProposalActions } from '../soa-knowledge/SoAProposalReviewPanel';
import { SoAEnrichmentActions } from '../soa-knowledge/SoAEnrichmentProposalReviewPanel';

function FieldRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function ListField({ label, items }: { label: string; items?: string[] }) {
  const safeItems = items ?? [];
  if (safeItems.length === 0) return null;
  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <ul className="text-sm space-y-1 list-disc pl-4">
        {safeItems.map((item) => (
          <li key={item} className="break-words">{item}</li>
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
        No protocol knowledge model available. Run an import to build protocol understanding.
      </div>
    );
  }

  const providerLabel = isRealLlmProvider(protocolKnowledge.knowledgeProvider)
    ? `LLM · ${protocolKnowledge.understandingModel}`
    : protocolKnowledge.knowledgeProvider === 'fixture'
      ? 'Simulation Mode (development/smoke)'
      : `${protocolKnowledge.knowledgeProvider} · ${protocolKnowledge.understandingModel}`;

  return (
    <div className="flex flex-col h-full" data-testid="protocol-knowledge-panel">
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-sm">Protocol Knowledge Layer</h2>
          <Badge variant="outline" data-testid="knowledge-provider-badge">{providerLabel}</Badge>
          <Badge variant="secondary" data-testid="knowledge-confidence-badge">
            Confidence {Math.round(protocolKnowledge.confidence * 100)}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="protocol-knowledge-summary">
          Global protocol understanding — primary input for M11 reconstruction (not section-to-section mapping).
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 max-w-3xl space-y-4">
          <FieldRow label="Study title" value={protocolKnowledge.studyTitle} />
          <FieldRow label="Protocol ID" value={protocolKnowledge.protocolIdentifier} />
          <FieldRow label="Sponsor" value={protocolKnowledge.sponsor} />
          <FieldRow label="Phase" value={protocolKnowledge.phase} />
          <FieldRow label="Indication" value={protocolKnowledge.indication} />
          <FieldRow label="Target population" value={protocolKnowledge.targetPopulation} />
          <FieldRow label="Inclusion" value={protocolKnowledge.inclusionCriteriaSummary} />
          <FieldRow label="Exclusion" value={protocolKnowledge.exclusionCriteriaSummary} />
          <FieldRow label="Intervention model" value={protocolKnowledge.interventionModel} />
          <FieldRow label="Control type" value={protocolKnowledge.controlType} />
          <FieldRow label="Statistics" value={protocolKnowledge.statisticalSummary} />
          <FieldRow label="Risk-benefit" value={protocolKnowledge.riskBenefitSummary} />
          <ListField label="Primary objectives" items={protocolKnowledge.primaryObjectives} />
          <ListField label="Secondary objectives" items={protocolKnowledge.secondaryObjectives} />
          <ListField label="Estimands" items={protocolKnowledge.estimands} />
          <ListField label="Arms" items={protocolKnowledge.arms} />
          <ListField label="Interventions" items={protocolKnowledge.interventions} />
          <ListField label="Visits" items={protocolKnowledge.visits} />
          <ListField label="Assessments" items={protocolKnowledge.assessments} />
          <ListField label="Safety monitoring" items={protocolKnowledge.safetyMonitoring} />
          {(protocolKnowledge.extractionNotes ?? []).length > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
              <p className="font-medium text-amber-700 dark:text-amber-400">Understanding notes</p>
              {(protocolKnowledge.extractionNotes ?? []).map((note) => (
                <p key={note} className="text-muted-foreground">{note}</p>
              ))}
            </div>
          ) : null}
          <SoAProposalActions />
          <SoAEnrichmentActions />
          <SoAKnowledgeSummaryPanel />
        </div>
      </ScrollArea>
    </div>
  );
}

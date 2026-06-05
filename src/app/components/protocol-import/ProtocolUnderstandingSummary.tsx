import type { ProtocolKnowledgeModel } from '../../domain/protocol/import/protocolKnowledgeTypes';
import { Badge } from '../ui/badge';

interface ProtocolUnderstandingSummaryProps {
  knowledge: ProtocolKnowledgeModel;
}

export function ProtocolUnderstandingSummary({ knowledge }: ProtocolUnderstandingSummaryProps) {
  const providerLabel =
    knowledge.knowledgeProvider === 'fixture'
      ? 'Fixture provider (smoke/dev)'
      : `${knowledge.knowledgeProvider} · ${knowledge.understandingModel}`;

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-3"
      data-testid="protocol-understanding-summary"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-sm">Protocol Understanding Summary</h3>
        <Badge variant="outline" data-testid="understanding-provider-badge">
          {providerLabel}
        </Badge>
        <Badge variant="secondary">
          Confidence {Math.round(knowledge.confidence * 100)}%
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Global study design understanding completed before M11 reconstruction. This is not section-to-section
        mapping. All generated sections remain proposals requiring human review.
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {knowledge.studyTitle ? (
          <>
            <dt className="text-muted-foreground">Study title</dt>
            <dd data-testid="understanding-study-title">{knowledge.studyTitle}</dd>
          </>
        ) : null}
        {knowledge.protocolIdentifier ? (
          <>
            <dt className="text-muted-foreground">Protocol ID</dt>
            <dd>{knowledge.protocolIdentifier}</dd>
          </>
        ) : null}
        {knowledge.phase ? (
          <>
            <dt className="text-muted-foreground">Phase</dt>
            <dd>{knowledge.phase}</dd>
          </>
        ) : null}
        {(knowledge.primaryObjectives ?? []).length > 0 ? (
          <>
            <dt className="text-muted-foreground">Primary objectives</dt>
            <dd>{(knowledge.primaryObjectives ?? [])[0]}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

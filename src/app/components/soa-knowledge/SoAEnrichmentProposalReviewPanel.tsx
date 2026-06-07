import { useState } from 'react';

import {
  acceptCurrentSoAEnrichmentProposal,
  rejectCurrentSoAEnrichmentProposal,
  runSoAEnrichment,
} from '../../agents/soaAgentEnrichmentRunner';
import type { SoAInferenceSource } from '../../domain/soa-knowledge/soaKnowledgeTypes';
import { useSoAEnrichmentProposal } from '../../domain/soa-knowledge/useSoAEnrichmentProposal';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

function sourceBadge(source: SoAInferenceSource) {
  switch (source) {
    case 'deterministic':
      return <Badge variant="secondary">Deterministic</Badge>;
    case 'deterministic-table':
      return <Badge variant="secondary">Table</Badge>;
    case 'llm-inferred':
      return <Badge variant="outline">LLM Inferred</Badge>;
    case 'llm-reconciled':
      return <Badge variant="outline">LLM Reconciled</Badge>;
    case 'user-created':
      return <Badge variant="secondary">User Created</Badge>;
    case 'user-modified':
      return <Badge variant="secondary">User Modified</Badge>;
    default:
      return <Badge variant="outline">{source}</Badge>;
  }
}

function EnrichedItemCard({
  title,
  source,
  evidence,
  rationale,
}: {
  title: string;
  source: SoAInferenceSource;
  evidence?: Array<{ sectionId: string; sourceText: string; reason: string }>;
  rationale?: string;
}) {
  const primaryEvidence = evidence?.[0];
  return (
    <div className="rounded-md border border-border/70 p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{title}</p>
        {sourceBadge(source)}
      </div>
      {primaryEvidence ? (
        <p className="text-[11px] text-muted-foreground">
          Section {primaryEvidence.sectionId}: “{primaryEvidence.sourceText}” — {primaryEvidence.reason}
        </p>
      ) : null}
      {rationale ? <p className="text-[11px] text-muted-foreground">Rationale: {rationale}</p> : null}
    </div>
  );
}

interface SoAEnrichmentProposalReviewPanelProps {
  onClose?: () => void;
}

export function SoAEnrichmentProposalReviewPanel({ onClose }: SoAEnrichmentProposalReviewPanelProps) {
  const proposal = useSoAEnrichmentProposal();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!proposal) {
    return (
      <div className="rounded-md border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground" data-testid="soa-enrichment-review-panel">
        No SoA enrichment proposal available. Run LLM SoA Enrichment after deterministic extraction.
      </div>
    );
  }

  const handleAccept = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = acceptCurrentSoAEnrichmentProposal();
      setMessage(
        result.accepted
          ? `Enrichment accepted. ${result.markedSections.length} narrative section(s) flagged for review.`
          : result.configurationDeferred[0] ?? 'Enrichment could not be accepted.',
      );
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = () => {
    rejectCurrentSoAEnrichmentProposal();
    setMessage('Enrichment rejected — existing SoA Knowledge preserved.');
    onClose?.();
  };

  return (
    <div className="rounded-md border border-border bg-card" data-testid="soa-enrichment-review-panel">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">SoA LLM Enrichment Review</h3>
          <p className="text-xs text-muted-foreground mt-1">{proposal.summary}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Provider: {proposal.provider}{proposal.model ? ` · ${proposal.model}` : ''}
          </p>
        </div>
        <Badge variant={proposal.status === 'proposed' ? 'outline' : 'secondary'} data-testid="soa-enrichment-status">
          {proposal.status}
        </Badge>
      </div>

      <ScrollArea className="max-h-[420px]">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Deterministic baseline</p>
              <p>Visits {proposal.deterministicCounts.visits} · Assessments {proposal.deterministicCounts.assessments}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Proposed enrichment</p>
              <p>
                Visits {proposal.enrichedCounts.visits} · Assessments {proposal.enrichedCounts.assessments} · Rules{' '}
                {proposal.enrichedCounts.scheduleRules}
              </p>
            </div>
          </div>

          {proposal.proposedVisits.map((visit) => (
            <EnrichedItemCard key={visit.id} title={visit.name} source={visit.inferenceSource} evidence={visit.evidence} rationale={visit.rationale} />
          ))}
          {proposal.proposedAssessments.map((assessment) => (
            <EnrichedItemCard
              key={assessment.id}
              title={assessment.name}
              source={assessment.inferenceSource}
              evidence={assessment.evidence}
              rationale={assessment.rationale}
            />
          ))}
          {proposal.proposedTimingWindows.map((window) => (
            <EnrichedItemCard
              key={window.id}
              title={window.label}
              source={window.inferenceSource}
              evidence={window.evidence}
              rationale={window.rationale}
            />
          ))}
          {proposal.proposedConditions.map((condition) => (
            <EnrichedItemCard
              key={condition.id}
              title={condition.label}
              source={condition.inferenceSource}
              evidence={condition.evidence}
              rationale={condition.rationale}
            />
          ))}
          {proposal.proposedScheduleRules.map((rule) => (
            <EnrichedItemCard
              key={rule.id}
              title={rule.notes ?? `${rule.assessmentId} → ${rule.visitId}`}
              source={rule.inferenceSource}
              evidence={rule.evidence}
              rationale={rule.rationale}
            />
          ))}

          {proposal.impactedNarrativeSections.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Impacted narrative sections</p>
              <ul className="text-xs space-y-1">
                {proposal.impactedNarrativeSections.map((entry) => (
                  <li key={entry.sectionId}>
                    Section {entry.sectionId}: {entry.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(proposal.diagnostics.length > 0 ||
            proposal.warnings.length > 0 ||
            proposal.missingEvidenceWarnings.length > 0) && (
            <div className="space-y-2">
              {proposal.warnings.map((warning) => (
                <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>
              ))}
              {proposal.missingEvidenceWarnings.map((warning) => (
                <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>
              ))}
              {proposal.diagnostics.slice(0, 8).map((note) => (
                <p key={note} className="text-xs text-muted-foreground whitespace-pre-wrap">{note}</p>
              ))}
            </div>
          )}

          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      </ScrollArea>

      {proposal.status === 'proposed' ? (
        <div className="px-4 py-3 border-t border-border flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void handleAccept()} data-testid="soa-enrichment-accept">
            Accept Enrichment
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={handleReject} data-testid="soa-enrichment-reject">
            Reject Enrichment
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SoAEnrichmentActions({ compact = false }: { compact?: boolean }) {
  const proposal = useSoAEnrichmentProposal();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      await runSoAEnrichment();
      setReviewOpen(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="soa-enrichment-actions">
      <div className={`flex ${compact ? 'flex-col' : 'flex-wrap'} gap-2`}>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={running}
          onClick={() => void handleRun()}
          data-testid="soa-run-llm-enrichment-button"
        >
          {running ? 'Enriching…' : 'Run LLM SoA Enrichment'}
        </Button>
        {proposal?.status === 'proposed' ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs"
            onClick={() => setReviewOpen((open) => !open)}
            data-testid="soa-review-enrichment-button"
          >
            Review Enrichment Proposal
          </Button>
        ) : null}
      </div>
      {proposal ? (
        <p className="text-[11px] text-muted-foreground">
          Last enrichment: {new Date(proposal.createdAt).toLocaleString()} · {proposal.summary}
        </p>
      ) : null}
      {reviewOpen ? <SoAEnrichmentProposalReviewPanel onClose={() => setReviewOpen(false)} /> : null}
    </div>
  );
}

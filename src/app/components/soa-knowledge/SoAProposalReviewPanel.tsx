import { useState } from 'react';

import {
  acceptCurrentSoAProposal,
  generateFirstPassSoA,
  rejectCurrentSoAProposal,
} from '../../agents/soaAgentRunner';
import { useSoAProposal } from '../../domain/soa-knowledge/useSoAProposal';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

interface SoAProposalReviewPanelProps {
  onClose?: () => void;
}

export function SoAProposalReviewPanel({ onClose }: SoAProposalReviewPanelProps) {
  const proposal = useSoAProposal();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!proposal) {
    return (
      <div className="rounded-md border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground" data-testid="soa-proposal-review-panel">
        No SoA proposal available. Run Generate First-Pass SoA after import or narrative updates.
      </div>
    );
  }

  const handleAccept = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = acceptCurrentSoAProposal();
      setMessage(
        result.accepted
          ? `Proposal accepted. ${result.markedSections.length} narrative section(s) flagged for review.`
          : result.configurationDeferred[0] ?? 'Proposal could not be accepted.',
      );
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = () => {
    rejectCurrentSoAProposal();
    setMessage('Proposal rejected — existing SoA Knowledge and Configuration preserved.');
    onClose?.();
  };

  return (
    <div className="rounded-md border border-border bg-card" data-testid="soa-proposal-review-panel">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">SoA Proposal Review</h3>
          <p className="text-xs text-muted-foreground mt-1">{proposal.summary}</p>
        </div>
        <Badge variant={proposal.status === 'proposed' ? 'outline' : 'secondary'} data-testid="soa-proposal-status">
          {proposal.status}
        </Badge>
      </div>

      <ScrollArea className="max-h-[420px]">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <CountRow label="Arms" value={proposal.counts.arms} />
            <CountRow label="Epochs" value={proposal.counts.epochs} />
            <CountRow label="Elements" value={proposal.counts.elements} />
            <CountRow label="Visits" value={proposal.counts.visits} />
            <CountRow label="Activities" value={proposal.counts.activities} />
            <CountRow label="Assessments" value={proposal.counts.assessments} />
            <CountRow label="Schedule Rules" value={proposal.counts.scheduleRules} />
            <CountRow label="Conditions" value={proposal.counts.conditions} />
            <CountRow label="Footnotes" value={proposal.counts.footnotes} />
          </div>

          {proposal.soaKnowledgePatch.visits && proposal.soaKnowledgePatch.visits.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Proposed visits</p>
              <ul className="text-xs space-y-1">
                {proposal.soaKnowledgePatch.visits.slice(0, 12).map((visit) => (
                  <li key={visit.id}>{visit.name}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {proposal.soaKnowledgePatch.assessments && proposal.soaKnowledgePatch.assessments.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Proposed assessments</p>
              <ul className="text-xs space-y-1">
                {proposal.soaKnowledgePatch.assessments.slice(0, 12).map((assessment) => (
                  <li key={assessment.id}>
                    {assessment.name}
                    {assessment.category ? ` (${assessment.category})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {proposal.soaKnowledgePatch.scheduleRules && proposal.soaKnowledgePatch.scheduleRules.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Proposed schedule rules</p>
              <ul className="text-xs space-y-1">
                {proposal.soaKnowledgePatch.scheduleRules.slice(0, 10).map((rule) => (
                  <li key={rule.id}>{rule.notes ?? `${rule.assessmentId} → ${rule.visitId}`}</li>
                ))}
              </ul>
            </div>
          ) : null}

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

          {(proposal.diagnostics.length > 0 || proposal.warnings.length > 0) && (
            <div className="space-y-2">
              {proposal.warnings.map((warning) => (
                <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>
              ))}
              {proposal.diagnostics.slice(0, 6).map((note) => (
                <p key={note} className="text-xs text-muted-foreground whitespace-pre-wrap">{note}</p>
              ))}
            </div>
          )}

          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      </ScrollArea>

      {proposal.status === 'proposed' ? (
        <div className="px-4 py-3 border-t border-border flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void handleAccept()} data-testid="soa-proposal-accept">
            Accept Proposal
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={handleReject} data-testid="soa-proposal-reject">
            Reject Proposal
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SoAProposalActions({ compact = false }: { compact?: boolean }) {
  const proposal = useSoAProposal();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const handleGenerate = async () => {
    setRunning(true);
    try {
      await generateFirstPassSoA();
      setReviewOpen(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="soa-proposal-actions">
      <div className={`flex ${compact ? 'flex-col' : 'flex-wrap'} gap-2`}>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={running}
          onClick={() => void handleGenerate()}
          data-testid="soa-generate-first-pass-button"
        >
          {running ? 'Generating…' : 'Generate First-Pass SoA'}
        </Button>
        {proposal?.status === 'proposed' ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs"
            onClick={() => setReviewOpen((open) => !open)}
            data-testid="soa-review-proposal-button"
          >
            Review SoA Proposal
          </Button>
        ) : null}
      </div>
      {proposal ? (
        <p className="text-[11px] text-muted-foreground">
          Last run: {new Date(proposal.createdAt).toLocaleString()} · {proposal.summary}
        </p>
      ) : null}
      {reviewOpen ? <SoAProposalReviewPanel onClose={() => setReviewOpen(false)} /> : null}
    </div>
  );
}

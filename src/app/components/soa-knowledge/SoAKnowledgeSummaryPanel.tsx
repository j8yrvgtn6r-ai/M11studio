import { useSoAKnowledgeModel, useSoAKnowledgeSummary } from '../../domain/soa-knowledge/useSoAKnowledge';
import { getSoAKnowledgeDiagnostics } from '../../domain/soa-knowledge/soaKnowledgeSelectors';
import { useSoAProposal } from '../../domain/soa-knowledge/useSoAProposal';
import { SoAProposalActions } from './SoAProposalReviewPanel';

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function SoAKnowledgeSummaryPanel({ compact = false }: { compact?: boolean }) {
  const summary = useSoAKnowledgeSummary();
  const model = useSoAKnowledgeModel();
  const proposal = useSoAProposal();
  const counts = model
    ? summary
    : proposal
      ? {
          armCount: proposal.counts.arms,
          epochCount: proposal.counts.epochs,
          elementCount: proposal.counts.elements,
          visitCount: proposal.counts.visits,
          activityCount: proposal.counts.activities,
          assessmentCount: proposal.counts.assessments,
          scheduleRuleCount: proposal.counts.scheduleRules,
          conditionCount: proposal.counts.conditions,
        }
      : summary;
  const diagnostics = getSoAKnowledgeDiagnostics(model);

  if (!model && !proposal) {
    return (
      <div
        className="rounded-md border border-border/70 bg-muted/10 p-3 space-y-3 text-xs text-muted-foreground"
        data-testid="soa-knowledge-summary"
      >
        <p>SoA Knowledge will populate after you generate or accept a first-pass SoA proposal.</p>
        <SoAProposalActions compact={compact} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-border/70 bg-muted/10 ${compact ? 'p-3 space-y-2' : 'p-3 space-y-3'}`}
      data-testid="soa-knowledge-summary"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SoA Knowledge</p>
        {proposal?.status === 'proposed' ? (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
            Proposal pending review — accept to update SoA Knowledge.
          </p>
        ) : !compact ? (
          <p className="text-[11px] text-muted-foreground mt-1">
            Structured schedule knowledge bridging narrative, Knowledge Graph, and SoA Configuration.
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <CountRow label="Arms" value={counts.armCount} />
        <CountRow label="Epochs" value={counts.epochCount} />
        <CountRow label="Elements" value={counts.elementCount} />
        <CountRow label="Visits" value={counts.visitCount} />
        <CountRow label="Activities" value={counts.activityCount} />
        <CountRow label="Assessments" value={counts.assessmentCount} />
        <CountRow label="Schedule Rules" value={counts.scheduleRuleCount} />
        <CountRow label="Conditions" value={counts.conditionCount} />
      </div>

      {(diagnostics.extractionNotes.length > 0 ||
        diagnostics.unmappedTimingReferences.length > 0 ||
        diagnostics.ambiguousScheduleStatements.length > 0) && !compact ? (
        <div className="space-y-2 pt-1 border-t border-border/50">
          <p className="text-[11px] font-medium text-muted-foreground">Diagnostics</p>
          {diagnostics.extractionNotes.slice(0, 3).map((note) => (
            <p key={note} className="text-[11px] text-muted-foreground whitespace-pre-wrap">
              {note}
            </p>
          ))}
          {diagnostics.ambiguousScheduleStatements.slice(0, 2).map((note) => (
            <p key={note} className="text-[11px] text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      <SoAProposalActions compact={compact} />
    </div>
  );
}

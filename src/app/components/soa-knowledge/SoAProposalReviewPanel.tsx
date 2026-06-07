import { useState } from 'react';



import {

  acceptCurrentSoAProposal,

  generateFirstPassSoA,

  rejectCurrentSoAProposal,

} from '../../agents/soaAgentRunner';

import { getCurrentSoANarrativeSyncProposal } from '../../domain/soa-knowledge/soaNarrativeSyncStore';

import { useSoAProposal } from '../../domain/soa-knowledge/useSoAProposal';

import { Badge } from '../ui/badge';

import { Button } from '../ui/button';

import { ScrollArea } from '../ui/scroll-area';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

import { SoAMatrixProposalPreviewPanel } from './SoAMatrixProposalPreview';



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

  const narrativeSync = getCurrentSoANarrativeSyncProposal();

  const [busy, setBusy] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  const [tab, setTab] = useState('summary');



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



      <Tabs value={tab} onValueChange={setTab} className="px-4 pt-3">

        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">

          <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>

          <TabsTrigger value="matrix" className="text-xs">Matrix Preview</TabsTrigger>

          <TabsTrigger value="items" className="text-xs">Extracted Items</TabsTrigger>

          <TabsTrigger value="evidence" className="text-xs">Evidence</TabsTrigger>

          <TabsTrigger value="diagnostics" className="text-xs">Diagnostics</TabsTrigger>

          <TabsTrigger value="narrative-sync" className="text-xs">Narrative Sync</TabsTrigger>

        </TabsList>



        <ScrollArea className="max-h-[420px]">

          <TabsContent value="summary" className="space-y-4 mt-3">

            {proposal.sourceSummary ? (

              <div className="grid grid-cols-2 gap-2">

                <CountRow label="Narrative-derived" value={proposal.sourceSummary.narrativeDerivedCount} />

                <CountRow label="Table-derived" value={proposal.sourceSummary.tableDerivedCount} />

                <CountRow label="LLM-inferred" value={proposal.sourceSummary.llmInferredCount} />

                <CountRow label="Conflicts" value={proposal.sourceSummary.conflictsCount} />

                <CountRow label="Diagnostics" value={proposal.sourceSummary.diagnosticsCount} />

              </div>

            ) : null}

            <div className="grid grid-cols-2 gap-2">

              <CountRow label="Visits" value={proposal.counts.visits} />

              <CountRow label="Assessments" value={proposal.counts.assessments} />

              <CountRow label="Schedule Rules" value={proposal.counts.scheduleRules} />

              <CountRow label="Conditions" value={proposal.counts.conditions} />

            </div>

          </TabsContent>



          <TabsContent value="matrix" className="mt-3">

            <SoAMatrixProposalPreviewPanel preview={proposal.matrixPreview} />

          </TabsContent>



          <TabsContent value="items" className="space-y-4 mt-3">

            {proposal.soaKnowledgePatch.visits && proposal.soaKnowledgePatch.visits.length > 0 ? (

              <div>

                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Proposed visits</p>

                <ul className="text-xs space-y-1">

                  {proposal.soaKnowledgePatch.visits.slice(0, 20).map((visit) => (

                    <li key={visit.id}>{visit.name}</li>

                  ))}

                </ul>

              </div>

            ) : null}

            {proposal.soaKnowledgePatch.assessments && proposal.soaKnowledgePatch.assessments.length > 0 ? (

              <div>

                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Proposed assessments</p>

                <ul className="text-xs space-y-1">

                  {proposal.soaKnowledgePatch.assessments.slice(0, 20).map((assessment) => (

                    <li key={assessment.id}>

                      {assessment.name}

                      {assessment.category ? ` (${assessment.category})` : ''}

                    </li>

                  ))}

                </ul>

              </div>

            ) : null}

          </TabsContent>



          <TabsContent value="evidence" className="space-y-2 mt-3">

            {(proposal.tableExtraction?.cellEvidence ?? []).slice(0, 30).map((evidence, index) => (

              <div key={`${evidence.tableId}-${index}`} className="rounded border border-border/70 p-2 text-xs">

                <p className="font-medium">Table {evidence.tableId}</p>

                <p className="text-muted-foreground">

                  Row {evidence.rowIndex + 1}, Col {evidence.columnIndex + 1}: “{evidence.sourceCellText}”

                </p>

                {evidence.sourceSectionId ? <p>Section {evidence.sourceSectionId}</p> : null}

                {evidence.headingContext.length > 0 ? (

                  <p className="text-muted-foreground">Heading: {evidence.headingContext.join(' › ')}</p>

                ) : null}

              </div>

            ))}

            {(proposal.tableExtraction?.cellEvidence.length ?? 0) === 0 ? (

              <p className="text-xs text-muted-foreground">No table cell evidence captured for this proposal.</p>

            ) : null}

          </TabsContent>



          <TabsContent value="diagnostics" className="space-y-2 mt-3">

            {proposal.warnings.map((warning) => (

              <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>

            ))}

            {proposal.diagnostics.slice(0, 20).map((note) => (

              <p key={note} className="text-xs text-muted-foreground whitespace-pre-wrap">{note}</p>

            ))}

            {(proposal.tableExtraction?.diagnostics ?? []).map((diag) => (

              <p key={`${diag.code}-${diag.message}`} className="text-xs text-muted-foreground">

                [{diag.code}] {diag.message}

              </p>

            ))}

          </TabsContent>



          <TabsContent value="narrative-sync" className="space-y-2 mt-3">

            {proposal.impactedNarrativeSections.map((entry) => (

              <p key={entry.sectionId} className="text-xs">

                Section {entry.sectionId}: {entry.reason}

              </p>

            ))}

            {narrativeSync ? (

              <div className="rounded border border-border/70 p-2 text-xs space-y-1" data-testid="soa-narrative-sync-proposal">

                <p className="font-medium">Pending narrative sync proposal</p>

                {narrativeSync.proposedNarrativeUpdates.map((update) => (

                  <p key={update.sectionId}>{update.suggestedNote}</p>

                ))}

              </div>

            ) : (

              <p className="text-xs text-muted-foreground">

                Narrative sync proposals are created after you accept a SoA proposal.

              </p>

            )}

          </TabsContent>

        </ScrollArea>

      </Tabs>



      {message ? <p className="px-4 pb-2 text-xs text-muted-foreground">{message}</p> : null}



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


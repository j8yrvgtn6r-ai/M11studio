import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';

import {
  approveSectionImportDraft,
  requestChangesOnSectionImportDraft,
} from '../../domain/protocol/import';
import type { GeneratedSectionDraft } from '../../domain/protocol/import';
import { useProtocolImport } from '../../domain/protocol/import/ProtocolImportContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { ImportProtocolSourceActions } from './ImportProtocolSourceActions';
import { SectionImportReviewScreen } from './SectionImportReviewScreen';

interface ProtocolImportReviewWorkspaceProps {
  onBack: () => void;
  initialSectionId?: string | null;
  templateReferenceEnabled: boolean;
}

function reviewStatusBadge(status: GeneratedSectionDraft['reviewStatus']) {
  switch (status) {
    case 'approved':
      return <Badge variant="secondary">Approved</Badge>;
    case 'changes-requested':
      return <Badge variant="outline">Changes requested</Badge>;
    default:
      return <Badge variant="outline">Pending review</Badge>;
  }
}

function validationBadge(status: GeneratedSectionDraft['validationStatus']) {
  switch (status) {
    case 'passed':
      return <Badge className="bg-green-600/90">Validation passed</Badge>;
    case 'warnings':
      return <Badge variant="outline" className="text-amber-600 border-amber-500/40">Warnings</Badge>;
    case 'failed':
      return <Badge variant="destructive">Validation failed</Badge>;
    default:
      return <Badge variant="outline">Not run</Badge>;
  }
}

export function ProtocolImportReviewWorkspace({
  onBack,
  initialSectionId = null,
  templateReferenceEnabled,
}: ProtocolImportReviewWorkspaceProps) {
  const { state, summary } = useProtocolImport();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId);

  const drafts = useMemo(
    () =>
      Object.values(state.sectionDrafts).sort((left, right) =>
        left.title.localeCompare(right.title, undefined, { numeric: true }),
      ),
    [state.sectionDrafts],
  );

  if (activeSectionId && state.sectionDrafts[activeSectionId]) {
    return (
      <SectionImportReviewScreen
        sectionId={activeSectionId}
        templateReferenceEnabled={templateReferenceEnabled}
        onBack={() => setActiveSectionId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="protocol-import-review-workspace">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to protocol
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Review Imported Protocol
            </h1>
            <p className="text-sm text-muted-foreground">
              {state.artifact?.filename ?? 'Uploaded protocol'} · {summary.totalGenerated} generated sections
            </p>
          </div>
        </div>
        <ImportProtocolSourceActions disabled={!state.artifact} />
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-border bg-muted/10 shrink-0">
        <SummaryTile label="Pending review" value={summary.pendingReview} />
        <SummaryTile label="Approved" value={summary.approved} />
        <SummaryTile label="Validation warnings" value={summary.validationWarnings} />
        <SummaryTile label="Validation errors" value={summary.validationErrors} />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2 max-w-4xl">
          {drafts.map((draft) => (
            <div
              key={draft.sectionId}
              className="rounded-lg border border-border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3"
              data-testid={`import-review-row-${draft.sectionId}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{draft.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{draft.generatedText}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {reviewStatusBadge(draft.reviewStatus)}
                  {validationBadge(draft.validationStatus)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`import-review-open-${draft.sectionId}`}
                  onClick={() => setActiveSectionId(draft.sectionId)}
                >
                  Review
                </Button>
                {draft.reviewStatus === 'pending-review' ? (
                  <>
                    <Button
                      size="sm"
                      data-testid={`import-approve-${draft.sectionId}`}
                      onClick={() => approveSectionImportDraft(draft.sectionId)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => requestChangesOnSectionImportDraft(draft.sectionId)}
                    >
                      Request Changes
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

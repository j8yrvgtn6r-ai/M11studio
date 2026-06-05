import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck, Download } from 'lucide-react';

import {
  approveSectionImportDraft,
  downloadM11StudioArchive,
  isSectionActionable,
  openSectionForReview,
  requestChangesOnSectionImportDraft,
} from '../../domain/protocol/import';
import type { GeneratedSectionDraft } from '../../domain/protocol/import';
import { useProtocolImport } from '../../domain/protocol/import/ProtocolImportContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { HumanReviewNotice } from './HumanReviewNotice';
import { ImportLlmProviderStatusPanel } from './ImportLlmProviderStatusPanel';
import { ImportProtocolSourceActions } from './ImportProtocolSourceActions';
import { ProtocolKnowledgePanel } from './ProtocolKnowledgePanel';
import { SectionImportReviewScreen } from './SectionImportReviewScreen';
import { SectionStateBadge } from './sectionStateBadge';
import { SourceExtractionPanel } from './SourceExtractionPanel';
import { VersionHistoryPanel } from './VersionHistoryPanel';

interface ProtocolImportReviewWorkspaceProps {
  onBack: () => void;
  initialSectionId?: string | null;
  templateReferenceEnabled: boolean;
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
      return <Badge variant="outline">Validation not run</Badge>;
  }
}

export function ProtocolImportReviewWorkspace({
  onBack,
  initialSectionId = null,
  templateReferenceEnabled,
}: ProtocolImportReviewWorkspaceProps) {
  const { state, summary } = useProtocolImport();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId);
  const [activeTab, setActiveTab] = useState<'sections' | 'extraction' | 'knowledge' | 'versions'>('sections');

  const drafts = useMemo(
    () =>
      Object.values(state.sectionDrafts).sort((left, right) =>
        left.title.localeCompare(right.title, undefined, { numeric: true }),
      ),
    [state.sectionDrafts],
  );

  const handleOpenReview = (sectionId: string) => {
    openSectionForReview(sectionId);
    setActiveSectionId(sectionId);
  };

  const handleExportArchive = () => {
    void downloadM11StudioArchive();
  };

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
              {state.artifact?.filename ?? 'Uploaded protocol'} · {summary.totalGenerated} proposal sections
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid="export-archive-button"
            onClick={handleExportArchive}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export Archive
          </Button>
          <ImportProtocolSourceActions disabled={!state.artifact} />
        </div>
      </header>

      <div className="px-4 pt-3 shrink-0 space-y-3">
        <ImportLlmProviderStatusPanel />
        <HumanReviewNotice compact />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 border-b border-border bg-muted/10 shrink-0">
        <SummaryTile label="Pending review" value={summary.pendingReview} />
        <SummaryTile label="In review" value={summary.inReview} />
        <SummaryTile label="Validation passed" value={summary.validationPassed} />
        <SummaryTile label="Changes requested" value={summary.changesRequested} />
        <SummaryTile label="Validation failed" value={summary.validationFailed} />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList className="mx-4 mt-3 w-fit shrink-0 flex-wrap h-auto">
          <TabsTrigger value="sections">Section review</TabsTrigger>
          <TabsTrigger value="knowledge" data-testid="import-tab-protocol-knowledge">
            Protocol knowledge
          </TabsTrigger>
          <TabsTrigger value="extraction" data-testid="import-tab-source-extraction">
            Source extraction
          </TabsTrigger>
          <TabsTrigger value="versions" data-testid="import-tab-version-history">
            Version history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
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
                      <SectionStateBadge state={draft.state} />
                      {validationBadge(draft.validationStatus)}
                      <Badge variant="outline" className="text-[10px]">
                        {draft.generationProvider}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        v{draft.draftVersion}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`import-review-open-${draft.sectionId}`}
                      onClick={() => handleOpenReview(draft.sectionId)}
                    >
                      Review
                    </Button>
                    {isSectionActionable(draft.state) ? (
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
        </TabsContent>

        <TabsContent value="knowledge" className="flex-1 min-h-0 mt-0">
          <ProtocolKnowledgePanel />
        </TabsContent>

        <TabsContent value="extraction" className="flex-1 min-h-0 mt-0">
          <SourceExtractionPanel />
        </TabsContent>

        <TabsContent value="versions" className="flex-1 min-h-0 mt-0">
          <VersionHistoryPanel />
        </TabsContent>
      </Tabs>
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

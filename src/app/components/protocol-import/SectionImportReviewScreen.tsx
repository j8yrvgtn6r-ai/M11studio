import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import {
  approveSectionImportDraft,
  findRelevantSourceCandidates,
  isSectionActionable,
  isSectionApproved,
  openSectionForReview,
  regenerateSectionImportDraftAsync,
  requestChangesOnSectionImportDraft,
  updateSectionImportDraft,
} from '../../domain/protocol/import';
import { useProtocolImport, useSectionImportDraft } from '../../domain/protocol/import/ProtocolImportContext';
import { SectionAuthoringCanvas } from '../m11-template-reference/SectionAuthoringCanvas';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { GenerationMetadataPanel } from './GenerationMetadataPanel';
import { HumanReviewNotice } from './HumanReviewNotice';
import { ImportProtocolSourceActions } from './ImportProtocolSourceActions';
import { SectionStateBadge, sectionStateLabel } from './sectionStateBadge';

interface SectionImportReviewScreenProps {
  sectionId: string;
  templateReferenceEnabled: boolean;
  onBack: () => void;
}

export function SectionImportReviewScreen({
  sectionId,
  templateReferenceEnabled,
  onBack,
}: SectionImportReviewScreenProps) {
  const draft = useSectionImportDraft(sectionId);
  const { importedSource } = useProtocolImport();
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    openSectionForReview(sectionId);
  }, [sectionId]);

  if (!draft) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Section draft not found.
        <Button variant="link" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const relevantSource =
    importedSource && draft.matchedSourceCandidateIds.length > 0
      ? importedSource.sections.filter((section) =>
          draft.matchedSourceCandidateIds.includes(section.id),
        )
      : importedSource
        ? findRelevantSourceCandidates(sectionId, draft.title, importedSource.sections)
        : [];

  return (
    <div className="flex flex-col h-full" data-testid="section-import-review-screen">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 shrink-0">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{draft.title}</h2>
            <p className="text-xs text-muted-foreground">
              Proposal draft · {sectionStateLabel(draft.state)} · {draft.generationProvider}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            size="sm"
            data-testid="import-section-approve"
            disabled={!isSectionActionable(draft.state)}
            onClick={() => approveSectionImportDraft(sectionId)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isSectionApproved(draft.state)}
            onClick={() => requestChangesOnSectionImportDraft(sectionId)}
          >
            Request Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="import-section-regenerate"
            disabled={regenerating}
            onClick={() => {
              setRegenerating(true);
              void regenerateSectionImportDraftAsync(sectionId).finally(() => setRegenerating(false));
            }}
          >
            {regenerating ? 'Regenerating…' : 'Regenerate Section'}
          </Button>
        </div>
      </header>

      <SectionAuthoringCanvas
        templateReferenceOpen={templateReferenceEnabled}
        sectionId={sectionId}
        sectionTitle={draft.title}
      >
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl space-y-4">
            <HumanReviewNotice compact />

            <div className="space-y-2" data-testid="import-original-protocol-reference">
              <Label>Original protocol reference</Label>
              <ImportProtocolSourceActions />
              {relevantSource.length > 0 ? (
                <div className="space-y-2">
                  {relevantSource.map((section) => (
                    <div
                      key={section.id}
                      className="rounded-md border border-border bg-muted/20 p-3 text-xs"
                      data-testid={`import-matched-source-${section.id}`}
                    >
                      <div className="flex flex-wrap gap-2 mb-1">
                        <p className="font-medium text-sm">{section.headingText}</p>
                        {section.possibleM11SectionId ? (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            M11 {section.possibleM11SectionId}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-[10px]">
                          {Math.round(section.confidence * 100)}%
                        </Badge>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap line-clamp-6">{section.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No mapped source section candidates for this M11 section. Open Source extraction for the full
                  candidate list.
                </p>
              )}
            </div>

            <GenerationMetadataPanel draft={draft} />

            <div className="flex flex-wrap gap-2">
              <SectionStateBadge state={draft.state} />
              <Badge variant="outline">Validation: {draft.validationStatus}</Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-generated-text">Generated M11 text (proposal — edit before approval)</Label>
              <Textarea
                id="import-generated-text"
                className="min-h-[280px] font-mono text-sm"
                value={draft.generatedText}
                data-testid="import-section-generated-text"
                onChange={(event) =>
                  updateSectionImportDraft(sectionId, {
                    generatedText: event.target.value,
                  })
                }
              />
            </div>

            {(draft.validationMessages ?? []).length > 0 ? (
              <Alert data-testid="import-validation-results">
                <AlertTitle>Validation results</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    {(draft.validationMessages ?? []).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Validation supports review; it does not replace human approval.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </ScrollArea>
      </SectionAuthoringCanvas>
    </div>
  );
}

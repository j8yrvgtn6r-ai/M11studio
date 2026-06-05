import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import {
  approveSectionImportDraft,
  requestChangesOnSectionImportDraft,
  updateSectionImportDraft,
} from '../../domain/protocol/import';
import { useSectionImportDraft } from '../../domain/protocol/import/ProtocolImportContext';
import { SectionAuthoringCanvas } from '../m11-template-reference/SectionAuthoringCanvas';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { ImportProtocolSourceActions } from './ImportProtocolSourceActions';

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
            <p className="text-xs text-muted-foreground">Generated M11 section · {draft.reviewStatus}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            size="sm"
            data-testid="import-section-approve"
            disabled={draft.reviewStatus === 'approved'}
            onClick={() => approveSectionImportDraft(sectionId)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => requestChangesOnSectionImportDraft(sectionId)}
          >
            Request Changes
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
            <ImportProtocolSourceActions />

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Review: {draft.reviewStatus}</Badge>
              <Badge variant="outline">Validation: {draft.validationStatus}</Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-generated-text">Generated M11 text</Label>
              <Textarea
                id="import-generated-text"
                className="min-h-[280px] font-mono text-sm"
                value={draft.generatedText}
                data-testid="import-section-generated-text"
                onChange={(event) =>
                  updateSectionImportDraft(sectionId, {
                    generatedText: event.target.value,
                    reviewStatus: 'pending-review',
                    validationStatus: 'not-run',
                    validationMessages: [],
                  })
                }
              />
            </div>

            {draft.validationMessages.length > 0 ? (
              <Alert>
                <AlertTitle>Validation results</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    {draft.validationMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </ScrollArea>
      </SectionAuthoringCanvas>
    </div>
  );
}

import { Badge } from './ui/badge';

import { Input } from './ui/input';

import { Textarea } from './ui/textarea';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

import { Label } from './ui/label';

import { ScrollArea } from './ui/scroll-area';

import { Sparkles, Link2, RefreshCw, CheckCircle2, FileText, Loader2 } from 'lucide-react';

import type { GeneratedSectionDraft } from '../domain/protocol/import';

import {

  acceptSectionValidation,

  approveSectionImportDraft,

  isSectionActionable,

  isSectionApproved,

  regenerateSectionImportDraftAsync,

  generateSectionImportDraftOnDemandAsync,

  isPriorityGenerationContextReady,

  rejectSectionValidation,

  runSectionValidation,

} from '../domain/protocol/import';

import { inferWorkflowState, isValidationReviewReady } from '../domain/protocol/import/sectionWorkflowState';

import { SectionValidationReviewPanel } from './protocol-import/SectionValidationReviewPanel';
import { ConsistencyImpactReviewPanel } from './protocol-import/ConsistencyImpactReviewPanel';

import { useProtocolImport } from '../domain/protocol/import/ProtocolImportContext';

import type { SectionGenerationState } from '../domain/protocol/build/protocolBuildConsoleStore';

import {
  resolveSectionWorkflowDisplayBadge,
  sectionWorkflowDisplayBadgeClass,
  shouldShowRequiredMissing,
} from '../domain/protocol/import/sectionDisplayStatus';

import type { ProtocolSection, FieldDefinition } from '../types/protocol';

import { getStatusColor, getStatusLabel } from '../utils/statusColors';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';

import { Button } from './ui/button';

import { useState } from 'react';



interface DocumentViewportProps {

  section: ProtocolSection | null;

  fields: FieldDefinition[];

  onFieldChange: (fieldId: string, value: any) => void;

  importDraft?: GeneratedSectionDraft;

  onImportDraftTextChange?: (text: string) => void;

  sectionGenerationState?: SectionGenerationState;

  buildActive?: boolean;

}



export function DocumentViewport({

  section,

  fields,

  onFieldChange,

  importDraft,

  onImportDraftTextChange,

  sectionGenerationState,

  buildActive = false,

}: DocumentViewportProps) {

  const [regenerating, setRegenerating] = useState(false);
  const { revision: importRevision } = useProtocolImport();
  const generationContextReady = isPriorityGenerationContextReady();
  void importRevision;



  if (!section) {

    return (

      <div className="flex items-center justify-center h-full bg-background text-muted-foreground">

        <div className="text-center">

          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />

          <p>Select a section from the Protocol Explorer to begin editing</p>

        </div>

      </div>

    );

  }



  const statusColor = getStatusColor(section.status);
  const workflowBadge = resolveSectionWorkflowDisplayBadge({
    draft: importDraft,
    generationState: sectionGenerationState,
  });
  const showLegacyRequiredMissing =
    shouldShowRequiredMissing({
      draft: importDraft,
      generationState: sectionGenerationState,
      hasValidatedText: Boolean(importDraft?.validatedTargetText?.trim()),
    }) && section.status === 'requiredMissing';

  const showQueuedState = buildActive && !importDraft && sectionGenerationState === 'queued';

  const showGeneratingState = buildActive && !importDraft && sectionGenerationState === 'generating';

  const showNotGeneratedState =
    !importDraft &&
    (sectionGenerationState === 'notGenerated' || sectionGenerationState === 'needsGeneration');

  const workflowState = importDraft ? inferWorkflowState(importDraft) : null;

  const isImportedUnvalidatedSection =
    workflowState === 'importedUnvalidated' || workflowState === 'imported';

  const isGeneratedSection = importDraft?.contentOrigin === 'generated' || workflowState === 'generated';

  const isValidationRunning = workflowState === 'validationRunning';

  const isValidationProposedSection = isValidationReviewReady(importDraft ?? undefined);

  const isUnvalidatedSection = workflowState === 'unvalidated' || isValidationProposedSection;

  const canShowValidateButton =
    importDraft &&
    !isValidationRunning &&
    !isValidationProposedSection &&
    (isImportedUnvalidatedSection || isGeneratedSection);

  const isOutOfSyncSection =
    sectionGenerationState === 'outOfSync' || workflowState === 'outOfSync' || importDraft?.workflowState === 'outOfSync';

  return (

    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* Breadcrumb and Status Bar */}

      <div className="px-4 py-3 border-b border-border bg-card shrink-0">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <h2 className="font-semibold">{section?.title ?? section.id}</h2>

            {workflowBadge ? (
              <Badge
                variant="outline"
                className={`text-xs ${sectionWorkflowDisplayBadgeClass(workflowBadge)}`}
                data-testid="viewport-workflow-state-badge"
              >
                {workflowBadge}
              </Badge>
            ) : showLegacyRequiredMissing ? (
              <Badge variant="outline" className={`${statusColor.text} ${statusColor.border}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} mr-1.5`} />
                {getStatusLabel(section.status)}
              </Badge>
            ) : section.status !== 'complete' ? (
              <Badge variant="outline" className={`${statusColor.text} ${statusColor.border}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} mr-1.5`} />
                {getStatusLabel(section.status)}
              </Badge>
            ) : null}

          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">

            {importDraft ? (

              <>

                {canShowValidateButton ? (

                  <Button

                    size="sm"

                    data-testid="viewport-validate-section"

                    onClick={() => runSectionValidation(section.id)}

                  >

                    Validate

                  </Button>

                ) : isValidationRunning ? (

                  <Button size="sm" disabled data-testid="viewport-validate-running">

                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />

                    Validating…

                  </Button>

                ) : isGeneratedSection ? (

                <Button

                  size="sm"

                  data-testid="viewport-import-section-approve"

                  disabled={!isSectionActionable(importDraft.state)}

                  onClick={() => approveSectionImportDraft(section.id)}

                >

                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />

                  Approve

                </Button>

                ) : null}

                {isGeneratedSection ? (

                <Button

                  size="sm"

                  variant="outline"

                  data-testid="viewport-import-section-regenerate"

                  disabled={regenerating || isSectionApproved(importDraft.state)}

                  onClick={() => {

                    setRegenerating(true);

                    void regenerateSectionImportDraftAsync(section.id).finally(() => setRegenerating(false));

                  }}

                >

                  {regenerating ? 'Regenerating…' : 'Regenerate'}

                </Button>

                ) : null}

              </>

            ) : null}

            <Badge variant="secondary" className="text-xs">

              Conformance: {section.conformance}

            </Badge>

          </div>

        </div>

      </div>



      {/* Document Content */}

      <ScrollArea className="flex-1 min-h-0" data-testid="document-viewport-scroll">

        <div
          className={`p-6 max-w-5xl ${importDraft && isValidationProposedSection ? 'flex flex-col min-h-[calc(100vh-14rem)]' : ''}`}
        >

          {showNotGeneratedState ? (
            <Alert data-testid="viewport-section-not-generated">
              <AlertTitle>
                {sectionGenerationState === 'needsGeneration' ? 'Needs generation' : 'Not generated yet'}
              </AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {sectionGenerationState === 'needsGeneration'
                    ? 'Source mapping was uncertain or no confident source body was found. This section will be generated or requires manual review.'
                    : generationContextReady
                      ? 'This section has not been generated yet. Generate this section when needed.'
                      : 'Generation unavailable until Core Study Model is ready.'}
                </p>
                <Button
                  size="sm"
                  data-testid="viewport-generate-section"
                  disabled={regenerating || !generationContextReady}
                  onClick={() => {
                    if (!generationContextReady) {
                      return;
                    }
                    setRegenerating(true);
                    void generateSectionImportDraftOnDemandAsync(section.id).finally(() => setRegenerating(false));
                  }}
                >
                  {regenerating ? 'Generating…' : 'Generate Section'}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {showQueuedState ? (

            <Alert data-testid="viewport-section-queued">

              <AlertTitle>Queued for generation</AlertTitle>

              <AlertDescription>

                This section is queued for generation. You can continue reviewing other sections while reconstruction

                runs.

              </AlertDescription>

            </Alert>

          ) : null}



          {showGeneratingState ? (

            <Alert data-testid="viewport-section-generating">

              <Loader2 className="h-4 w-4 animate-spin" />

              <AlertTitle>Currently generating</AlertTitle>

              <AlertDescription>

                This section is currently being generated. Select a completed section to review its draft while

                reconstruction continues.

              </AlertDescription>

            </Alert>

          ) : null}



          {importDraft && isOutOfSyncSection ? (
            <ConsistencyImpactReviewPanel
              sectionId={section.id}
              draft={importDraft}
              onManualEdit={() => {
                document.getElementById('viewport-import-generated-text')?.focus();
              }}
            />
          ) : null}



          {importDraft && isValidationRunning ? (
            <Alert data-testid="viewport-validation-running">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Validation running</AlertTitle>
              <AlertDescription>
                Validation Agent is checking M11 structure and controlled terminology for this section.
              </AlertDescription>
            </Alert>
          ) : null}

          {importDraft && isValidationProposedSection ? (

            <div className="flex flex-1 min-h-0 flex flex-col">

            <SectionValidationReviewPanel

              sectionId={section.id}

              draft={importDraft}

              onAccept={() => acceptSectionValidation(section.id)}

              onReject={() => rejectSectionValidation(section.id)}

            />

            </div>

          ) : null}



          {importDraft && isImportedUnvalidatedSection && !isValidationProposedSection && !isValidationRunning ? (

            <div className="space-y-3 mb-8">

              <Label htmlFor="viewport-imported-text">Imported protocol text (pending validation)</Label>

              <Textarea

                id="viewport-imported-text"

                className="min-h-[240px] text-sm"

                value={importDraft.generatedText}

                data-testid="viewport-import-generated-text"

                onChange={(event) => onImportDraftTextChange?.(event.target.value)}

              />

            </div>

          ) : null}



          {importDraft && isGeneratedSection && !isUnvalidatedSection ? (

            <div className="space-y-3 mb-8">

              <Label htmlFor="viewport-import-draft">Generated M11 section (pending approval)</Label>

              <Textarea

                id="viewport-import-draft"

                className="min-h-[240px] text-sm"

                value={importDraft.generatedText}

                data-testid="viewport-import-generated-text"

                onChange={(event) => onImportDraftTextChange?.(event.target.value)}

              />

            </div>

          ) : null}



          {fields.length > 0 ? (

            <div className="space-y-6">

              {fields.map((field) => (

                <FieldEditor key={field.id} field={field} onFieldChange={onFieldChange} />

              ))}

            </div>

          ) : section.ichM11InstructionOnly ? (

            <div className="text-center py-12 max-w-lg mx-auto">

              <FileText className="h-10 w-10 mx-auto mb-4 opacity-50 text-muted-foreground" />

              <p className="text-muted-foreground">

                This section contains template instructions from the ICH M11 Template and is not part of the

                finalized protocol body.

              </p>

            </div>

          ) : section.ichM11TemplateOnly && !importDraft ? (

            <div className="text-center py-12 max-w-lg mx-auto">

              <FileText className="h-10 w-10 mx-auto mb-4 opacity-50 text-muted-foreground" />

              <p className="text-muted-foreground">

                This section is defined by the ICH M11 Template but has not yet been authored.

              </p>

            </div>

          ) : !importDraft && !showQueuedState && !showGeneratingState && !showNotGeneratedState ? (

            <div className="text-center py-12">

              <p className="text-muted-foreground">

                No editable fields in this section. Select a different section to edit.

              </p>

            </div>

          ) : null}

        </div>

      </ScrollArea>

    </div>

  );

}



function FieldEditor({ field, onFieldChange }: { field: FieldDefinition; onFieldChange: (fieldId: string, value: any) => void }) {

  const renderFieldBadges = () => (

    <div className="flex flex-wrap items-center gap-1.5 mt-1">

      {field.requiredness === 'required' && (

        <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400 border-red-500/30">

          Required

        </Badge>

      )}

      {field.requiredness === 'conditional' && (

        <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30">

          Conditional

        </Badge>

      )}

      {field.repeatable && (

        <Badge variant="outline" className="text-xs">

          <RefreshCw className="h-2.5 w-2.5 mr-1" />

          Repeatable

        </Badge>

      )}

      {field.reusable && (

        <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30">

          <Link2 className="h-2.5 w-2.5 mr-1" />

          Reused

        </Badge>

      )}

      {field.controlledTerminology && (

        <Badge variant="outline" className="text-xs">

          Controlled Terminology

        </Badge>

      )}

      {field.aiHints && field.aiHints.length > 0 && (

        <Badge variant="outline" className="text-xs text-violet-600 dark:text-violet-400 border-violet-500/30">

          <Sparkles className="h-2.5 w-2.5 mr-1" />

          AI Hint Available

        </Badge>

      )}

    </div>

  );



  const renderField = () => {

    if (field.controlledTerminology) {

      return (

        <Select value={field.value || ''} onValueChange={(value) => onFieldChange(field.id, value)}>

          <SelectTrigger className="bg-input-background">

            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />

          </SelectTrigger>

          <SelectContent>

            {field.controlledTerminology.values.map((value, index) => {

              const label = typeof value === 'string' ? value : value.label;

              return (

                <SelectItem key={index} value={label}>

                  {label}

                </SelectItem>

              );

            })}

          </SelectContent>

        </Select>

      );

    }



    if (field.dataType === 'rich_text' || field.kind === 'data') {

      return (

        <Textarea

          value={field.value || ''}

          onChange={(e) => onFieldChange(field.id, e.target.value)}

          placeholder={`Enter ${field.label.toLowerCase()}`}

          className="min-h-[100px] bg-input-background"

        />

      );

    }



    return (

      <Input

        type="text"

        value={field.value || ''}

        onChange={(e) => onFieldChange(field.id, e.target.value)}

        placeholder={`Enter ${field.label.toLowerCase()}`}

        className="bg-input-background"

      />

    );

  };



  return (

    <div className="space-y-2 p-4 rounded-lg border border-border bg-card/50">

      <div className="flex items-start justify-between">

        <div className="flex-1">

          <Label htmlFor={field.id} className="text-sm font-medium">

            {field.label}

          </Label>

          {renderFieldBadges()}

          {field.aiHints && field.aiHints.length > 0 && (

            <p className="text-xs text-muted-foreground mt-1.5 italic">

              <Sparkles className="h-3 w-3 inline mr-1" />

              {field.aiHints[0]}

            </p>

          )}

        </div>

        {field.value && (

          <CheckCircle2 className="h-4 w-4 text-green-500 ml-2" />

        )}

      </div>

      <div id={field.id}>{renderField()}</div>

    </div>

  );

}



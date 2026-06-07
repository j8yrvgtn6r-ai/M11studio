import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Sparkles, Link2, RefreshCw, CheckCircle2, FileText, Loader2, Pencil } from 'lucide-react';
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
import {
  resolveTitlePagePlaceholder,
  resolveTitlePageSelectPlaceholder,
} from '../domain/protocol/authoring/titlePagePlaceholders';
import type { ProtocolSection, FieldDefinition } from '../types/protocol';
import { getStatusColor, getStatusLabel } from '../utils/statusColors';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { RichTextEditor, RichTextReadOnlyView } from './authoring/RichTextEditor';
import { resolveSectionEditorContent } from '../domain/protocol/import/sectionAuthoring';
import { useEffect, useRef, useState } from 'react';

interface DocumentViewportProps {
  section: ProtocolSection | null;
  fields: FieldDefinition[];
  onFieldChange: (fieldId: string, value: unknown) => void;
  importDraft?: GeneratedSectionDraft;
  onImportDraftTextChange?: (text: string) => void;
  onManualSectionEdit?: (text: string) => void;
  onApplyManualSectionSave?: (text: string) => void;
  sectionGenerationState?: SectionGenerationState;
  buildActive?: boolean;
}

export function DocumentViewport({
  section,
  fields,
  onFieldChange,
  importDraft,
  onImportDraftTextChange,
  onManualSectionEdit,
  onApplyManualSectionSave,
  sectionGenerationState,
  buildActive = false,
}: DocumentViewportProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [editBaseline, setEditBaseline] = useState('');
  const [blankBuffer, setBlankBuffer] = useState('');
  const blankPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { revision: importRevision } = useProtocolImport();
  const generationContextReady = isPriorityGenerationContextReady();
  void importRevision;

  const sectionText = resolveSectionEditorContent(importDraft);
  const hasSectionContent = Boolean(sectionText.trim());

  useEffect(() => {
    setIsEditing(false);
    setEditBuffer('');
    setEditBaseline('');
    setBlankBuffer('');
    if (blankPersistTimer.current) {
      clearTimeout(blankPersistTimer.current);
      blankPersistTimer.current = null;
    }
    if (draftPersistTimer.current) {
      clearTimeout(draftPersistTimer.current);
      draftPersistTimer.current = null;
    }
  }, [section?.id]);

  useEffect(() => {
    if (!isEditing) {
      setEditBuffer(sectionText);
      setEditBaseline(sectionText);
    }
  }, [section?.id, importDraft?.sectionId, sectionText, isEditing]);

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
  const showBlankAuthoring =
    !importDraft &&
    !showQueuedState &&
    !showGeneratingState &&
    fields.length === 0 &&
    !section.ichM11InstructionOnly;

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
    sectionGenerationState === 'outOfSync' ||
    workflowState === 'outOfSync' ||
    importDraft?.workflowState === 'outOfSync';

  const showDraftEditor =
    Boolean(importDraft) &&
    !isValidationProposedSection &&
    !isValidationRunning &&
    (isEditing || !hasSectionContent);

  const showDraftReadOnly =
    Boolean(importDraft) &&
    !isValidationProposedSection &&
    !isValidationRunning &&
    !isEditing &&
    hasSectionContent;

  const queueBlankPersist = (text: string) => {
    if (blankPersistTimer.current) {
      clearTimeout(blankPersistTimer.current);
    }
    blankPersistTimer.current = setTimeout(() => {
      onApplyManualSectionSave?.(text);
      blankPersistTimer.current = null;
    }, 400);
  };

  const queueDraftPersist = (text: string) => {
    if (draftPersistTimer.current) {
      clearTimeout(draftPersistTimer.current);
    }
    draftPersistTimer.current = setTimeout(() => {
      onApplyManualSectionSave?.(text);
      draftPersistTimer.current = null;
    }, 400);
  };

  const startEditing = () => {
    const baseline = sectionText;
    setEditBaseline(baseline);
    setEditBuffer(baseline);
    setIsEditing(true);
  };

  const saveEditing = () => {
    onApplyManualSectionSave?.(editBuffer);
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setEditBuffer(editBaseline);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{section.title ?? section.id}</h2>
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
            {showDraftReadOnly ? (
              <Button size="sm" variant="outline" data-testid="viewport-section-edit" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            ) : null}
            {isEditing ? (
              <>
                <Button size="sm" data-testid="viewport-section-save" onClick={saveEditing}>
                  Save
                </Button>
                <Button size="sm" variant="outline" data-testid="viewport-section-cancel-edit" onClick={cancelEditing}>
                  Cancel
                </Button>
              </>
            ) : null}

            {importDraft ? (
              <>
                {canShowValidateButton ? (
                  <Button size="sm" data-testid="viewport-validate-section" onClick={() => runSectionValidation(section.id)}>
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

      <ScrollArea className="flex-1 min-h-0" data-testid="document-viewport-scroll">
        <div
          className={`p-6 max-w-5xl ${importDraft && isValidationProposedSection ? 'flex flex-col min-h-[calc(100vh-14rem)]' : ''}`}
        >
          {showBlankAuthoring ? (
            <div className="space-y-3 mb-8" data-testid="viewport-blank-authoring">
              <RichTextEditor
                value={blankBuffer}
                onChange={(text) => {
                  setBlankBuffer(text);
                  queueBlankPersist(text);
                }}
                onBlurCommit={(text) => onApplyManualSectionSave?.(text)}
                placeholder="Start writing this section…"
                data-testid="viewport-blank-authoring-editor"
              />
              <Button
                size="sm"
                variant="outline"
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
            </div>
          ) : null}

          {showQueuedState ? (
            <Alert data-testid="viewport-section-queued">
              <AlertTitle>Queued for generation</AlertTitle>
              <AlertDescription>
                This section is queued for generation. You can continue reviewing other sections while reconstruction runs.
              </AlertDescription>
            </Alert>
          ) : null}

          {showGeneratingState ? (
            <Alert data-testid="viewport-section-generating">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Currently generating</AlertTitle>
              <AlertDescription>
                This section is currently being generated. Select a completed section to review its draft while reconstruction continues.
              </AlertDescription>
            </Alert>
          ) : null}

          {importDraft && isOutOfSyncSection ? (
            <ConsistencyImpactReviewPanel
              sectionId={section.id}
              draft={importDraft}
              onManualEdit={() => startEditing()}
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

          {showDraftReadOnly ? (
            <div className="space-y-3 mb-8" data-testid="viewport-section-readonly">
              <Label>Section content</Label>
              <div data-testid="viewport-import-generated-text">
                <RichTextReadOnlyView value={sectionText} />
              </div>
            </div>
          ) : null}

          {showDraftEditor ? (
            <div className="space-y-3 mb-8">
              <Label htmlFor="viewport-import-generated-text">
                {isImportedUnvalidatedSection
                  ? 'Imported protocol text (pending validation)'
                  : isGeneratedSection && !isUnvalidatedSection
                    ? 'Generated M11 section (pending approval)'
                    : 'Section content'}
              </Label>
              <RichTextEditor
                value={editBuffer}
                editorKey={isEditing ? `editing-${section.id}` : `draft-${section.id}`}
                onChange={(text) => {
                  setEditBuffer(text);
                  if (!isEditing && !hasSectionContent) {
                    queueDraftPersist(text);
                  }
                }}
                onBlurCommit={(text) => {
                  if (isEditing) {
                    return;
                  }
                  if (!hasSectionContent) {
                    onApplyManualSectionSave?.(text);
                  }
                }}
                readOnly={hasSectionContent && !isEditing}
                data-testid="viewport-import-generated-text"
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
                This section contains template instructions from the ICH M11 Template and is not part of the finalized protocol body.
              </p>
            </div>
          ) : section.ichM11TemplateOnly && !importDraft && !showBlankAuthoring ? (
            <div className="text-center py-12 max-w-lg mx-auto">
              <FileText className="h-10 w-10 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground">
                This section is defined by the ICH M11 Template but has not yet been authored.
              </p>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function FieldEditor({
  field,
  onFieldChange,
}: {
  field: FieldDefinition;
  onFieldChange: (fieldId: string, value: unknown) => void;
}) {
  const hasValue = Boolean(field.value && String(field.value).trim());

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
    </div>
  );

  const renderField = () => {
    if (field.controlledTerminology) {
      return (
        <Select value={field.value ? String(field.value) : undefined} onValueChange={(value) => onFieldChange(field.id, value)}>
          <SelectTrigger className="bg-input-background">
            <SelectValue placeholder={resolveTitlePageSelectPlaceholder(field.id, field.label)} />
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
          value={field.value ? String(field.value) : ''}
          onChange={(e) => onFieldChange(field.id, e.target.value)}
          placeholder={resolveTitlePagePlaceholder(field.id, field.label)}
          className="min-h-[100px] bg-input-background"
        />
      );
    }

    return (
      <Input
        type="text"
        value={field.value ? String(field.value) : ''}
        onChange={(e) => onFieldChange(field.id, e.target.value)}
        placeholder={resolveTitlePagePlaceholder(field.id, field.label)}
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
          {field.aiHints && field.aiHints.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              <Sparkles className="h-3 w-3 inline mr-1" />
              {field.aiHints[0]}
            </p>
          ) : null}
        </div>
        {hasValue ? <CheckCircle2 className="h-4 w-4 text-green-500 ml-2" /> : null}
      </div>
      <div id={field.id}>{renderField()}</div>
    </div>
  );
}

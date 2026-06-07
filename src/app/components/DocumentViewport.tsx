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
  resolveTitlePageViewportBadge,
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
import { ProtocolIdeEditor } from './protocol-ide/ProtocolIdeEditor';
import {
  buildEditorGutterIndicators,
  buildLineDiagnostics,
  buildSectionValidationSummary,
  getSectionDependencyReferences,
} from '../domain/protocol/authoring/editorIntegration';
import type { DiagnosticScrollTarget } from '../domain/protocol/authoring/lineDiagnostics';
import { getProtocolDocument } from '../domain/protocol';
import type { ValidationIssue } from '../types/protocol';
import { resolveSectionEditorContent } from '../domain/protocol/import/sectionAuthoring';
import {
  isEditorSessionDirty,
} from '../domain/protocol/authoring/editorSessionState';
import { hasSubstantiveEditorContent } from '../domain/protocol/authoring/richTextContent';
import {
  evaluateTitlePageCompletion,
  isTitlePageFieldValueComplete,
  resolveTitlePageFieldDisplayBadges,
  resolveViewportAuthoringModeLabel,
  titlePageFieldBadgeClass,
  TITLE_PAGE_SECTION_ID,
} from '../domain/protocol/authoring/titlePageAuthoring';
import type { AutosaveStatus } from './StatusBar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface DocumentViewportProps {
  section: ProtocolSection | null;
  fields: FieldDefinition[];
  onFieldChange: (fieldId: string, value: unknown) => void;
  onFieldFocus?: (fieldId: string) => void;
  onFieldBlur?: () => void;
  importDraft?: GeneratedSectionDraft;
  onImportDraftTextChange?: (text: string) => void;
  onManualSectionEdit?: (text: string) => void;
  onApplyManualSectionSave?: (text: string, previousText: string) => void;
  sectionGenerationState?: SectionGenerationState;
  buildActive?: boolean;
  autosaveStatus?: AutosaveStatus;
  lastSaved?: Date | null;
  onFind?: () => void;
  onReplace?: () => void;
  onForceSave?: () => void;
  highlightQuery?: string;
  validationIssues?: ValidationIssue[];
  allSections?: ProtocolSection[];
  forceSaveSignal?: number;
  diagnosticScrollTarget?: DiagnosticScrollTarget | null;
  onDiagnosticScrollComplete?: () => void;
}

type TitlePageMode = 'viewing' | 'editing';
type NarrativeEditorSession = 'viewing' | 'editing';

export function DocumentViewport({
  section,
  fields,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
  importDraft,
  onImportDraftTextChange,
  onManualSectionEdit,
  onApplyManualSectionSave,
  sectionGenerationState,
  buildActive = false,
  autosaveStatus = 'idle',
  lastSaved = null,
  onFind,
  onReplace,
  onForceSave,
  highlightQuery,
  validationIssues = [],
  allSections = [],
  forceSaveSignal = 0,
  diagnosticScrollTarget = null,
  onDiagnosticScrollComplete,
}: DocumentViewportProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [editorSession, setEditorSession] = useState<NarrativeEditorSession>('viewing');
  const [editorBuffer, setEditorBuffer] = useState('');
  const [explicitIntellisenseQuery, setExplicitIntellisenseQuery] = useState<string | null>(null);
  const [editorBaseline, setEditorBaseline] = useState('');
  const [titlePageMode, setTitlePageMode] = useState<TitlePageMode>('editing');
  const [titlePageBaseline, setTitlePageBaseline] = useState<Record<string, unknown>>({});
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorSessionRef = useRef(editorSession);
  const editorBufferRef = useRef(editorBuffer);
  const editorBaselineRef = useRef(editorBaseline);
  const [validationGateMessage, setValidationGateMessage] = useState<string | null>(null);
  const { revision: importRevision } = useProtocolImport();
  const generationContextReady = isPriorityGenerationContextReady();
  void importRevision;

  useEffect(() => {
    editorSessionRef.current = editorSession;
  }, [editorSession]);

  useEffect(() => {
    editorBufferRef.current = editorBuffer;
  }, [editorBuffer]);

  useEffect(() => {
    editorBaselineRef.current = editorBaseline;
  }, [editorBaseline]);

  useEffect(() => {
    if (diagnosticScrollTarget?.sectionId === section?.id && diagnosticScrollTarget.suggestedFix) {
      setExplicitIntellisenseQuery(diagnosticScrollTarget.suggestedFix);
    }
  }, [diagnosticScrollTarget, section?.id]);

  const flushPendingPersist = useCallback(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    if (
      editorSessionRef.current === 'editing' &&
      isEditorSessionDirty(editorBaselineRef.current, editorBufferRef.current)
    ) {
      onApplyManualSectionSave?.(editorBufferRef.current, editorBaselineRef.current);
    }
  }, [onApplyManualSectionSave]);

  const queueEditorPersist = useCallback(
    (text: string) => {
      if (!isEditorSessionDirty(editorBaselineRef.current, text)) {
        return;
      }
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
      }
      persistTimer.current = setTimeout(() => {
        if (isEditorSessionDirty(editorBaselineRef.current, text)) {
          onApplyManualSectionSave?.(text, editorBaselineRef.current);
        }
        persistTimer.current = null;
      }, 400);
    },
    [onApplyManualSectionSave],
  );

  const sectionText = resolveSectionEditorContent(importDraft);
  const hasSectionContent = hasSubstantiveEditorContent(sectionText);
  const isTitlePageSection = section?.id === TITLE_PAGE_SECTION_ID;
  const titlePageCompletion = useMemo(
    () => (isTitlePageSection ? evaluateTitlePageCompletion(fields) : null),
    [fields, isTitlePageSection],
  );

  useEffect(() => {
    return () => {
      flushPendingPersist();
    };
  }, [section?.id, flushPendingPersist]);

  useEffect(() => {
    const text = sectionText;
    setEditorBuffer(text);
    setEditorBaseline(text);
    editorBufferRef.current = text;
    editorBaselineRef.current = text;
    setTitlePageMode('editing');
    setTitlePageBaseline({});
    setValidationGateMessage(null);
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }

    const isBlankNarrative =
      !importDraft &&
      fields.length === 0 &&
      !section?.ichM11InstructionOnly;
    const nextSession: NarrativeEditorSession =
      isBlankNarrative || !hasSectionContent ? 'editing' : 'viewing';
    setEditorSession(nextSession);
    editorSessionRef.current = nextSession;
  }, [section?.id]);

  useEffect(() => {
    if (editorSession === 'viewing') {
      setEditorBuffer(sectionText);
      setEditorBaseline(sectionText);
      editorBufferRef.current = sectionText;
    }
  }, [sectionText, editorSession, importDraft?.sectionId]);

  useEffect(() => {
    if (forceSaveSignal > 0) {
      flushPendingPersist();
    }
  }, [forceSaveSignal, flushPendingPersist]);

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
    isTitlePageSection
      ? !titlePageCompletion?.allRequiredComplete
      : shouldShowRequiredMissing({
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
  const isValidationRunning = workflowState === 'validationRunning';
  const isValidationProposedSection = isValidationReviewReady(importDraft ?? undefined);

  const canShowNarrativeSurface =
    !isTitlePageSection &&
    !showQueuedState &&
    !showGeneratingState &&
    (importDraft || showBlankAuthoring);

  const isNarrativeEditorActive =
    canShowNarrativeSurface &&
    editorSession === 'editing' &&
    !isValidationProposedSection &&
    !isValidationRunning;

  const showNarrativeReadOnly =
    canShowNarrativeSurface &&
    editorSession === 'viewing' &&
    hasSectionContent &&
    !isValidationProposedSection &&
    !isValidationRunning;

  const isImportedUnvalidatedSection =
    workflowState === 'importedUnvalidated' || workflowState === 'imported';
  const isGeneratedSection = importDraft?.contentOrigin === 'generated' || workflowState === 'generated';
  const isUnvalidatedSection = workflowState === 'unvalidated' || isValidationProposedSection;
  const isManualDraftSection =
    importDraft?.contentOrigin === 'manual' && hasSectionContent;
  const titlePageReadyForValidation =
    isTitlePageSection &&
    Boolean(titlePageCompletion?.allRequiredComplete) &&
    !isValidationRunning &&
    !isValidationProposedSection &&
    workflowState !== 'validated' &&
    workflowState !== 'reviewed';
  const canValidateSectionContent =
    hasSectionContent || (isTitlePageSection && Boolean(titlePageCompletion?.allRequiredComplete));
  const canShowValidateButton =
    (titlePageReadyForValidation ||
      Boolean(
        importDraft &&
          canValidateSectionContent &&
          !isValidationRunning &&
          !isValidationProposedSection &&
          (isImportedUnvalidatedSection || isGeneratedSection || isManualDraftSection),
      )) &&
    canValidateSectionContent;

  const handleValidateSection = () => {
    if (!canShowValidateButton) {
      setValidationGateMessage('Add section content before validation.');
      return;
    }
    setValidationGateMessage(null);
    runSectionValidation(section.id);
  };
  const isOutOfSyncSection =
    sectionGenerationState === 'outOfSync' ||
    workflowState === 'outOfSync' ||
    importDraft?.workflowState === 'outOfSync';

  const startEditing = () => {
    const baseline = sectionText;
    setEditorBaseline(baseline);
    setEditorBuffer(baseline);
    editorBufferRef.current = baseline;
    setEditorSession('editing');
    editorSessionRef.current = 'editing';
  };

  const finishEditing = () => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    if (isEditorSessionDirty(editorBaselineRef.current, editorBufferRef.current)) {
      onApplyManualSectionSave?.(editorBufferRef.current, editorBaselineRef.current);
      setEditorBaseline(editorBufferRef.current);
      editorBaselineRef.current = editorBufferRef.current;
    }
    setEditorSession('viewing');
    editorSessionRef.current = 'viewing';
  };

  const startTitlePageEditing = () => {
    const baseline = Object.fromEntries(fields.map((field) => [field.id, field.value ?? '']));
    setTitlePageBaseline(baseline);
    setTitlePageMode('editing');
  };

  const finishTitlePageEditing = () => {
    setTitlePageMode('viewing');
  };

  const cancelTitlePageEditing = () => {
    for (const [fieldId, value] of Object.entries(titlePageBaseline)) {
      onFieldChange(fieldId, value);
    }
    setTitlePageMode('viewing');
  };

  const cancelEditing = () => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    setEditorBuffer(editorBaseline);
    editorBufferRef.current = editorBaseline;
    setEditorSession('viewing');
    editorSessionRef.current = 'viewing';
    setValidationGateMessage(null);
  };

  const authoringModeLabel = resolveViewportAuthoringModeLabel({
    isTitlePageSection,
    titlePageMode,
    editorSession,
    showBlankAuthoring,
    canShowNarrativeSurface,
    showNarrativeReadOnly,
  });

  const titlePageBadge = isTitlePageSection
    ? resolveTitlePageViewportBadge({
        fields,
        importDraft,
        generationState: sectionGenerationState,
      })
    : null;

  const validationSummary = buildSectionValidationSummary(
    section.id,
    section,
    importDraft,
    validationIssues,
  );
  const lineDiagnostics = buildLineDiagnostics({
    sectionId: section.id,
    content: editorBuffer,
    draft: importDraft,
    validationIssues,
  });
  const dependencyReferences = getSectionDependencyReferences(section.id, getProtocolDocument(), allSections);
  const gutterIndicators = buildEditorGutterIndicators(editorBuffer, validationSummary, {
    sectionId: section.id,
    draft: importDraft,
    validationIssues,
  });
  const narrativeSectionState = editorSession === 'editing' ? authoringModeLabel : 'Viewing';

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{section.title ?? section.id}</h2>
            <Badge variant="secondary" className="text-xs" data-testid="viewport-authoring-mode">
              {authoringModeLabel}
            </Badge>
            {titlePageBadge ? (
              <Badge
                variant="outline"
                className={`text-xs ${sectionWorkflowDisplayBadgeClass(titlePageBadge)}`}
                data-testid="viewport-workflow-state-badge"
              >
                {titlePageBadge}
              </Badge>
            ) : workflowBadge ? (
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
                Required Missing
              </Badge>
            ) : section.status !== 'complete' ? (
              <Badge variant="outline" className={`${statusColor.text} ${statusColor.border}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} mr-1.5`} />
                {getStatusLabel(section.status)}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isTitlePageSection ? (
              titlePageMode === 'viewing' ? (
                <Button size="sm" variant="outline" data-testid="viewport-title-edit" onClick={startTitlePageEditing}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button size="sm" data-testid="viewport-title-done" onClick={finishTitlePageEditing}>
                    Done
                  </Button>
                  <Button size="sm" variant="outline" data-testid="viewport-title-cancel" onClick={cancelTitlePageEditing}>
                    Cancel
                  </Button>
                </>
              )
            ) : null}
            {canShowNarrativeSurface ? (
              editorSession === 'viewing' ? (
                <Button size="sm" variant="outline" data-testid="viewport-section-edit" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button size="sm" data-testid="viewport-section-save" onClick={finishEditing}>
                    Done
                  </Button>
                  <Button size="sm" variant="outline" data-testid="viewport-section-cancel-edit" onClick={cancelEditing}>
                    Cancel
                  </Button>
                </>
              )
            ) : null}

            {(importDraft || titlePageReadyForValidation) ? (
              <>
                {canShowValidateButton && !isNarrativeEditorActive ? (
                  <Button size="sm" data-testid="viewport-validate-section" onClick={handleValidateSection}>
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
          {isNarrativeEditorActive ? (
            <div
              className="space-y-3 mb-8"
              data-testid={showBlankAuthoring ? 'viewport-blank-authoring' : undefined}
            >
              <Label htmlFor="viewport-narrative-editor">
                {showBlankAuthoring
                  ? 'Section content'
                  : isImportedUnvalidatedSection
                    ? 'Imported protocol text (pending validation)'
                    : isGeneratedSection && !isUnvalidatedSection
                      ? 'Generated M11 section (pending approval)'
                      : 'Section content'}
              </Label>
              <ProtocolIdeEditor
                value={editorBuffer}
                editorKey={`narrative-${section.id}`}
                onChange={(text) => {
                  setEditorBuffer(text);
                  editorBufferRef.current = text;
                  queueEditorPersist(text);
                }}
                placeholder={showBlankAuthoring ? 'Start writing this section…' : undefined}
                readOnly={false}
                sectionState={narrativeSectionState}
                autosaveStatus={autosaveStatus}
                lastSaved={lastSaved}
                validationSummary={validationSummary}
                dependencyCount={dependencyReferences.length}
                gutterIndicators={gutterIndicators}
                lineDiagnostics={lineDiagnostics}
                sectionId={section.id}
                sectionTitle={section.title}
                highlightQuery={highlightQuery}
                onValidate={canShowValidateButton ? handleValidateSection : undefined}
                validateDisabled={!canShowValidateButton}
                validateRunning={isValidationRunning}
                onFind={onFind}
                onReplace={onReplace}
                explicitIntellisenseQuery={explicitIntellisenseQuery}
                onExplicitIntellisenseQueryChange={setExplicitIntellisenseQuery}
                diagnosticScrollTarget={diagnosticScrollTarget}
                onDiagnosticScrollComplete={onDiagnosticScrollComplete}
                data-testid={
                  showBlankAuthoring ? 'viewport-blank-authoring-editor' : 'viewport-import-generated-text'
                }
              />
              {validationGateMessage ? (
                <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="validation-gate-message">
                  {validationGateMessage}
                </p>
              ) : null}
              {showBlankAuthoring ? (
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
              ) : null}
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

          {showNarrativeReadOnly ? (
            <div className="space-y-3 mb-8" data-testid="viewport-section-readonly">
              <Label>Section content</Label>
              <div data-testid="viewport-import-generated-text">
                <RichTextReadOnlyView value={sectionText} />
              </div>
            </div>
          ) : null}

          {fields.length > 0 ? (
            <div className="space-y-6">
              {fields.map((field) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  readOnly={isTitlePageSection && titlePageMode === 'viewing'}
                  onFieldChange={onFieldChange}
                  onFieldFocus={onFieldFocus}
                  onFieldBlur={onFieldBlur}
                />
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
  readOnly = false,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
}: {
  field: FieldDefinition;
  readOnly?: boolean;
  onFieldChange: (fieldId: string, value: unknown) => void;
  onFieldFocus?: (fieldId: string) => void;
  onFieldBlur?: () => void;
}) {
  const hasValue = isTitlePageFieldValueComplete(field.id, field.value);
  const isControlledSelect = Boolean(field.controlledTerminology);
  const isFullTitle = field.id === 'title_page.full_title';

  const renderFieldBadges = () => {
    if (field.sectionId === TITLE_PAGE_SECTION_ID) {
      const titlePageBadges = resolveTitlePageFieldDisplayBadges(field);
      return (
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {titlePageBadges.map((badge) => (
            <Badge key={badge} variant="outline" className={`text-xs ${titlePageFieldBadgeClass(badge)}`}>
              {badge}
            </Badge>
          ))}
        </div>
      );
    }

    return (
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
  };

  const renderField = () => {
    if (isControlledSelect) {
      const currentValue = field.value ? String(field.value) : '';
      return (
        <Select
          value={currentValue || undefined}
          disabled={readOnly}
          onValueChange={(value) => onFieldChange(field.id, value)}
        >
          <SelectTrigger className="bg-card text-foreground dark:bg-input/30" data-testid={`field-select-${field.id}`}>
            <SelectValue placeholder={resolveTitlePageSelectPlaceholder(field.id, field.label)} />
          </SelectTrigger>
          <SelectContent>
            {field.controlledTerminology!.values.map((value, index) => {
              const label = typeof value === 'string' ? value : value.label;
              return (
                <SelectItem key={`${field.id}-${index}`} value={label}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }

    if (isFullTitle) {
      return (
        <Textarea
          value={field.value ? String(field.value) : ''}
          readOnly={readOnly}
          onChange={(e) => onFieldChange(field.id, e.target.value)}
          onFocus={() => onFieldFocus?.(field.id)}
          onBlur={() => onFieldBlur?.()}
          placeholder={resolveTitlePagePlaceholder(field.id, field.label)}
          className="min-h-[120px] bg-card text-foreground dark:bg-input/30"
          data-testid={`field-input-${field.id}`}
        />
      );
    }

    if (field.dataType === 'rich_text') {
      return (
        <RichTextEditor
          value={field.value ? String(field.value) : ''}
          onChange={(text) => onFieldChange(field.id, text)}
          readOnly={readOnly}
          placeholder={resolveTitlePagePlaceholder(field.id, field.label)}
          data-testid={`field-input-${field.id}`}
        />
      );
    }

    return (
      <Input
        type="text"
        value={field.value ? String(field.value) : ''}
        readOnly={readOnly}
        onChange={(e) => onFieldChange(field.id, e.target.value)}
        onFocus={() => onFieldFocus?.(field.id)}
        onBlur={() => onFieldBlur?.()}
        placeholder={resolveTitlePagePlaceholder(field.id, field.label)}
        className="bg-card text-foreground dark:bg-input/30"
        data-testid={`field-input-${field.id}`}
      />
    );
  };

  return (
    <div
      className="space-y-2 p-4 rounded-lg border border-border bg-card/50"
      data-testid={`field-editor-${field.id}`}
      onFocusCapture={() => onFieldFocus?.(field.id)}
    >
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

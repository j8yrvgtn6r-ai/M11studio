import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertCircle, Info, AlertTriangle, MessageSquare, Clock, Database, Link2, CheckCircle2 } from 'lucide-react';
import type { FieldDefinition, ProtocolSection, ValidationIssue, AuditEvent, Comment } from '../types/protocol';
import type { GeneratedSectionDraft, MappedProtocolSection, SectionImportDiagnostics, ValidationChange } from '../domain/protocol/import/types';
import {
  generationEligibilityLabel,
  isOrphanSectionGenerationState,
  mappingReasonLabel,
  mappingStatusLabel,
} from '../domain/protocol/import/sectionImportDiagnostics';
import { formatValidationChangeType, resolveControlledTerminologyStatus, resolveM11StructureStatus, formatValidationProviderLabel } from '../agents/validationRules';
import { runLlmSectionValidation } from '../domain/protocol/import/protocolImportStore';
import { getLlmValidationAvailability } from '../domain/protocol/import/llm/llmConfig';
import { sectionGenerationStateLabel } from './SectionGenerationStateIndicator';
import type { SectionGenerationState } from '../domain/protocol/build/protocolBuildConsoleStore';
import { getSeverityColor } from '../utils/statusColors';
import { format } from 'date-fns';
import { SoAAssessmentMetadataPanel } from './soa-configuration/SoAAssessmentMetadataPanel';
import type { CanonicalDocument, CanonicalSourceSection } from '../domain/document-ingestion/canonicalDocumentTypes';
import {
  evaluateTitlePageCompletion,
  isTitlePageFieldValueComplete,
  TITLE_PAGE_REQUIRED_FIELD_IDS,
  TITLE_PAGE_SECTION_ID,
} from '../domain/protocol/authoring/titlePageAuthoring';
import { getProtocolDocument } from '../domain/protocol';
import {
  buildLineDiagnostics,
  buildSectionValidationSummary,
  getSectionDependencyReferences,
  type LineDiagnostic,
} from '../domain/protocol/authoring/editorIntegration';
import { resolveSectionEditorContent } from '../domain/protocol/import/sectionAuthoring';
import { SectionIdeValidationPanel } from './protocol-ide/SectionIdeValidationPanel';

interface DetailInspectorProps {
  selectedField: FieldDefinition | null;
  selectedSectionId: string | null;
  selectedSectionTitle?: string | null;
  titlePageFields?: FieldDefinition[];
  sectionDraft?: GeneratedSectionDraft | null;
  sectionGenerationState?: SectionGenerationState;
  structuralMapping?: MappedProtocolSection | null;
  sectionImportDiagnostics?: SectionImportDiagnostics | null;
  canonicalDocument?: CanonicalDocument | null;
  canonicalSourceSection?: CanonicalSourceSection | null;
  validationIssues: ValidationIssue[];
  auditEvents: AuditEvent[];
  comments: Comment[];
  isScheduleOfActivitiesView?: boolean;
  allSections?: ProtocolSection[];
  onNavigateDiagnostic?: (diagnostic: LineDiagnostic) => void;
}

export function DetailInspector({
  selectedField,
  selectedSectionId,
  selectedSectionTitle,
  titlePageFields = [],
  sectionDraft,
  sectionGenerationState,
  structuralMapping,
  sectionImportDiagnostics,
  canonicalDocument,
  canonicalSourceSection,
  validationIssues,
  auditEvents,
  comments,
  isScheduleOfActivitiesView = false,
  allSections = [],
  onNavigateDiagnostic,
}: DetailInspectorProps) {
  const sectionValidationIssues = validationIssues.filter((issue) => issue.sectionId === selectedSectionId);
  const draftFindings = sectionDraft?.validationFindings ?? [];
  const sectionAuditEvents = auditEvents.filter(
    (event) => !event.sectionId || event.sectionId === selectedSectionId,
  );
  const sectionComments = comments.filter((comment) => comment.sectionId === selectedSectionId);
  const hasComments = sectionComments.length > 0;
  const hasAudit = sectionAuditEvents.length > 0;

  const findSection = (sections: ProtocolSection[], id: string): ProtocolSection | null => {
    for (const entry of sections) {
      if (entry.id === id) {
        return entry;
      }
      if (entry.children?.length) {
        const found = findSection(entry.children.filter(Boolean) as ProtocolSection[], id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };
  const selectedSection =
    selectedSectionId && allSections.length ? findSection(allSections, selectedSectionId) : null;
  const validationSummary = buildSectionValidationSummary(
    selectedSectionId,
    selectedSection,
    sectionDraft ?? undefined,
    validationIssues,
  );
  const lineDiagnostics =
    selectedSectionId && sectionDraft
      ? buildLineDiagnostics({
          sectionId: selectedSectionId,
          content: resolveSectionEditorContent(sectionDraft),
          draft: sectionDraft,
          validationIssues,
        })
      : selectedSectionId
        ? buildLineDiagnostics({
            sectionId: selectedSectionId,
            content: '',
            validationIssues,
          })
        : [];
  const dependencyReferences = getSectionDependencyReferences(
    selectedSectionId,
    getProtocolDocument(),
    allSections,
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-card border-t border-border" data-testid="detail-inspector-panel">
      <Tabs defaultValue="metadata" className="flex-1 flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <TabsList className="h-8 w-full justify-start">
            <TabsTrigger value="metadata" className="text-xs">
              Metadata
            </TabsTrigger>
            <TabsTrigger value="validation" className="text-xs">
              Validation
              {(sectionValidationIssues.length + draftFindings.length) > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">
                  {sectionValidationIssues.length + draftFindings.length}
                </Badge>
              )}
            </TabsTrigger>
            {hasComments ? (
              <TabsTrigger value="comments" className="text-xs">
                Comments
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {sectionComments.length}
                </Badge>
              </TabsTrigger>
            ) : null}
            {hasAudit ? (
              <TabsTrigger value="audit" className="text-xs">
                Audit Trail
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="mappings" className="text-xs">
              Mappings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 min-h-0" data-testid="detail-inspector-scroll">
          <TabsContent value="metadata" className="p-3 mt-0">
            {isScheduleOfActivitiesView ? (
              <SoAAssessmentMetadataPanel />
            ) : (
              <MetadataTab
                field={selectedField}
                sectionId={selectedSectionId}
                sectionTitle={selectedSectionTitle}
                titlePageFields={titlePageFields}
                sectionDraft={sectionDraft}
                sectionGenerationState={sectionGenerationState}
                sectionImportDiagnostics={sectionImportDiagnostics}
                canonicalDocument={canonicalDocument}
                canonicalSourceSection={canonicalSourceSection}
              />
            )}
          </TabsContent>

          <TabsContent value="validation" className="p-3 mt-0">
            <SectionIdeValidationPanel
              summary={validationSummary}
              dependencyReferences={dependencyReferences}
              lineDiagnostics={lineDiagnostics}
              onNavigateDiagnostic={onNavigateDiagnostic}
            />
            <ValidationTab
              issues={sectionValidationIssues}
              draft={sectionDraft}
              sectionId={selectedSectionId}
            />
          </TabsContent>

          {hasComments ? (
            <TabsContent value="comments" className="p-3 mt-0">
              <CommentsTab comments={sectionComments} />
            </TabsContent>
          ) : null}

          {hasAudit ? (
            <TabsContent value="audit" className="p-3 mt-0">
              <AuditTab events={sectionAuditEvents} />
            </TabsContent>
          ) : null}

          <TabsContent value="mappings" className="p-3 mt-0">
            <MappingsTab
              field={selectedField}
              structuralMapping={structuralMapping}
              sectionImportDiagnostics={sectionImportDiagnostics}
              canonicalSourceSection={canonicalSourceSection}
              sectionId={selectedSectionId}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function MetadataTab({
  field,
  sectionId,
  sectionTitle,
  titlePageFields,
  sectionDraft,
  sectionGenerationState,
  sectionImportDiagnostics,
  canonicalDocument,
  canonicalSourceSection,
}: {
  field: FieldDefinition | null;
  sectionId: string | null;
  sectionTitle?: string | null;
  titlePageFields?: FieldDefinition[];
  sectionDraft?: GeneratedSectionDraft | null;
  sectionGenerationState?: SectionGenerationState;
  sectionImportDiagnostics?: SectionImportDiagnostics | null;
  canonicalDocument?: CanonicalDocument | null;
  canonicalSourceSection?: CanonicalSourceSection | null;
}) {
  if (field) {
    return <FieldMetadataPanel field={field} />;
  }

  if (sectionId === TITLE_PAGE_SECTION_ID) {
    return (
      <TitlePageMetadataSummary
        fields={titlePageFields ?? []}
        lastUpdated={getProtocolDocument().metadata.updatedAt}
      />
    );
  }

  if (sectionId && sectionDraft) {
    const showImportDiagnostics =
      sectionImportDiagnostics &&
      (isOrphanSectionGenerationState(sectionGenerationState) ||
        sectionImportDiagnostics.mappingStatus !== 'mapped' ||
        sectionImportDiagnostics.generationEligibility !== 'alreadyGenerated');

    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Section</h4>
          <p className="text-sm font-medium">{sectionTitle ?? sectionId}</p>
          <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">{sectionId}</code>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Workflow</h4>
            <Badge variant="outline" className="text-xs">
              {sectionDraft.workflowState ?? sectionDraft.state}
            </Badge>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Status</h4>
            <Badge variant="outline" className="text-xs">
              {sectionGenerationState ? sectionGenerationStateLabel(sectionGenerationState) : 'Unknown'}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Origin</h4>
            <p className="text-xs">{sectionDraft.contentOrigin ?? 'unknown'}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Provider</h4>
            <p className="text-xs">{sectionDraft.generationProvider ?? sectionDraft.provenance?.generationProvider ?? '—'}</p>
          </div>
        </div>
        {sectionDraft.generatedAt ? (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Last updated</h4>
            <p className="text-xs">{format(new Date(sectionDraft.generatedAt), 'MMM d, yyyy h:mm a')}</p>
          </div>
        ) : null}
        {sectionDraft.importedTextLength ? (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Imported length</h4>
            <p className="text-xs">{sectionDraft.importedTextLength} characters</p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Validation provider</h4>
            <p className="text-xs" data-testid="metadata-validation-provider">
              {sectionDraft.validationProvider ?? 'local-deterministic'}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Validation changes</h4>
            <p className="text-xs">{(sectionDraft.validationChanges ?? []).length} changes</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Findings</h4>
            <p className="text-xs">{(sectionDraft.validationFindings ?? []).length}</p>
          </div>
          {sectionDraft.lastValidatedAt ? (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">Last validated</h4>
              <p className="text-xs">{format(new Date(sectionDraft.lastValidatedAt), 'MMM d, yyyy h:mm a')}</p>
            </div>
          ) : null}
        </div>
        {(sectionDraft.validationProvider ?? 'local-deterministic') === 'local-deterministic' &&
        sectionId &&
        (sectionDraft.workflowState === 'validationProposed' || sectionDraft.workflowState === 'importedUnvalidated') ? (
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              data-testid="metadata-run-llm-validation"
              onClick={() => runLlmSectionValidation(sectionId)}
            >
              Run LLM Validation
            </Button>
            {!getLlmValidationAvailability().available ? (
              <p className="text-xs text-muted-foreground">{getLlmValidationAvailability().message}</p>
            ) : null}
          </div>
        ) : null}
        {showImportDiagnostics ? (
          <ImportDiagnosticsPanel diagnostics={sectionImportDiagnostics!} />
        ) : null}
        <DocumentDiagnosticsPanel
          canonicalDocument={canonicalDocument}
          canonicalSourceSection={canonicalSourceSection}
          sectionImportDiagnostics={sectionImportDiagnostics}
        />
      </div>
    );
  }

  if (sectionId && sectionImportDiagnostics) {
    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Section</h4>
          <p className="text-sm font-medium">{sectionTitle ?? sectionId}</p>
          <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">{sectionId}</code>
        </div>
        {sectionGenerationState ? (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Status</h4>
            <Badge variant="outline" className="text-xs">
              {sectionGenerationStateLabel(sectionGenerationState)}
            </Badge>
          </div>
        ) : null}
        <ImportDiagnosticsPanel diagnostics={sectionImportDiagnostics} />
        <DocumentDiagnosticsPanel
          canonicalDocument={canonicalDocument}
          canonicalSourceSection={canonicalSourceSection}
          sectionImportDiagnostics={sectionImportDiagnostics}
        />
      </div>
    );
  }

  if (sectionId && canonicalDocument) {
    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Section</h4>
          <p className="text-sm font-medium">{sectionTitle ?? sectionId}</p>
          <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">{sectionId}</code>
        </div>
        <DocumentDiagnosticsPanel
          canonicalDocument={canonicalDocument}
          canonicalSourceSection={canonicalSourceSection}
          sectionImportDiagnostics={sectionImportDiagnostics}
        />
      </div>
    );
  }

  return (
    <div className="text-center py-8 text-sm text-muted-foreground" data-testid="metadata-empty-state">
      <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p>Select a section to view metadata</p>
    </div>
  );
}

function TitlePageMetadataSummary({
  fields,
  lastUpdated,
}: {
  fields: FieldDefinition[];
  lastUpdated?: string;
}) {
  const summary = evaluateTitlePageCompletion(fields);

  return (
    <div className="space-y-3" data-testid="title-page-metadata-summary">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Title Page</h4>
        <p className="text-sm font-medium">Structured title-page authoring</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Completion</h4>
          <Badge variant="outline" className="text-xs" data-testid="title-page-completion-badge">
            {summary.displayBadge}
          </Badge>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Required fields</h4>
          <p className="text-xs" data-testid="title-page-required-progress">
            {summary.requiredComplete}/{summary.requiredTotal} complete
          </p>
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Missing required</h4>
        {summary.missingFieldIds.length === 0 ? (
          <p className="text-xs text-green-600 dark:text-green-400">All required title-page fields are complete.</p>
        ) : (
          <ul className="space-y-1">
            {summary.missingFieldIds.map((fieldId) => {
              const field = fields.find((entry) => entry.id === fieldId);
              return (
                <li key={fieldId} className="text-xs text-red-600 dark:text-red-400">
                  {field?.label ?? fieldId}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Source</h4>
        <p className="text-xs">User-authored</p>
      </div>
      {lastUpdated ? (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Last updated</h4>
          <p className="text-xs" data-testid="title-page-last-updated">
            {format(new Date(lastUpdated), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      ) : null}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Field checklist</h4>
        <ul className="space-y-1">
          {TITLE_PAGE_REQUIRED_FIELD_IDS.map((fieldId) => {
            const field = fields.find((entry) => entry.id === fieldId);
            const complete = isTitlePageFieldValueComplete(fieldId, field?.value);
            return (
              <li key={fieldId} className="text-xs flex items-center gap-1.5">
                {complete ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-500" />
                )}
                <span>{field?.label ?? fieldId}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function FieldMetadataPanel({ field }: { field: FieldDefinition }) {
  return (
    <div className="space-y-3" data-testid="field-metadata-panel">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Field Label</h4>
        <p className="text-sm">{field.label}</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Field ID</h4>
        <code className="text-xs bg-muted px-2 py-1 rounded">{field.id}</code>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Kind</h4>
          <Badge variant="outline" className="text-xs">
            {field.kind}
          </Badge>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Data Type</h4>
          <Badge variant="outline" className="text-xs">
            {field.dataType}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Requiredness</h4>
          <Badge
            variant="outline"
            className={`text-xs ${
              field.requiredness === 'required'
                ? 'text-red-600 dark:text-red-400'
                : field.requiredness === 'conditional'
                  ? 'text-amber-600 dark:text-amber-400'
                  : ''
            }`}
          >
            {field.requiredness}
          </Badge>
        </div>
        {field.cardinality && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Cardinality</h4>
            <Badge variant="outline" className="text-xs">
              {field.cardinality}
            </Badge>
          </div>
        )}
      </div>

      {field.controlledTerminology && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Controlled Terminology</h4>
          <div className="space-y-1">
            <p className="text-xs">
              Code List: <code className="bg-muted px-1.5 py-0.5 rounded">{field.controlledTerminology.codeList}</code>
            </p>
            <div className="text-xs">
              <span className="text-muted-foreground">Values:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {field.controlledTerminology.values.slice(0, 5).map((value, index) => {
                  const label = typeof value === 'string' ? value : value.label;
                  return (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  );
                })}
                {field.controlledTerminology.values.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{field.controlledTerminology.values.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {field.validationRules && field.validationRules.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Validation Rules</h4>
          <ul className="space-y-1">
            {field.validationRules.map((rule, index) => (
              <li key={index} className="text-xs flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{rule.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {field.aiHints && field.aiHints.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">AI Hints</h4>
          <ul className="space-y-1">
            {field.aiHints.map((hint, index) => (
              <li key={index} className="text-xs text-violet-600 dark:text-violet-400 italic">
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ValidationTab({
  issues,
  draft,
  sectionId,
}: {
  issues: ValidationIssue[];
  draft?: GeneratedSectionDraft | null;
  sectionId: string | null;
}) {
  const draftFindings = draft?.validationFindings ?? [];
  const draftChanges = draft?.validationChanges ?? [];
  const validationHistory = draft?.validationHistory ?? [];
  const hasContent =
    issues.length > 0 || draftFindings.length > 0 || draftChanges.length > 0 || validationHistory.length > 0;
  const terminologyStatus = draft ? resolveControlledTerminologyStatus(draftChanges) : null;
  const structureStatus = draft ? resolveM11StructureStatus(draftFindings) : null;
  const providerLabel = draft
    ? formatValidationProviderLabel(draft.validationProvider, draft.validationModel)
    : '—';

  if (!hasContent) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
        <p>No validation issues</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {draft ? (
        <div className="grid grid-cols-2 gap-3" data-testid="validation-tab-status-grid">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Provider</h4>
            <p className="text-xs">{providerLabel}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Controlled terminology</h4>
            <p className="text-xs" data-testid="validation-tab-terminology-status">
              {terminologyStatus ?? '—'}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">M11 structure</h4>
            <p className="text-xs" data-testid="validation-tab-structure-status">
              {structureStatus ?? '—'}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Changes</h4>
            <p className="text-xs">{draftChanges.length}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Findings</h4>
            <p className="text-xs">{draftFindings.length}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Workflow</h4>
            <Badge variant="outline" className="text-xs">
              {draft.workflowState ?? draft.state}
            </Badge>
          </div>
        </div>
      ) : null}

      {draftChanges.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Proposed changes</h4>
          <div className="space-y-2">
            {draftChanges.map((change) => (
              <div key={change.id} className="p-2 rounded border border-border bg-card/50 text-xs">
                <p className="font-medium">
                  {formatValidationChangeType(change.type, change.severity)} · {change.severity}
                </p>
                <p className="text-muted-foreground mt-0.5">{change.reason}</p>
                {change.originalText && change.replacementText ? (
                  <p className="text-muted-foreground mt-0.5">
                    {change.originalText} → {change.replacementText}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {draftFindings.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Findings</h4>
          <div className="space-y-2">
            {draftFindings.map((finding, index) => {
              const severityColor = getSeverityColor(finding.severity);
              const SeverityIcon =
                finding.severity === 'error' ? AlertCircle : finding.severity === 'warning' ? AlertTriangle : Info;

              return (
                <div
                  key={`${finding.code ?? 'finding'}-${index}`}
                  className={`p-3 rounded-lg border ${severityColor.border} ${severityColor.bg}`}
                >
                  <div className="flex items-start gap-2">
                    <SeverityIcon className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor.icon}`} />
                    <div className="flex-1 min-w-0">
                      {finding.code ? (
                        <p className="text-[10px] font-mono text-muted-foreground">{finding.code}</p>
                      ) : null}
                      <p className={`text-sm ${severityColor.text}`}>{finding.message}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${severityColor.text}`}>
                      {finding.severity}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {validationHistory.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">History</h4>
          <div className="space-y-2">
            {validationHistory.slice().reverse().map((entry, index) => (
              <div key={`${entry.attemptedAt}-${index}`} className="p-2 rounded border border-border bg-card/50 text-xs">
                <p className="font-medium">{entry.outcome.replace(/_/g, ' ')}</p>
                <p className="text-muted-foreground mt-0.5">
                  {format(new Date(entry.attemptedAt), 'MMM d, yyyy h:mm a')}
                  {entry.changeCount > 0 ? ` · ${entry.changeCount} changes` : ' · no text changes'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {issues.length > 0 ? (
        <div>
          {draftFindings.length > 0 ? (
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Protocol issues</h4>
          ) : null}
          <div className="space-y-3">
      {issues.map((issue) => {
        const severityColor = getSeverityColor(issue.severity);
        const SeverityIcon = issue.severity === 'error' ? AlertCircle : issue.severity === 'warning' ? AlertTriangle : Info;

        return (
          <div key={issue.id} className={`p-3 rounded-lg border ${severityColor.border} ${severityColor.bg}`}>
            <div className="flex items-start gap-2">
              <SeverityIcon className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor.icon}`} />
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium ${severityColor.text}`}>{issue.name}</h4>
                <p className="text-xs mt-1">{issue.message}</p>
                {issue.quickFix && (
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                    Quick Fix: {issue.quickFix}
                  </Button>
                )}
              </div>
              <Badge variant="outline" className={`text-[10px] ${severityColor.text}`}>
                {issue.severity}
              </Badge>
            </div>
          </div>
        );
      })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommentsTab({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No comments yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium">{comment.user}</p>
              <p className="text-xs text-muted-foreground">{format(comment.timestamp, 'MMM d, yyyy h:mm a')}</p>
            </div>
            {!comment.resolved && (
              <Badge variant="secondary" className="text-xs">
                Open
              </Badge>
            )}
          </div>
          <p className="text-sm">{comment.content}</p>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ events }: { events: AuditEvent[] }) {
  return (
    <div className="space-y-2">
      {events.slice(0, 10).map((event) => (
        <div key={event.id} className="flex items-start gap-2 text-xs pb-2 border-b border-border last:border-0">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{event.action}</p>
            <p className="text-muted-foreground">{event.details}</p>
            <p className="text-muted-foreground mt-0.5">
              {event.user} • {format(event.timestamp, 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MappingsTab({
  field,
  structuralMapping,
  sectionImportDiagnostics,
  canonicalSourceSection,
  sectionId,
}: {
  field: FieldDefinition | null;
  structuralMapping?: MappedProtocolSection | null;
  sectionImportDiagnostics?: SectionImportDiagnostics | null;
  canonicalSourceSection?: CanonicalSourceSection | null;
  sectionId: string | null;
}) {
  if (structuralMapping) {
    return (
      <div className="space-y-3">
        <CanonicalDocumentSectionPanel section={canonicalSourceSection} diagnostics={sectionImportDiagnostics} />
        <MappingDiagnosticsSummary diagnostics={sectionImportDiagnostics} />
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Source heading</h4>
          <p className="text-sm">{structuralMapping.sourceHeading}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Method</h4>
            <Badge variant="outline" className="text-xs">
              {structuralMapping.mappingMethod}
            </Badge>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Confidence</h4>
            <p className="text-xs">{Math.round(structuralMapping.mappingConfidence * 100)}%</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Imported length</h4>
            <p className="text-xs">{structuralMapping.importedTextLength} characters</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Needs validation</h4>
            <p className="text-xs">{structuralMapping.needsValidation ? 'Yes' : 'No'}</p>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Source preview</h4>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{structuralMapping.sourcePreview}</p>
        </div>
        {(structuralMapping.mappingWarnings ?? []).length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Diagnostics</h4>
            <ul className="space-y-1">
              {structuralMapping.mappingWarnings!.map((warning, index) => (
                <li key={index} className="text-xs flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (field) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No structural mapping for this field</p>
      </div>
    );
  }

  return (
    <div className="text-center py-8 text-sm text-muted-foreground">
      <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p>{sectionId ? 'No structural mapping for this section' : 'Select a section to view mapping diagnostics'}</p>
      {sectionImportDiagnostics ? (
        <div className="mt-4 text-left space-y-3">
          <CanonicalDocumentSectionPanel section={canonicalSourceSection} diagnostics={sectionImportDiagnostics} />
          <MappingDiagnosticsSummary diagnostics={sectionImportDiagnostics} />
        </div>
      ) : canonicalSourceSection ? (
        <div className="mt-4 text-left">
          <CanonicalDocumentSectionPanel section={canonicalSourceSection} diagnostics={sectionImportDiagnostics} />
        </div>
      ) : null}
    </div>
  );
}

function MappingDiagnosticsSummary({ diagnostics }: { diagnostics?: SectionImportDiagnostics | null }) {
  if (!diagnostics) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3" data-testid="mapping-diagnostics-summary">
      <h4 className="text-xs font-semibold text-muted-foreground">Import mapping diagnostics</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">mappingStatus</p>
          <Badge variant="outline" className="text-xs mt-1">
            {diagnostics.mappingStatus}
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-1">{mappingStatusLabel(diagnostics.mappingStatus)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">mappingReason</p>
          <Badge variant="outline" className="text-xs mt-1">
            {diagnostics.mappingReason}
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-1">{mappingReasonLabel(diagnostics.mappingReason)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">generationEligibility</p>
          <Badge variant="outline" className="text-xs mt-1">
            {diagnostics.generationEligibility}
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-1">
            {generationEligibilityLabel(diagnostics.generationEligibility)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">foundInSource</p>
          <p className="text-xs mt-1">{diagnostics.foundInSource ? 'Yes' : 'No'}</p>
        </div>
      </div>
      {diagnostics.sourceHeadingMatch ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Source heading</p>
          <p className="text-xs mt-1">{diagnostics.sourceHeadingMatch}</p>
        </div>
      ) : null}
      {diagnostics.mappingDetail ? (
        <p className="text-xs text-muted-foreground">{diagnostics.mappingDetail}</p>
      ) : null}
      {diagnostics.mappingSimilarityScore !== undefined ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">mappingSimilarityScore</p>
          <p className="text-xs mt-1">{Math.round(diagnostics.mappingSimilarityScore * 100)}%</p>
          {(diagnostics.mappingSimilarityReasons ?? []).length > 0 ? (
            <p className="text-[10px] text-muted-foreground mt-1">
              {(diagnostics.mappingSimilarityReasons ?? []).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
      {diagnostics.generationSkipReason ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">generationSkipReason</p>
          <p className="text-xs mt-1">{diagnostics.generationSkipReason}</p>
        </div>
      ) : null}
    </div>
  );
}

function ImportDiagnosticsPanel({ diagnostics }: { diagnostics: SectionImportDiagnostics }) {
  return (
    <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3" data-testid="import-diagnostics-panel">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <h4 className="text-xs font-semibold">Import Diagnostics</h4>
      </div>
      <p className="text-xs text-muted-foreground">{diagnostics.diagnosticSummary}</p>
      <MappingDiagnosticsSummary diagnostics={diagnostics} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Generation attempted</p>
          <p className="text-xs mt-1">{diagnostics.generationAttempted ? 'Yes' : 'No'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Captured</p>
          <p className="text-xs mt-1">{format(new Date(diagnostics.capturedAt), 'MMM d, yyyy h:mm a')}</p>
        </div>
      </div>
    </div>
  );
}

function DocumentDiagnosticsPanel({
  canonicalDocument,
  canonicalSourceSection,
  sectionImportDiagnostics,
}: {
  canonicalDocument?: CanonicalDocument | null;
  canonicalSourceSection?: CanonicalSourceSection | null;
  sectionImportDiagnostics?: SectionImportDiagnostics | null;
}) {
  if (!canonicalDocument && !canonicalSourceSection && !sectionImportDiagnostics) {
    return null;
  }

  const sectionLength =
    canonicalSourceSection?.text.length ??
    sectionImportDiagnostics?.canonicalBlockCount ??
    undefined;

  return (
    <div className="space-y-3 rounded-md border border-border p-3" data-testid="document-diagnostics-panel">
      <div className="flex items-center gap-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold">Document Diagnostics</h4>
      </div>
      {canonicalDocument ? (
        <p className="text-xs text-muted-foreground">
          {canonicalDocument.statistics.blockCount} blocks · {canonicalDocument.statistics.sectionCount} sections ·{' '}
          {canonicalDocument.statistics.tableCount} tables
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Source heading</p>
          <p className="text-xs mt-1">
            {canonicalSourceSection?.title ??
              sectionImportDiagnostics?.sourceHeadingMatch ??
              '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Numbering</p>
          <p className="text-xs mt-1">{canonicalSourceSection?.numbering ?? '—'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Heading level</p>
          <p className="text-xs mt-1">
            {canonicalSourceSection?.headingLevel ?? sectionImportDiagnostics?.canonicalHeadingLevel ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Section length</p>
          <p className="text-xs mt-1">{sectionLength !== undefined ? `${sectionLength} characters` : '—'}</p>
        </div>
      </div>
      {sectionImportDiagnostics?.mappingSimilarityScore !== undefined ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mapping score</p>
          <p className="text-xs mt-1">{Math.round(sectionImportDiagnostics.mappingSimilarityScore * 100)}%</p>
          {(sectionImportDiagnostics.mappingSimilarityReasons ?? []).length > 0 ? (
            <p className="text-[10px] text-muted-foreground mt-1">
              {sectionImportDiagnostics.mappingSimilarityReasons!.join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
      {(canonicalSourceSection?.diagnostics ?? []).length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Classification warnings</p>
          <ul className="mt-1 space-y-1">
            {canonicalSourceSection!.diagnostics.map((warning, index) => (
              <li key={index} className="text-xs text-amber-700 dark:text-amber-400">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CanonicalDocumentSectionPanel({
  section,
  diagnostics,
}: {
  section?: CanonicalSourceSection | null;
  diagnostics?: SectionImportDiagnostics | null;
}) {
  if (!section && !diagnostics?.canonicalSectionId) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3" data-testid="canonical-document-section-panel">
      <h4 className="text-xs font-semibold text-muted-foreground">Canonical Document Section</h4>
      {section ? (
        <>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Title</p>
            <p className="text-sm mt-1">{section.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Section ID</p>
              <code className="text-xs">{section.id}</code>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Blocks</p>
              <p className="text-xs mt-1">{section.blockIds.length}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Numbering</p>
              <p className="text-xs mt-1">{section.numbering ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Heading level</p>
              <p className="text-xs mt-1">{section.headingLevel ?? '—'}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Canonical section ID: {diagnostics?.canonicalSectionId}</p>
      )}
    </div>
  );
}

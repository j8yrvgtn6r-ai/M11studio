import { applyApprovedSectionDraft, clearDraftProtocolContentForImport } from './applyImportToProtocol';
import {
  appendProtocolBuildEvent,
  completeProtocolBuildSession,
  markProtocolImportGenerationPhase,
  markSectionsNotGenerated,
  markSectionsQueued,
  markSectionsBackgroundQueued,
  mergeSectionGenerationStatesFromDrafts,
  resetQuickReconstructionVisualization,
  setProtocolBuildFailedSectionIds,
  setProtocolBuildGenerationProgress,
  startProtocolBuildSession,
  getProtocolBuildConsoleState,
  injectSectionIntoGenerationQueue,
  prependSectionGenerationPriority,
  updateSectionGenerationState,
  markStudyModelEnrichmentFinished,
  markStudyModelEnrichmentStarted,
  markStudyModelCoreComplete,
  updateStudyModelEnrichmentProgress,
} from '../build/protocolBuildConsoleStore';
import { DocxExtractionError, extractDocxProtocolSource } from './docxProtocolExtractor';
import {
  failedSectionIdsFromDrafts,
  mergeRetriedSectionDrafts,
  runM11SectionGeneration,
} from './llm/m11GenerationProvider';
import { formatGenerationProgressDetail, type M11GenerationProgressSnapshot } from './llm/m11GenerationProgress';
import { getConfiguredLlmProviderId } from './llm/llmConfig';
import { runDeepKnowledgeEnrichment, UNDERSTANDING_SLICE_DEFINITIONS } from './llm/understandingSlices';
import { buildCoreStudyModel, coreStudyModelToProtocolKnowledgeModel } from './coreStudyModel';
import {
  formatLlmUserError,
  ImportProcessingAbortedError,
  throwIfAborted,
} from './llm/llmRequestTimeouts';
import { loadProtocolSourceDocument, saveProtocolSourceDocument } from './protocolImportStorage';
import { applyPostGenerationValidation, applyPostGenerationValidationBatch } from './postGenerationValidation';
import {
  stageProtocolImportCoreUnderstanding,
  stageProtocolImportUnderstanding,
  stageProtocolImportExtraction,
  stageProtocolImportMappings,
  stageProtocolImportDiagnostics,
  markProtocolImportUnderstandingPhase,
  mergeProtocolKnowledgeEnrichment,
  upsertLiveSectionImportDraft,
  stageImportSummaryReports,
} from './protocolImportStore';
import {
  buildImportSummaryReport,
  buildLlmRoutingAuditReport,
  formatImportSummaryLines,
  formatLlmRoutingAuditLines,
} from './importSummaryReport';
import { runSoAAgentFromImport } from '../../../agents/soaAgentRunner';
import { runTitlePageExtractionAgent } from '../../../agents/titlePageExtractionRunner';
import {
  assertPriorityGenerationContextReady,
  getPriorityGenerationContextDiagnostics,
  ImportGenerationContextNotReadyError,
  isPriorityGenerationContextReady,
  logImportGenerationContextGap,
} from './importGenerationContext';
import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import { ICH_M11_TECHNICAL_SPEC_SECTION_SPECS } from '../ichM11/ichM11TechnicalSpecification';
import { getM11CodelistCount, getM11TermCount } from '../ichM11/ichM11ControlledTerminology';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';
import type {
  DocxExtractionProgress,
  GeneratedSectionDraft,
  ImportProcessingStep,
  ImportProcessingStepId,
  ImportedProtocolSource,
  ProtocolSourceArtifact,
} from './types';
import { mutateProtocolDocument, getProtocolDocument } from '../store/protocolStore';
import {
  flattenProtocolSectionIds,
  listM11GenerationTargetSectionIds,
} from './importVisualizationUtils';
import {
  listNotGeneratedM11SectionIds,
  listQuickReconstructionSectionIds,
} from './quickReconstructionSections';
import { createImportedSectionDraft, markDraftAsGenerated } from './importedSectionBuilder';
import {
  buildSectionImportDiagnosticsSnapshot,
  emitOrphanImportDiagnosticEvents,
} from './sectionImportDiagnostics';
import { runStructuralMappingAgent } from '../../../agents/structuralMappingAgentRunner';
import { runGenerationAgentSchedule } from '../../../agents/generationAgentRunner';
import { rebuildStudyModel, setStudyModelPhase } from '../../study-model/studyModelStore';
import { createSectionRegeneratedCommit } from './protocolVersioning';
import {
  getProtocolImportState,
  getImportedProtocolSource,
  getProtocolKnowledgeModel,
  subscribeProtocolImport,
} from './protocolImportStore';

export const IMPORT_PROCESSING_STEP_DEFS: Array<{ id: ImportProcessingStepId; label: string }> = [
  { id: 'uploading', label: 'Upload' },
  { id: 'reading-docx', label: 'Extract DOCX' },
  { id: 'identifying-sections', label: 'Detect & Map Structure' },
  { id: 'understanding-context', label: 'Build Core Study Model' },
  { id: 'rewriting-m11', label: 'Generate Missing Sections' },
  { id: 'structure-checks', label: 'Run Validation' },
  { id: 'preparing-workspace', label: 'Prepare Workspace' },
];

export function createInitialProcessingSteps(): ImportProcessingStep[] {
  return IMPORT_PROCESSING_STEP_DEFS.map((step, index) => ({
    id: step.id,
    label: step.label,
    state: index === 0 ? 'active' : 'pending',
  }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stepIndex(id: ImportProcessingStepId): number {
  return IMPORT_PROCESSING_STEP_DEFS.findIndex((step) => step.id === id);
}

export function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.docx') &&
    (file.type === '' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/octet-stream')
  );
}

export async function storeUploadedDocxArtifact(file: File): Promise<ProtocolSourceArtifact> {
  if (!isDocxFile(file)) {
    throw new Error('Only .docx files are supported in v1.');
  }

  const id = `protocol-import-${Date.now()}`;
  const storagePath = `reference/protocol-import/${id}.docx`;
  const uploadedAt = new Date().toISOString();
  const blob = new Blob([await file.arrayBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  await saveProtocolSourceDocument({
    id,
    storagePath,
    filename: file.name,
    uploadedAt,
    fileSize: file.size,
    mimeType: blob.type,
    blob,
  });

  return {
    id,
    filename: file.name,
    uploadedAt,
    fileSize: file.size,
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sourceType: 'user-uploaded-protocol',
    status: 'uploaded',
    storagePath,
  };
}

export interface ProcessImportCallbacks {
  onStepsUpdate: (steps: ImportProcessingStep[]) => void;
  onGenerationProgress?: (progress: M11GenerationProgressSnapshot) => void;
  onSectionDraftGenerated?: (draft: GeneratedSectionDraft) => void;
  signal?: AbortSignal;
}

function createLiveSectionDraftHandler(
  callbacks: ProcessImportCallbacks,
  options?: { onFirstDraft?: () => void },
) {
  let firstDraftEmitted = false;
  return (draft: GeneratedSectionDraft) => {
    const validated = applyPostGenerationValidation(draft);
    upsertLiveSectionImportDraft(validated);
    callbacks.onSectionDraftGenerated?.(validated);
    if (!firstDraftEmitted) {
      firstDraftEmitted = true;
      options?.onFirstDraft?.();
    }
  };
}

export interface ProtocolImportProcessingResult {
  artifact: ProtocolSourceArtifact;
  importedSource: ImportedProtocolSource;
  protocolKnowledgeModel: ProtocolKnowledgeModel;
  sectionDrafts: GeneratedSectionDraft[];
  failedSectionIds: string[];
  partialGenerationFailure: boolean;
}

function formatExtractionDetail(progress: DocxExtractionProgress): string {
  const parts: string[] = [];
  if (progress.paragraphCount !== undefined) parts.push(`${progress.paragraphCount} paragraphs`);
  if (progress.headingCount !== undefined) parts.push(`${progress.headingCount} headings`);
  if (progress.sectionCandidateCount !== undefined) parts.push(`${progress.sectionCandidateCount} source sections`);
  if (progress.warnings?.length) parts.push(`${progress.warnings.length} warning(s)`);
  return parts.join(' · ');
}

function buildGenerationInput(
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
  protocolKnowledgeModel: ProtocolKnowledgeModel,
  sectionIds?: string[],
) {
  return {
    sourceExtraction: importedSource,
    protocolKnowledgeModel,
    m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
    m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
    controlledTerminology: {
      codelistCount: getM11CodelistCount(),
      termCount: getM11TermCount(),
    },
    artifact,
    sectionIds,
  };
}

export async function runProtocolImportProcessing(
  artifact: ProtocolSourceArtifact,
  docxBlob: Blob,
  callbacks: ProcessImportCallbacks,
): Promise<ProtocolImportProcessingResult> {
  const steps = createInitialProcessingSteps();
  const providerId = getConfiguredLlmProviderId();

  const updateStep = (id: ImportProcessingStepId, patch: Partial<ImportProcessingStep>) => {
    const index = stepIndex(id);
    if (index < 0) return;
    steps[index] = { ...steps[index], ...patch };
    for (let i = 0; i < index; i += 1) {
      if (steps[i].state === 'active') {
        steps[i] = { ...steps[i], state: 'complete' };
      }
    }
    callbacks.onStepsUpdate([...steps]);
  };

  const updateGenerationProgress = (progress: M11GenerationProgressSnapshot) => {
    const enriched = { ...progress, mode: 'Quick' };
    callbacks.onGenerationProgress?.(enriched);
    setProtocolBuildGenerationProgress(enriched);
    updateStep('rewriting-m11', {
      state: 'active',
      detail: formatGenerationProgressDetail(enriched),
      generationProgress: enriched,
    });
  };

  const allM11SectionIds = listM11GenerationTargetSectionIds();
  const prioritySectionIds = listQuickReconstructionSectionIds();

  try {
    throwIfAborted(callbacks.signal);

    const protocolSectionIds = flattenProtocolSectionIds(getProtocolDocument().sections);
    resetQuickReconstructionVisualization({ protocolSectionIds, allM11SectionIds, prioritySectionIds });

    updateStep('uploading', { state: 'active', detail: artifact.filename });
    appendProtocolBuildEvent({ type: 'info', message: `DOCX uploaded: ${artifact.filename}` });
    await delay(200);
    updateStep('uploading', { state: 'complete' });

    updateStep('reading-docx', { state: 'active', detail: 'Extracting DOCX…' });
    const importedSource = await extractDocxProtocolSource(docxBlob, artifact.id, artifact.filename, {
      onCanonicalProgress: (event) => {
        appendProtocolBuildEvent({
          type: event.phase === 'complete' ? 'success' : 'progress',
          message: event.message,
          metadata: event.metadata,
        });
      },
    });
    appendProtocolBuildEvent({
      type: 'success',
      message: `Extracted ${importedSource.paragraphs.length} paragraphs and ${importedSource.headings.length} headings`,
      metadata: {
        paragraphCount: importedSource.paragraphs.length,
        headingCount: importedSource.headings.length,
      },
    });
    updateStep('reading-docx', {
      state: 'complete',
      detail: formatExtractionDetail({
        paragraphCount: importedSource.paragraphs.length,
        headingCount: importedSource.headings.length,
      }),
    });

    updateStep('identifying-sections', { state: 'active' });
    appendProtocolBuildEvent({ type: 'progress', message: 'Detecting protocol structure...' });
    const { result: structuralMapping, output: structuralMappingOutput } = await runStructuralMappingAgent(importedSource, { trigger: 'import' });
    appendProtocolBuildEvent({ type: 'progress', message: 'Mapping content into M11 hierarchy...' });
    appendProtocolBuildEvent({
      type: 'success',
      message: `${structuralMapping.mappedSectionIds.length} sections mapped.`,
      metadata: { mappedSections: structuralMapping.mappedSectionIds.length },
    });

    const importedDrafts = structuralMapping.mappings.map((mapping) =>
      createImportedSectionDraft(mapping, artifact, importedSource),
    );
    await stageProtocolImportExtraction({ ...artifact, status: 'processing' }, importedSource);
    await stageProtocolImportMappings(structuralMapping.mappings, structuralMappingOutput.suspiciousMappings);
    appendProtocolBuildEvent({ type: 'success', message: 'Import extraction staged for generation context' });

    for (const draft of importedDrafts) {
      upsertLiveSectionImportDraft(draft);
      updateSectionGenerationState(draft.sectionId, 'importedUnvalidated');
      callbacks.onSectionDraftGenerated?.(draft);
    }
    if (importedDrafts.length > 0) {
      appendProtocolBuildEvent({ type: 'success', message: 'First draft available' });
    }

    updateStep('identifying-sections', {
      state: 'complete',
      detail: `${structuralMapping.mappedSectionIds.length} mapped · ${structuralMapping.needsGenerationSectionIds.length} need generation`,
    });

    updateStep('understanding-context', {
      state: 'active',
      detail: 'Building Core Study Model…',
    });
    appendProtocolBuildEvent({ type: 'progress', message: 'Building Core Study Model' });
    const coreStartedAt = performance.now();
    const coreStudyModel = await buildCoreStudyModel({
      sourceExtraction: importedSource,
      artifact,
      signal: callbacks.signal,
    });
    let protocolKnowledgeModel = coreStudyModelToProtocolKnowledgeModel(
      coreStudyModel,
      providerId,
      coreStudyModel.usedLlm ? 'core-llm-v1' : 'core-deterministic-v1',
    );
    appendProtocolBuildEvent({
      type: 'success',
      message: 'Core Study Model complete',
      durationMs: Math.round(performance.now() - coreStartedAt),
      metadata: { usedLlm: coreStudyModel.usedLlm },
    });
    markStudyModelCoreComplete();

    appendProtocolBuildEvent({ type: 'progress', message: 'Extracting M11 Title Page fields before narrative reconstruction...' });
    await runTitlePageExtractionAgent(importedSource, protocolKnowledgeModel);

    await stageProtocolImportCoreUnderstanding(artifact, importedSource, protocolKnowledgeModel);
    setStudyModelPhase('core');
    rebuildStudyModel({
      sourceUploadId: importedSource.uploadId,
      knowledge: protocolKnowledgeModel,
      document: getProtocolDocument(),
    });
    assertPriorityGenerationContextReady('runProtocolImportProcessing.beforePriorityGeneration');

    updateStep('understanding-context', {
      state: 'complete',
      detail: 'Core Study Model ready · deep enrichment running in background',
    });

    const understandingInput = {
      sourceExtraction: importedSource,
      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
      m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
      artifact,
    };

    let enrichmentCompleted = 0;
    let enrichmentError: Error | null = null;
    const enrichmentPromise = runDeepKnowledgeEnrichment(protocolKnowledgeModel, understandingInput, {
      signal: callbacks.signal,
      onSliceComplete: (sliceId, merged) => {
        enrichmentCompleted += 1;
        protocolKnowledgeModel = merged;
        mergeProtocolKnowledgeEnrichment(merged);
        setStudyModelPhase('enriching');
        updateStudyModelEnrichmentProgress(enrichmentCompleted, `Enriching ${sliceId}`);
      },
    })
      .then(async (result) => {
        protocolKnowledgeModel = result.model;
        mergeProtocolKnowledgeEnrichment(result.model);
        setStudyModelPhase(result.partialUnderstanding ? 'enriching' : 'deep');
        markStudyModelEnrichmentFinished(result.partialUnderstanding);
        await stageProtocolImportUnderstanding(artifact, importedSource, result.model);
        return result;
      })
      .catch((error) => {
        enrichmentError = error instanceof Error ? error : new Error(String(error));
        appendProtocolBuildEvent({
          type: 'warning',
          message: 'Deep Study Model enrichment interrupted — continuing with Core Study Model',
          metadata: { error: enrichmentError.message },
        });
        return null;
      });

    markStudyModelEnrichmentStarted(UNDERSTANDING_SLICE_DEFINITIONS.length);
    markProtocolImportUnderstandingPhase();
    appendProtocolBuildEvent({ type: 'progress', message: 'Deep Study Model enrichment started' });

    updateStep('rewriting-m11', {
      state: 'active',
      detail: 'Generating missing M11 sections…',
    });
    appendProtocolBuildEvent({
      type: 'progress',
      message: 'Generating missing M11 sections',
      provider: providerId,
    });
    markProtocolImportGenerationPhase();

    const needsGenerationIds = structuralMapping.needsGenerationSectionIds;
    const importedDraftRecord = Object.fromEntries(importedDrafts.map((draft) => [draft.sectionId, draft]));
    const generationSchedule = await runGenerationAgentSchedule({
      trigger: 'import',
      sectionDrafts: importedDraftRecord,
      mappedSections: structuralMapping.mappings,
      needsGenerationSectionIds: needsGenerationIds,
      importedSource,
      protocolKnowledgeModel,
      coreStudyModel,
    });

    const priorityNeedsGeneration = generationSchedule.prioritizedSections;
    const skippedSectionIds = generationSchedule.skippedSections.map((entry) => entry.sectionId);
    markSectionsNotGenerated(skippedSectionIds);
    if (priorityNeedsGeneration.length > 0) {
      markSectionsQueued(priorityNeedsGeneration);
    }

    const onSectionDraft = createLiveSectionDraftHandler(callbacks, {
      onFirstDraft: () => {
        if (importedDrafts.length === 0) {
          appendProtocolBuildEvent({ type: 'success', message: 'First draft available' });
        }
      },
    });

    let generatedDrafts: GeneratedSectionDraft[] = [];
    if (priorityNeedsGeneration.length > 0) {
      generatedDrafts = await runM11SectionGeneration(
        buildGenerationInput(artifact, importedSource, protocolKnowledgeModel, priorityNeedsGeneration),
        {
          signal: callbacks.signal,
          onProgress: updateGenerationProgress,
          onSectionDraft: (draft) => {
            onSectionDraft(markDraftAsGenerated(draft));
          },
        },
      );
      generatedDrafts = generatedDrafts.map((draft) => markDraftAsGenerated(draft));
    }

    let drafts = [...importedDrafts, ...generatedDrafts];

    if (generatedDrafts.length > 0) {
      appendProtocolBuildEvent({
        type: 'success',
        message: 'Priority generation complete',
        metadata: { generatedSections: generatedDrafts.length },
      });
    }

    const draftRecord = Object.fromEntries(drafts.map((draft) => [draft.sectionId, draft]));
    const backgroundSectionIds = generationSchedule.backgroundSections.filter(
      (sectionId) => !draftRecord[sectionId],
    );

    if (backgroundSectionIds.length > 0) {
      markSectionsBackgroundQueued(backgroundSectionIds);
      markSectionsQueued(backgroundSectionIds);
      appendProtocolBuildEvent({ type: 'progress', message: 'Continuing background generation' });
      appendProtocolBuildEvent({
        type: 'info',
        message:
          'You can begin reviewing completed sections while M11 Studio continues generating remaining sections',
      });

      const latestKnowledge = getProtocolKnowledgeModel() ?? protocolKnowledgeModel;
      const backgroundDrafts = await runM11SectionGeneration(
        buildGenerationInput(artifact, importedSource, latestKnowledge, backgroundSectionIds),
        {
          signal: callbacks.signal,
          onProgress: updateGenerationProgress,
          onSectionDraft: (draft) => {
            onSectionDraft(markDraftAsGenerated(draft));
          },
        },
      );
      drafts = mergeRetriedSectionDrafts(drafts, backgroundDrafts.map((draft) => markDraftAsGenerated(draft)));
    } else {
      markSectionsNotGenerated(
        generationSchedule.skippedSections.map((entry) => entry.sectionId).filter((sectionId) => !draftRecord[sectionId]),
      );
    }

    await enrichmentPromise.catch(() => null);
    protocolKnowledgeModel = getProtocolKnowledgeModel() ?? protocolKnowledgeModel;

    const failedSectionIds = failedSectionIdsFromDrafts(
      drafts.filter((draft) => draft.contentOrigin === 'generated'),
    );
    const partialGenerationFailure = failedSectionIds.length > 0;
    const successfulDrafts = drafts.filter((draft) => draft.generationStatus !== 'failed');

    if (successfulDrafts.length === 0) {
      throw new Error('No sections were mapped or generated from the uploaded protocol.');
    }

    updateStep('rewriting-m11', {
      state: 'complete',
      detail: partialGenerationFailure
        ? `${successfulDrafts.length}/${drafts.length} sections ready · ${failedSectionIds.length} generation failures`
        : `${structuralMapping.mappedSectionIds.length} imported · ${generatedDrafts.length} generated`,
      generationProgress: steps[stepIndex('rewriting-m11')]?.generationProgress,
    });

    updateStep('structure-checks', { state: 'active', detail: 'Structural + terminology review artifacts…' });
    appendProtocolBuildEvent({ type: 'progress', message: 'Running post-generation validation' });
    drafts = applyPostGenerationValidationBatch(drafts);
    const warningCount = drafts.filter((d) => d.validationStatus === 'warnings').length;
    const errorCount = drafts.filter((d) => d.validationStatus === 'failed').length;
    if (warningCount > 0) {
      appendProtocolBuildEvent({
        type: 'warning',
        message: `${warningCount} section validation warning(s) generated`,
      });
    }
    updateStep('structure-checks', {
      state: 'complete',
      detail: `${drafts.length} sections validated · ${warningCount} warnings · ${errorCount} errors`,
    });

    updateStep('preparing-workspace', { state: 'active' });
    await delay(200);
    appendProtocolBuildEvent({ type: 'success', message: 'Hybrid import workspace ready' });
    updateStep('preparing-workspace', {
      state: 'complete',
      detail: partialGenerationFailure
        ? 'Hybrid workspace ready with partial generation — retry failed sections from the import dialog'
        : 'Hybrid workspace ready — validate imported sections and review generated content',
    });

    mutateProtocolDocument((document) => {
      clearDraftProtocolContentForImport(document);
    });

    const buildConsoleState = getProtocolBuildConsoleState();
    const importDiagnosticsSnapshot = buildSectionImportDiagnosticsSnapshot({
      mappings: structuralMapping.mappings,
      suspiciousMappings: structuralMappingOutput.suspiciousMappings,
      needsGenerationSectionIds: structuralMapping.needsGenerationSectionIds,
      generationSchedule,
      importedSource,
      protocolKnowledgeModel,
      importContextPhase: 'ready',
      sectionDrafts: Object.fromEntries(drafts.map((draft) => [draft.sectionId, draft])),
      sectionSkipReasons: buildConsoleState.sectionSkipReasons,
      sectionGenerationStates: buildConsoleState.sectionStates,
      generatedSectionIds: generatedDrafts.map((draft) => draft.sectionId),
      queuedSectionIds: [
        ...generationSchedule.prioritizedSections,
        ...generationSchedule.backgroundSections,
      ],
    });
    await stageProtocolImportDiagnostics(importDiagnosticsSnapshot);
    emitOrphanImportDiagnosticEvents(importDiagnosticsSnapshot, (event) => {
      appendProtocolBuildEvent(event);
    });

    try {
      const draftRecord = Object.fromEntries(drafts.map((draft) => [draft.sectionId, draft]));
      await runSoAAgentFromImport(draftRecord);
    } catch (error) {
      appendProtocolBuildEvent({
        type: 'warning',
        message: `SoA Knowledge Model refresh skipped: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const importSummaryReport = buildImportSummaryReport({
      mappings: structuralMapping.mappings,
      suspiciousMappings: structuralMappingOutput.suspiciousMappings,
      needsGenerationSectionIds: structuralMapping.needsGenerationSectionIds,
      sectionDrafts: Object.fromEntries(drafts.map((draft) => [draft.sectionId, draft])),
      sectionGenerationStates: buildConsoleState.sectionStates,
      generationSchedule,
      diagnostics: importDiagnosticsSnapshot,
    });
    const llmRoutingAudit = buildLlmRoutingAuditReport({
      mappings: structuralMapping.mappings,
      sectionDrafts: Object.fromEntries(drafts.map((draft) => [draft.sectionId, draft])),
      needsGenerationSectionIds: structuralMapping.needsGenerationSectionIds,
      generationSchedule,
    });
    await stageImportSummaryReports(importSummaryReport, llmRoutingAudit);
    appendProtocolBuildEvent({ type: 'success', message: 'Import summary dashboard ready' });
    for (const line of formatImportSummaryLines(importSummaryReport)) {
      if (line.trim()) {
        appendProtocolBuildEvent({ type: 'info', message: line, metadata: { importSummary: true } });
      }
    }
    appendProtocolBuildEvent({ type: 'info', message: 'LLM routing audit' });
    for (const line of formatLlmRoutingAuditLines(llmRoutingAudit)) {
      if (line.trim()) {
        appendProtocolBuildEvent({ type: 'info', message: line, metadata: { llmRoutingAudit: true } });
      }
    }

    mergeSectionGenerationStatesFromDrafts(drafts, { allM11SectionIds, prioritySectionIds });
    setProtocolBuildFailedSectionIds(failedSectionIds);
    completeProtocolBuildSession({
      sectionsGenerated: successfulDrafts.length,
      sectionsFailed: failedSectionIds.length,
      sectionsNeedingReview: drafts.filter((draft) => draft.generationStatus !== 'failed').length,
      totalDurationMs: steps[stepIndex('rewriting-m11')]?.generationProgress?.elapsedMs ?? 0,
      provider: drafts[0]?.provenance.generationProvider ?? providerId,
      model: drafts[0]?.provenance.generationModel,
      failedSectionIds,
    });
    appendProtocolBuildEvent({
      type: 'success',
      message: 'Protocol import completed',
      provider: drafts[0]?.provenance.generationProvider ?? providerId,
      model: drafts[0]?.provenance.generationModel,
      metadata: {
        sectionsGenerated: successfulDrafts.length,
        sectionsFailed: failedSectionIds.length,
      },
    });

    return {
      artifact: { ...artifact, status: 'processed' },
      importedSource,
      protocolKnowledgeModel,
      sectionDrafts: drafts,
      failedSectionIds,
      partialGenerationFailure,
    };
  } catch (error) {
    if (error instanceof ImportProcessingAbortedError) {
      appendProtocolBuildEvent({ type: 'warning', message: 'Import cancelled.' });
      const activeIndex = steps.findIndex((step) => step.state === 'active');
      if (activeIndex >= 0) {
        steps[activeIndex] = {
          ...steps[activeIndex],
          state: 'failed',
          detail: 'Import cancelled.',
        };
        callbacks.onStepsUpdate([...steps]);
      }
      throw error;
    }

    const activeIndex = steps.findIndex((step) => step.state === 'active');
    if (activeIndex >= 0) {
      appendProtocolBuildEvent({
        type: 'error',
        message: formatLlmUserError(error),
      });
      steps[activeIndex] = {
        ...steps[activeIndex],
        state: 'failed',
        detail: formatLlmUserError(error),
      };
      callbacks.onStepsUpdate([...steps]);
    }
    if (error instanceof DocxExtractionError) throw error;
    throw error instanceof Error ? error : new Error('Import processing failed.');
  }
}

export async function retryFailedM11SectionGeneration(
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
  protocolKnowledgeModel: ProtocolKnowledgeModel,
  existingDrafts: GeneratedSectionDraft[],
  callbacks: ProcessImportCallbacks,
): Promise<{
  sectionDrafts: GeneratedSectionDraft[];
  failedSectionIds: string[];
  partialGenerationFailure: boolean;
}> {
  const failedSectionIds = failedSectionIdsFromDrafts(existingDrafts);
  if (failedSectionIds.length === 0) {
    return {
      sectionDrafts: existingDrafts,
      failedSectionIds: [],
      partialGenerationFailure: false,
    };
  }

  const importState = getProtocolImportState();
  const source = getImportedProtocolSource();
  const knowledge = getProtocolKnowledgeModel();
  const retrySchedule = await runGenerationAgentSchedule({
    trigger: 'retryFailed',
    sectionDrafts: importState.sectionDrafts,
    failedSectionIds,
    importedSource: source,
    protocolKnowledgeModel: knowledge,
  });
  const retrySectionIds = retrySchedule.queue.map((item) => item.sectionId);
  if (retrySectionIds.length === 0) {
    return {
      sectionDrafts: existingDrafts,
      failedSectionIds,
      partialGenerationFailure: failedSectionIds.length > 0,
    };
  }

  const retriedDrafts = await runM11SectionGeneration(
    buildGenerationInput(artifact, importedSource, protocolKnowledgeModel, retrySectionIds),
    {
      signal: callbacks.signal,
      onProgress: (progress) => {
        const enriched = { ...progress, mode: 'Selected' };
        callbacks.onGenerationProgress?.(enriched);
        setProtocolBuildGenerationProgress(enriched);
        callbacks.onStepsUpdate(
          createInitialProcessingSteps().map((step) =>
            step.id === 'rewriting-m11'
              ? {
                  ...step,
                  state: 'active' as const,
                  detail: formatGenerationProgressDetail(enriched),
                  generationProgress: enriched,
                }
              : step.id === 'uploading' ||
                  step.id === 'reading-docx' ||
                  step.id === 'identifying-sections' ||
                  step.id === 'understanding-context'
                ? { ...step, state: 'complete' as const }
                : step,
          ),
        );
      },
      onSectionDraft: createLiveSectionDraftHandler(callbacks),
    },
  );

  const merged = applyPostGenerationValidationBatch(mergeRetriedSectionDrafts(existingDrafts, retriedDrafts));
  const remainingFailures = failedSectionIdsFromDrafts(merged);
  const successfulDrafts = merged.filter((draft) => draft.generationStatus !== 'failed');

  mergeSectionGenerationStatesFromDrafts(merged, {
    allM11SectionIds: listM11GenerationTargetSectionIds(),
    prioritySectionIds: listQuickReconstructionSectionIds(),
  });
  setProtocolBuildFailedSectionIds(remainingFailures);
  completeProtocolBuildSession({
    sectionsGenerated: successfulDrafts.length,
    sectionsFailed: remainingFailures.length,
    sectionsNeedingReview: merged.filter((draft) => draft.generationStatus !== 'failed').length,
    totalDurationMs: getProtocolBuildConsoleState().generationProgress?.elapsedMs ?? 0,
    provider: merged[0]?.provenance.generationProvider,
    model: merged[0]?.provenance.generationModel,
    failedSectionIds: remainingFailures,
  });
  appendProtocolBuildEvent({
    type: remainingFailures.length > 0 ? 'warning' : 'success',
    message:
      remainingFailures.length > 0
        ? `Retry completed with ${remainingFailures.length} remaining failure(s)`
        : 'Retry completed — all failed sections regenerated',
  });

  return {
    sectionDrafts: merged,
    failedSectionIds: remainingFailures,
    partialGenerationFailure: remainingFailures.length > 0,
  };
}

function buildOnDemandGenerationProgressHandler(callbacks: ProcessImportCallbacks) {
  return (progress: M11GenerationProgressSnapshot) => {
    const enriched = { ...progress, mode: 'Selected' };
    callbacks.onGenerationProgress?.(enriched);
    setProtocolBuildGenerationProgress(enriched);
  };
}

function waitForSectionImportDraft(sectionId: string, timeoutMs = 120_000): Promise<GeneratedSectionDraft> {
  const existing = getProtocolImportState().sectionDrafts[sectionId];
  if (existing && existing.generationStatus !== 'failed') {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for section ${sectionId} to generate.`));
    }, timeoutMs);

    const unsubscribe = subscribeProtocolImport(() => {
      const draft = getProtocolImportState().sectionDrafts[sectionId];
      if (draft && draft.generationStatus !== 'failed') {
        clearTimeout(timeout);
        unsubscribe();
        resolve(draft);
      }
    });
  });
}

export async function generateM11SectionOnDemand(
  sectionId: string,
  callbacks: ProcessImportCallbacks,
): Promise<GeneratedSectionDraft> {
  const buildStatus = getProtocolBuildConsoleState().status;

  if (!isPriorityGenerationContextReady()) {
    logImportGenerationContextGap('generateM11SectionOnDemand');
    throw new ImportGenerationContextNotReadyError(getPriorityGenerationContextDiagnostics());
  }

  assertPriorityGenerationContextReady('generateM11SectionOnDemand');

  const importState = getProtocolImportState();
  const source = getImportedProtocolSource();
  const knowledge = getProtocolKnowledgeModel();
  const artifact = importState.artifact;

  if (!source || !knowledge || !artifact) {
    logImportGenerationContextGap('generateM11SectionOnDemand.resolvedContext');
    throw new ImportGenerationContextNotReadyError(getImportGenerationContextDiagnostics());
  }

  const manualSchedule = await runGenerationAgentSchedule({
    trigger: 'generateSection',
    requestedSectionId: sectionId,
    sectionDrafts: importState.sectionDrafts,
    importedSource: source,
    protocolKnowledgeModel: knowledge,
  });
  const scheduled = manualSchedule.queue.find((item) => item.sectionId === sectionId);
  if (!scheduled?.canGenerateNow) {
    const reason =
      manualSchedule.skippedSections.find((entry) => entry.sectionId === sectionId)?.reason ??
      scheduled?.skipReason ??
      'Cannot generate this section yet.';
    appendProtocolBuildEvent({ type: 'warning', message: reason, sectionId });
    throw new Error(reason);
  }

  if (buildStatus === 'running' || buildStatus === 'paused') {
    injectSectionIntoGenerationQueue(sectionId);
    prependSectionGenerationPriority(sectionId);
    updateSectionGenerationState(sectionId, 'queued');
    appendProtocolBuildEvent({
      type: 'progress',
      message: `Prioritized section ${sectionId} at front of generation queue`,
      sectionId,
    });
    return waitForSectionImportDraft(sectionId);
  }

  startProtocolBuildSession({ mode: 'Selected' });
  markProtocolImportGenerationPhase();
  updateSectionGenerationState(sectionId, 'generating');
  appendProtocolBuildEvent({
    type: 'progress',
    message: `Generating section ${sectionId} on demand`,
    sectionId,
  });

  const onSectionDraft = createLiveSectionDraftHandler(callbacks);
  const drafts = await runM11SectionGeneration(
    buildGenerationInput(artifact, source, knowledge, [sectionId]),
    {
      signal: callbacks.signal,
      onProgress: buildOnDemandGenerationProgressHandler(callbacks),
      onSectionDraft,
    },
  );

  const draft = applyPostGenerationValidation(drafts[0]);
  const existingDrafts = Object.values(importState.sectionDrafts);
  const merged = applyPostGenerationValidationBatch(mergeRetriedSectionDrafts(existingDrafts, [draft]));
  mergeSectionGenerationStatesFromDrafts(merged, {
    allM11SectionIds: listM11GenerationTargetSectionIds(),
    prioritySectionIds: listQuickReconstructionSectionIds(),
  });

  createSectionRegeneratedCommit(importState.protocolId, sectionId, {
    draftVersion: draft.draftVersion,
    generationProvider: draft.provenance.generationProvider,
    generationModel: draft.provenance.generationModel,
    supersededVersion: importState.sectionDrafts[sectionId]?.draftVersion,
  });

  completeProtocolBuildSession({
    sectionsGenerated: merged.filter((item) => item.generationStatus !== 'failed').length,
    sectionsFailed: failedSectionIdsFromDrafts(merged).length,
    sectionsNeedingReview: merged.filter((item) => item.generationStatus !== 'failed').length,
    totalDurationMs: getProtocolBuildConsoleState().generationProgress?.elapsedMs ?? 0,
    provider: draft.provenance.generationProvider,
    model: draft.provenance.generationModel,
    failedSectionIds: failedSectionIdsFromDrafts(merged),
  });

  appendProtocolBuildEvent({
    type: draft.generationStatus === 'failed' ? 'error' : 'success',
    message:
      draft.generationStatus === 'failed'
        ? `Section ${sectionId} generation failed`
        : `Section ${sectionId} generated — ready for review`,
    sectionId,
  });

  return draft;
}

export async function generateRemainingM11Sections(
  callbacks: ProcessImportCallbacks,
): Promise<{
  sectionDrafts: GeneratedSectionDraft[];
  failedSectionIds: string[];
  partialGenerationFailure: boolean;
}> {
  if (!isPriorityGenerationContextReady()) {
    logImportGenerationContextGap('generateRemainingM11Sections');
    throw new ImportGenerationContextNotReadyError(getPriorityGenerationContextDiagnostics());
  }

  assertPriorityGenerationContextReady('generateRemainingM11Sections');

  const importState = getProtocolImportState();
  const source = getImportedProtocolSource();
  const knowledge = getProtocolKnowledgeModel();
  const artifact = importState.artifact;
  const existingDrafts = Object.values(importState.sectionDrafts);
  const remainingSchedule = await runGenerationAgentSchedule({
    trigger: 'generateRemaining',
    sectionDrafts: importState.sectionDrafts,
    importedSource: source,
    protocolKnowledgeModel: knowledge,
  });
  const remainingSectionIds = remainingSchedule.queue.map((item) => item.sectionId);

  if (!source || !knowledge || !artifact) {
    logImportGenerationContextGap('generateRemainingM11Sections.resolvedContext');
    throw new ImportGenerationContextNotReadyError(getImportGenerationContextDiagnostics());
  }
  if (remainingSectionIds.length === 0) {
    appendProtocolBuildEvent({
      type: 'info',
      message: `Generate Remaining skipped ${remainingSchedule.generationSummary.skippedCount} section(s)`,
      metadata: { skippedCount: remainingSchedule.generationSummary.skippedCount },
    });
    return {
      sectionDrafts: existingDrafts,
      failedSectionIds: [],
      partialGenerationFailure: false,
    };
  }

  startProtocolBuildSession({ mode: 'Selected' });
  markProtocolImportGenerationPhase();
  appendProtocolBuildEvent({
    type: 'progress',
    message: `Generating remaining sections (${remainingSectionIds.length})...`,
    metadata: {
      remainingSections: remainingSectionIds.length,
      skippedSections: remainingSchedule.generationSummary.skippedCount,
    },
  });

  const onSectionDraft = createLiveSectionDraftHandler(callbacks);
  const generated = await runM11SectionGeneration(
    buildGenerationInput(artifact, source, knowledge, remainingSectionIds),
    {
      signal: callbacks.signal,
      onProgress: buildOnDemandGenerationProgressHandler(callbacks),
      onSectionDraft,
    },
  );

  const merged = applyPostGenerationValidationBatch(mergeRetriedSectionDrafts(existingDrafts, generated));
  const failedSectionIds = failedSectionIdsFromDrafts(merged);
  mergeSectionGenerationStatesFromDrafts(merged, {
    allM11SectionIds: listM11GenerationTargetSectionIds(),
    prioritySectionIds: listQuickReconstructionSectionIds(),
  });
  setProtocolBuildFailedSectionIds(failedSectionIds);
  completeProtocolBuildSession({
    sectionsGenerated: merged.filter((draft) => draft.generationStatus !== 'failed').length,
    sectionsFailed: failedSectionIds.length,
    sectionsNeedingReview: merged.filter((draft) => draft.generationStatus !== 'failed').length,
    totalDurationMs: getProtocolBuildConsoleState().generationProgress?.elapsedMs ?? 0,
    provider: generated[0]?.provenance.generationProvider,
    model: generated[0]?.provenance.generationModel,
    failedSectionIds,
  });
  appendProtocolBuildEvent({
    type: failedSectionIds.length > 0 ? 'warning' : 'success',
    message:
      failedSectionIds.length > 0
        ? `Remaining sections generated with ${failedSectionIds.length} failure(s)`
        : 'All remaining sections generated',
  });

  return {
    sectionDrafts: merged,
    failedSectionIds,
    partialGenerationFailure: failedSectionIds.length > 0,
  };
}

export async function loadDocxBlobForArtifact(artifactId: string): Promise<Blob | null> {
  const stored = await loadProtocolSourceDocument(artifactId);
  return stored?.blob ?? null;
}

export function commitApprovedSectionToProtocol(
  draft: Parameters<typeof applyApprovedSectionDraft>[1],
): void {
  mutateProtocolDocument((document) => {
    applyApprovedSectionDraft(document, draft);
  });
}

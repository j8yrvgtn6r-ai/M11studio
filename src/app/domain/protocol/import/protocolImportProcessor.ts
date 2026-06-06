import { applyApprovedSectionDraft, clearDraftProtocolContentForImport } from './applyImportToProtocol';
import {
  appendProtocolBuildEvent,
  completeProtocolBuildSession,
  mergeSectionGenerationStatesFromDrafts,
  setProtocolBuildFailedSectionIds,
  setProtocolBuildGenerationProgress,
  startProtocolBuildSession,
  getProtocolBuildConsoleState,
} from '../build/protocolBuildConsoleStore';
import { DocxExtractionError, extractDocxProtocolSource } from './docxProtocolExtractor';
import {
  failedSectionIdsFromDrafts,
  mergeRetriedSectionDrafts,
  runM11SectionGeneration,
} from './llm/m11GenerationProvider';
import { formatGenerationProgressDetail, type M11GenerationProgressSnapshot } from './llm/m11GenerationProgress';
import { getConfiguredLlmProviderId } from './llm/llmConfig';
import { runProtocolUnderstanding } from './llm/protocolUnderstandingProvider';
import {
  formatLlmUserError,
  ImportProcessingAbortedError,
  throwIfAborted,
} from './llm/llmRequestTimeouts';
import { loadProtocolSourceDocument, saveProtocolSourceDocument } from './protocolImportStorage';
import { applyPostGenerationValidationBatch } from './postGenerationValidation';
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
import { mutateProtocolDocument } from '../store/protocolStore';

export const IMPORT_PROCESSING_STEP_DEFS: Array<{ id: ImportProcessingStepId; label: string }> = [
  { id: 'uploading', label: 'Upload' },
  { id: 'reading-docx', label: 'Extract DOCX' },
  { id: 'identifying-sections', label: 'Detect Sections' },
  { id: 'understanding-context', label: 'Build Protocol Understanding' },
  { id: 'rewriting-m11', label: 'Generate M11 Drafts' },
  { id: 'structure-checks', label: 'Run Validation' },
  { id: 'preparing-workspace', label: 'Create Review Package' },
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
  signal?: AbortSignal;
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
    const enriched = { ...progress, mode: 'Full' };
    callbacks.onGenerationProgress?.(enriched);
    setProtocolBuildGenerationProgress(enriched);
    updateStep('rewriting-m11', {
      state: 'active',
      detail: formatGenerationProgressDetail(enriched),
      generationProgress: enriched,
    });
  };

  try {
    throwIfAborted(callbacks.signal);

    updateStep('uploading', { state: 'active', detail: artifact.filename });
    appendProtocolBuildEvent({ type: 'info', message: `DOCX uploaded: ${artifact.filename}` });
    await delay(200);
    updateStep('uploading', { state: 'complete' });

    updateStep('reading-docx', { state: 'active', detail: 'Extracting paragraphs and tables…' });
    const importedSource = await extractDocxProtocolSource(docxBlob, artifact.id, artifact.filename);
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
    await delay(100);
    appendProtocolBuildEvent({
      type: 'success',
      message: `Detected ${importedSource.sections.length} source sections`,
      metadata: { sectionCandidateCount: importedSource.sections.length },
    });
    updateStep('identifying-sections', {
      state: 'complete',
      detail: formatExtractionDetail({
        sectionCandidateCount: importedSource.sections.length,
        warnings: importedSource.extractionWarnings,
      }),
    });

    updateStep('understanding-context', {
      state: 'active',
      detail: `Provider: ${providerId} · analyzing full protocol…`,
    });
    appendProtocolBuildEvent({
      type: 'progress',
      message: `Building protocol understanding using ${providerId}`,
      provider: providerId,
    });
    const understandingStartedAt = performance.now();
    const protocolKnowledgeModel = await runProtocolUnderstanding(
      {
        sourceExtraction: importedSource,
        m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
        m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
        artifact,
      },
      { signal: callbacks.signal },
    );
    appendProtocolBuildEvent({
      type: 'success',
      message: `Protocol understanding completed · confidence ${Math.round(protocolKnowledgeModel.confidence * 100)}%`,
      provider: protocolKnowledgeModel.knowledgeProvider,
      model: protocolKnowledgeModel.understandingModel,
      durationMs: Math.round(performance.now() - understandingStartedAt),
    });
    updateStep('understanding-context', {
      state: 'complete',
      detail: `${protocolKnowledgeModel.knowledgeProvider}/${protocolKnowledgeModel.understandingModel} · confidence ${Math.round(protocolKnowledgeModel.confidence * 100)}%`,
    });

    updateStep('rewriting-m11', {
      state: 'active',
      detail: 'Reconstructing M11 sections one at a time…',
    });
    appendProtocolBuildEvent({
      type: 'progress',
      message: 'M11 section generation started',
      provider: providerId,
    });

    let drafts = await runM11SectionGeneration(buildGenerationInput(artifact, importedSource, protocolKnowledgeModel), {
      signal: callbacks.signal,
      onProgress: updateGenerationProgress,
    });

    const failedSectionIds = failedSectionIdsFromDrafts(drafts);
    const partialGenerationFailure = failedSectionIds.length > 0;
    const successfulDrafts = drafts.filter((draft) => draft.generationStatus !== 'failed');

    if (successfulDrafts.length === 0) {
      throw new Error(
        failedSectionIds.length > 0
          ? 'All M11 sections failed to generate. Retry failed sections or check your provider configuration.'
          : 'No M11 sections were generated.',
      );
    }

    updateStep('rewriting-m11', {
      state: 'complete',
      detail: partialGenerationFailure
        ? `${successfulDrafts.length}/${drafts.length} sections generated · ${failedSectionIds.length} failed — use Retry Failed Sections`
        : `${drafts.length} proposals · ${drafts[0]?.provenance.generationProvider ?? providerId}/${drafts[0]?.provenance.generationModel ?? 'model'}`,
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
    appendProtocolBuildEvent({ type: 'success', message: 'Review package created' });
    updateStep('preparing-workspace', {
      state: 'complete',
      detail: partialGenerationFailure
        ? 'Review package ready with partial generation — retry failed sections from the import dialog'
        : 'Review package ready — human approval required for all proposals',
    });

    mutateProtocolDocument((document) => {
      clearDraftProtocolContentForImport(document);
    });

    mergeSectionGenerationStatesFromDrafts(drafts);
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
      message: 'Protocol reconstruction completed',
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

  const retriedDrafts = await runM11SectionGeneration(
    buildGenerationInput(artifact, importedSource, protocolKnowledgeModel, failedSectionIds),
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
    },
  );

  const merged = applyPostGenerationValidationBatch(mergeRetriedSectionDrafts(existingDrafts, retriedDrafts));
  const remainingFailures = failedSectionIdsFromDrafts(merged);
  const successfulDrafts = merged.filter((draft) => draft.generationStatus !== 'failed');

  mergeSectionGenerationStatesFromDrafts(merged);
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

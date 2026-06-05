import { applyApprovedSectionDraft, clearDraftProtocolContentForImport } from './applyImportToProtocol';
import { DocxExtractionError, extractDocxProtocolSource } from './docxProtocolExtractor';
import { runProtocolUnderstanding } from './llm/protocolUnderstandingProvider';
import { runM11SectionGeneration } from './llm/m11GenerationProvider';
import { getConfiguredLlmProviderId } from './llm/llmConfig';
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
}

function formatExtractionDetail(progress: DocxExtractionProgress): string {
  const parts: string[] = [];
  if (progress.paragraphCount !== undefined) parts.push(`${progress.paragraphCount} paragraphs`);
  if (progress.headingCount !== undefined) parts.push(`${progress.headingCount} headings`);
  if (progress.sectionCandidateCount !== undefined) parts.push(`${progress.sectionCandidateCount} source sections`);
  if (progress.warnings?.length) parts.push(`${progress.warnings.length} warning(s)`);
  return parts.join(' · ');
}

export async function runProtocolImportProcessing(
  artifact: ProtocolSourceArtifact,
  docxBlob: Blob,
  callbacks: ProcessImportCallbacks,
): Promise<{
  artifact: ProtocolSourceArtifact;
  importedSource: ImportedProtocolSource;
  protocolKnowledgeModel: ProtocolKnowledgeModel;
  sectionDrafts: GeneratedSectionDraft[];
}> {
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

  try {
    updateStep('uploading', { state: 'active', detail: artifact.filename });
    await delay(200);
    updateStep('uploading', { state: 'complete' });

    updateStep('reading-docx', { state: 'active', detail: 'Extracting paragraphs and tables…' });
    const importedSource = await extractDocxProtocolSource(docxBlob, artifact.id, artifact.filename);
    updateStep('reading-docx', {
      state: 'complete',
      detail: formatExtractionDetail({
        paragraphCount: importedSource.paragraphs.length,
        headingCount: importedSource.headings.length,
      }),
    });

    updateStep('identifying-sections', { state: 'active' });
    await delay(100);
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
    const protocolKnowledgeModel = await runProtocolUnderstanding({
      sourceExtraction: importedSource,
      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
      m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
      artifact,
    });
    updateStep('understanding-context', {
      state: 'complete',
      detail: `${protocolKnowledgeModel.knowledgeProvider}/${protocolKnowledgeModel.understandingModel} · confidence ${Math.round(protocolKnowledgeModel.confidence * 100)}%`,
    });

    updateStep('rewriting-m11', {
      state: 'active',
      detail: `Reconstructing M11 sections from protocol understanding…`,
    });
    let drafts = await runM11SectionGeneration({
      sourceExtraction: importedSource,
      protocolKnowledgeModel,
      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
      m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
      controlledTerminology: {
        codelistCount: getM11CodelistCount(),
        termCount: getM11TermCount(),
      },
      artifact,
    });
    updateStep('rewriting-m11', {
      state: 'complete',
      detail: `${drafts.length} proposals · ${drafts[0]?.provenance.generationProvider ?? providerId}/${drafts[0]?.provenance.generationModel ?? 'model'}`,
    });

    updateStep('structure-checks', { state: 'active', detail: 'Structural + terminology review artifacts…' });
    drafts = applyPostGenerationValidationBatch(drafts);
    const warningCount = drafts.filter((d) => d.validationStatus === 'warnings').length;
    const errorCount = drafts.filter((d) => d.validationStatus === 'failed').length;
    updateStep('structure-checks', {
      state: 'complete',
      detail: `${drafts.length} sections validated · ${warningCount} warnings · ${errorCount} errors`,
    });

    updateStep('preparing-workspace', { state: 'active' });
    await delay(200);
    updateStep('preparing-workspace', {
      state: 'complete',
      detail: 'Review package ready — human approval required for all proposals',
    });

    mutateProtocolDocument((document) => {
      clearDraftProtocolContentForImport(document);
    });

    return {
      artifact: { ...artifact, status: 'processed' },
      importedSource,
      protocolKnowledgeModel,
      sectionDrafts: drafts,
    };
  } catch (error) {
    const activeIndex = steps.findIndex((step) => step.state === 'active');
    if (activeIndex >= 0) {
      steps[activeIndex] = {
        ...steps[activeIndex],
        state: 'failed',
        detail: error instanceof Error ? error.message : 'Processing failed',
      };
      callbacks.onStepsUpdate([...steps]);
    }
    if (error instanceof DocxExtractionError) throw error;
    throw error instanceof Error ? error : new Error('Import processing failed.');
  }
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

import { applyApprovedSectionDraft, clearDraftProtocolContentForImport } from './applyImportToProtocol';
import { DocxExtractionError, extractDocxProtocolSource } from './docxProtocolExtractor';
import { loadProtocolSourceDocument, saveProtocolSourceDocument } from './protocolImportStorage';
import { rewriteProtocolToM11Sections } from './rewriteProtocolToM11Sections';
import type {
  DocxExtractionProgress,
  ImportProcessingStep,
  ImportProcessingStepId,
  ImportedProtocolSource,
  ProtocolSourceArtifact,
} from './types';
import { mutateProtocolDocument } from '../store/protocolStore';

export const IMPORT_PROCESSING_STEP_DEFS: Array<{ id: ImportProcessingStepId; label: string }> = [
  { id: 'uploading', label: 'Uploading source protocol' },
  { id: 'reading-docx', label: 'Reading DOCX structure' },
  { id: 'identifying-sections', label: 'Identifying source sections' },
  { id: 'understanding-context', label: 'Understanding full protocol context' },
  { id: 'rewriting-m11', label: 'Rewriting into ICH M11 structure' },
  { id: 'creating-review-tasks', label: 'Creating section review tasks' },
  { id: 'structure-checks', label: 'Running preliminary M11 structure checks' },
  { id: 'preparing-workspace', label: 'Preparing human review workspace' },
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
  if (progress.paragraphCount !== undefined) {
    parts.push(`${progress.paragraphCount} paragraphs`);
  }
  if (progress.headingCount !== undefined) {
    parts.push(`${progress.headingCount} headings`);
  }
  if (progress.sectionCandidateCount !== undefined) {
    parts.push(`${progress.sectionCandidateCount} source sections`);
  }
  if (progress.warnings?.length) {
    parts.push(`${progress.warnings.length} warning(s)`);
  }
  return parts.join(' · ');
}

export async function runProtocolImportProcessing(
  artifact: ProtocolSourceArtifact,
  docxBlob: Blob,
  callbacks: ProcessImportCallbacks,
): Promise<{
  artifact: ProtocolSourceArtifact;
  importedSource: ImportedProtocolSource;
  sectionDrafts: ReturnType<typeof rewriteProtocolToM11Sections>;
}> {
  const steps = createInitialProcessingSteps();

  const updateStep = (id: ImportProcessingStepId, patch: Partial<ImportProcessingStep>) => {
    const index = stepIndex(id);
    if (index < 0) {
      return;
    }
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
    await delay(300);
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
    await delay(200);
    updateStep('identifying-sections', {
      state: 'complete',
      detail: formatExtractionDetail({
        sectionCandidateCount: importedSource.sections.length,
        warnings: importedSource.extractionWarnings,
      }),
    });

    const postExtractionSteps: ImportProcessingStepId[] = [
      'understanding-context',
      'rewriting-m11',
      'creating-review-tasks',
      'structure-checks',
      'preparing-workspace',
    ];

    for (const stepId of postExtractionSteps) {
      updateStep(stepId, { state: 'active' });
      await delay(stepId === 'rewriting-m11' ? 700 : 400);
      if (stepId === 'rewriting-m11') {
        updateStep(stepId, {
          state: 'complete',
          detail: 'Placeholder M11 drafts generated (LLM rewrite pending)',
        });
      } else {
        updateStep(stepId, { state: 'complete' });
      }
    }

    const drafts = rewriteProtocolToM11Sections(importedSource, artifact);

    mutateProtocolDocument((document) => {
      clearDraftProtocolContentForImport(document);
    });

    const processedArtifact: ProtocolSourceArtifact = {
      ...artifact,
      status: 'processed',
    };

    return { artifact: processedArtifact, importedSource, sectionDrafts: drafts };
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

    if (error instanceof DocxExtractionError) {
      throw error;
    }
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

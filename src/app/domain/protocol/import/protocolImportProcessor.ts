import { applyApprovedSectionDraft, clearDraftProtocolContentForImport } from './applyImportToProtocol';
import { saveProtocolSourceDocument } from './protocolImportStorage';
import { rewriteProtocolToM11Sections } from './rewriteProtocolToM11Sections';
import type {
  ImportProcessingStep,
  ImportProcessingStepId,
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

export async function runProtocolImportProcessing(
  artifact: ProtocolSourceArtifact,
  callbacks: ProcessImportCallbacks,
): Promise<{
  artifact: ProtocolSourceArtifact;
  sectionDrafts: ReturnType<typeof rewriteProtocolToM11Sections>;
}> {
  const steps = createInitialProcessingSteps();
  const setStepState = (index: number, state: ImportProcessingStep['state']) => {
    steps[index] = { ...steps[index], state };
    if (state === 'active') {
      for (let i = 0; i < index; i += 1) {
        if (steps[i].state === 'active') {
          steps[i] = { ...steps[i], state: 'complete' };
        }
      }
    }
    callbacks.onStepsUpdate([...steps]);
  };

  try {
    for (let index = 0; index < steps.length; index += 1) {
      setStepState(index, 'active');
      await delay(index === 4 ? 900 : 550);
      setStepState(index, 'complete');
    }

    const drafts = rewriteProtocolToM11Sections({ ...artifact, status: 'processed' });

    mutateProtocolDocument((document) => {
      clearDraftProtocolContentForImport(document);
    });

    const processedArtifact: ProtocolSourceArtifact = {
      ...artifact,
      status: 'processed',
    };

    return { artifact: processedArtifact, sectionDrafts: drafts };
  } catch (error) {
    const failedIndex = steps.findIndex((step) => step.state === 'active');
    if (failedIndex >= 0) {
      steps[failedIndex] = { ...steps[failedIndex], state: 'failed' };
      callbacks.onStepsUpdate([...steps]);
    }
    throw error;
  }
}

export function commitApprovedSectionToProtocol(draft: Parameters<typeof applyApprovedSectionDraft>[1]): void {
  mutateProtocolDocument((document) => {
    applyApprovedSectionDraft(document, draft);
  });
}

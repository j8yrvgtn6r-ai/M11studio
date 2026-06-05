import { applyApprovedSectionDraft, clearDraftProtocolContentForImport } from './applyImportToProtocol';

import { buildProtocolKnowledgeModel } from './buildProtocolKnowledgeModel';

import { DocxExtractionError, extractDocxProtocolSource } from './docxProtocolExtractor';

import { loadProtocolSourceDocument, saveProtocolSourceDocument } from './protocolImportStorage';

import { rewriteProtocolToM11Sections } from './rewriteProtocolToM11Sections';

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

  { id: 'uploading', label: 'Uploading source protocol' },

  { id: 'reading-docx', label: 'Reading DOCX structure' },

  { id: 'identifying-sections', label: 'Identifying source sections' },

  { id: 'understanding-context', label: 'Building protocol knowledge layer' },

  { id: 'rewriting-m11', label: 'Generating M11 section drafts' },

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

  protocolKnowledgeModel: ProtocolKnowledgeModel;

  sectionDrafts: GeneratedSectionDraft[];

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



    updateStep('understanding-context', { state: 'active', detail: 'Local deterministic extraction…' });

    const protocolKnowledgeModel = await buildProtocolKnowledgeModel(importedSource);

    const knowledgeFields = [

      protocolKnowledgeModel.studyTitle,

      protocolKnowledgeModel.protocolIdentifier,

      protocolKnowledgeModel.phase,

      protocolKnowledgeModel.objectives.length,

      protocolKnowledgeModel.endpoints.length,

    ].filter((value) => (typeof value === 'number' ? value > 0 : Boolean(value))).length;

    updateStep('understanding-context', {

      state: 'complete',

      detail: `${protocolKnowledgeModel.knowledgeProvider} · ${knowledgeFields} knowledge field(s) populated`,

    });



    updateStep('rewriting-m11', { state: 'active' });

    const drafts = rewriteProtocolToM11Sections({

      sourceExtraction: importedSource,

      protocolKnowledgeModel,

      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,

      m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,

      controlledTerminology: {

        codelistCount: getM11CodelistCount(),

        termCount: getM11TermCount(),

      },

      artifact,

      generationProvider: 'local-deterministic',

    });

    updateStep('rewriting-m11', {

      state: 'complete',

      detail: `${drafts.length} proposal drafts · local-deterministic (human review required)`,

    });



    const postDraftSteps: ImportProcessingStepId[] = [

      'creating-review-tasks',

      'structure-checks',

      'preparing-workspace',

    ];



    for (const stepId of postDraftSteps) {

      updateStep(stepId, { state: 'active' });

      await delay(400);

      updateStep(stepId, { state: 'complete' });

    }



    mutateProtocolDocument((document) => {

      clearDraftProtocolContentForImport(document);

    });



    const processedArtifact: ProtocolSourceArtifact = {

      ...artifact,

      status: 'processed',

    };



    return { artifact: processedArtifact, importedSource, protocolKnowledgeModel, sectionDrafts: drafts };

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



import type { FieldDefinition } from '../../../types/protocol';
import type { GeneratedSectionDraft } from '../import/types';
import { TITLE_PAGE_SECTION_ID } from './titlePageModel';
import { titleFieldsToNarrative } from './titlePageValidationEngine';

export { buildTitlePageValidationOutput, validateTitlePageModel, titleFieldsToNarrative } from './titlePageValidationEngine';
/** Serializes structured title-page fields into a stable validation snapshot. */
export function serializeTitlePageFieldsToText(fields: FieldDefinition[]): string {
  return titleFieldsToNarrative(fields);
}

function buildManualTitlePageDraft(fields: FieldDefinition[]): GeneratedSectionDraft {
  const narrative = serializeTitlePageFieldsToText(fields);
  const now = new Date().toISOString();
  return {
    sectionId: TITLE_PAGE_SECTION_ID,
    title: 'Title Page',
    generatedText: narrative,
    sourceText: narrative,
    sourceUploadId: 'manual',
    sourceExtractionId: 'manual',
    knowledgeModelId: '',
    matchedSourceCandidateIds: [],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'title-page-authoring-v2',
      generationTimestamp: now,
      generationPromptVersion: 'title-page-m11-v2',
      sourceUploadId: 'manual',
      knowledgeModelId: '',
      sourceCandidateIds: [],
      confidence: 1,
      generationNotes: ['Authored via canonical M11 Title Page sequence'],
      knowledgeElementsUsed: [],
      draftVersion: 1,
    },
    draftVersion: 1,
    state: 'pendingReview',
    stateChangedAt: now,
    stateChangedBy: 'Current user',
    stateHistory: [
      {
        state: 'pendingReview',
        changedAt: now,
        changedBy: 'Current user',
        note: 'Title Page structured authoring',
      },
    ],
    generatedAt: now,
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
    workflowState: 'importedUnvalidated',
    contentOrigin: 'manual',
  };
}

/** Ensures an import draft exists for Title Page workflow tracking. */
export function ensureTitlePageAuthoringDraft(fields: FieldDefinition[]): GeneratedSectionDraft {
  return buildManualTitlePageDraft(fields);
}

import type {
  GeneratedSectionDraft,
  ImportedProtocolSource,
  MappedProtocolSection,
  ProtocolSourceArtifact,
  SectionGenerationProvenance,
} from './types';

function buildImportedProvenance(
  mapping: MappedProtocolSection,
  artifact: ProtocolSourceArtifact,
  source: ImportedProtocolSource,
): SectionGenerationProvenance {
  return {
    generationProvider: 'local-deterministic',
    generationModel: 'structural-mapping-v1',
    generationTimestamp: new Date().toISOString(),
    generationPromptVersion: 'structural-mapping-v1',
    sourceUploadId: artifact.id,
    knowledgeModelId: '',
    sourceCandidateIds: [mapping.sourceCandidateId],
    confidence: mapping.mappingConfidence,
    generationNotes: [
      `Mapped from source heading "${mapping.sourceHeading}" via ${mapping.mappingMethod}.`,
    ],
    knowledgeElementsUsed: [],
    draftVersion: 1,
  };
}

export function createImportedSectionDraft(
  mapping: MappedProtocolSection,
  artifact: ProtocolSourceArtifact,
  source: ImportedProtocolSource,
): GeneratedSectionDraft {
  const now = new Date().toISOString();
  const provenance = buildImportedProvenance(mapping, artifact, source);

  return {
    sectionId: mapping.mappedM11SectionId,
    title: mapping.mappedM11SectionTitle,
    generatedText: mapping.sourceText,
    sourceText: mapping.sourceText,
    sourceHeading: mapping.sourceHeading,
    sourceUploadId: artifact.id,
    sourceExtractionId: source.uploadId,
    knowledgeModelId: '',
    matchedSourceCandidateIds: [mapping.sourceCandidateId],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'local-deterministic',
    provenance,
    draftVersion: 1,
    state: 'pendingReview',
    stateChangedAt: now,
    stateChangedBy: 'Structural Mapping Engine',
    stateHistory: [
      {
        state: 'pendingReview',
        changedAt: now,
        changedBy: 'Structural Mapping Engine',
        note: 'Imported from source protocol via structural mapping',
      },
    ],
    generatedAt: now,
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
    workflowState: 'imported',
    contentOrigin: 'imported',
    mappingConfidence: mapping.mappingConfidence,
    mappingMethod: mapping.mappingMethod,
  };
}

export function markDraftAsGenerated(draft: GeneratedSectionDraft): GeneratedSectionDraft {
  return {
    ...draft,
    workflowState: 'generated',
    contentOrigin: 'generated',
  };
}

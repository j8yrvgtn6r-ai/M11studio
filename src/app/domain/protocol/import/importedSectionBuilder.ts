import type {

  GeneratedSectionDraft,

  ImportedProtocolSource,

  MappedProtocolSection,

  ProtocolSourceArtifact,

  SectionGenerationProvenance,

} from './types';

import { formatMappingMethodLabel } from '../../../agents/structuralMappingRules';



function buildImportedProvenance(

  mapping: MappedProtocolSection,

  artifact: ProtocolSourceArtifact,

): SectionGenerationProvenance {

  const notes = [
    `Imported from source heading: ${mapping.sourceHeading}`,
    `Mapping method: ${formatMappingMethodLabel(mapping.mappingMethod)}`,
    `Imported text length: ${mapping.importedTextLength} characters`,
    `Source preview: ${mapping.sourcePreview}`,
    ...(mapping.mappingWarnings ?? []),
  ];

  return {

    generationProvider: 'local-deterministic',

    generationModel: 'structural-mapping-agent-v1',

    generationTimestamp: new Date().toISOString(),

    generationPromptVersion: 'structural-mapping-agent-v1',

    sourceUploadId: artifact.id,

    knowledgeModelId: '',

    sourceCandidateIds: [mapping.sourceCandidateId],

    confidence: mapping.mappingConfidence,

    generationNotes: notes,

    knowledgeElementsUsed: [],

    draftVersion: 1,

  };

}



export function createImportedSectionDraft(

  mapping: MappedProtocolSection,

  artifact: ProtocolSourceArtifact,

  _source: ImportedProtocolSource,

): GeneratedSectionDraft {

  const now = new Date().toISOString();

  const provenance = buildImportedProvenance(mapping, artifact);



  return {

    sectionId: mapping.mappedM11SectionId,

    title: mapping.mappedM11SectionTitle,

    generatedText: mapping.sourceText,

    sourceText: mapping.sourceText,

    sourceHeading: mapping.sourceHeading,

    sourceSectionId: mapping.sourceSectionId,

    sourceHeadingLevel: mapping.sourceHeadingLevel,

    sourceStartIndex: mapping.sourceStartIndex,

    sourceEndIndex: mapping.sourceEndIndex,

    importedTextLength: mapping.importedTextLength,

    sourcePreview: mapping.sourcePreview,

    sourceUploadId: artifact.id,

    sourceExtractionId: _source.uploadId,

    knowledgeModelId: '',

    matchedSourceCandidateIds: [mapping.sourceCandidateId],

    extractionStatus: 'real-docx-parsed',

    generationStatus: 'generated',

    generationProvider: 'local-deterministic',

    provenance,

    draftVersion: 1,

    state: 'pendingReview',

    stateChangedAt: now,

    stateChangedBy: 'Structural Mapping Agent',

    stateHistory: [

      {

        state: 'pendingReview',

        changedAt: now,

        changedBy: 'Structural Mapping Agent',

        note: 'Imported from source protocol via structural mapping agent',

      },

    ],

    generatedAt: now,

    validationStatus: 'not-run',

    validationMessages: [],

    validationFindings: [],

    workflowState: 'importedUnvalidated',

    contentOrigin: 'imported',

    mappingConfidence: mapping.mappingConfidence,

    mappingMethod: mapping.mappingMethod,

    mappingWarnings: mapping.mappingWarnings,

    suspiciousMapping: false,

  };

}



export function markDraftAsGenerated(draft: GeneratedSectionDraft): GeneratedSectionDraft {

  return {

    ...draft,

    workflowState: 'generated',

    contentOrigin: 'generated',

  };

}


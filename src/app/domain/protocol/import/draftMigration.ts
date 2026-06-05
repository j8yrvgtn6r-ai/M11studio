import { GENERATION_PROMPT_VERSION, UNDERSTANDING_PROMPT_VERSION } from './llm/types';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';
import type { GeneratedSectionDraft, GeneratedSectionReviewStatus, SectionReviewState, SectionGenerationProvenance } from './types';

function reviewStatusToState(reviewStatus?: GeneratedSectionReviewStatus): SectionReviewState {
  switch (reviewStatus) {
    case 'approved':
      return 'validationPassed';
    case 'changes-requested':
      return 'changesRequested';
    default:
      return 'pendingReview';
  }
}

function defaultProvenance(draft: GeneratedSectionDraft): SectionGenerationProvenance {
  const provider = draft.generationProvider ?? draft.provenance?.generationProvider ?? 'local-deterministic';
  const timestamp = draft.provenance?.generationTimestamp ?? draft.generatedAt ?? new Date().toISOString();
  return {
    generationProvider: provider,
    generationModel: draft.provenance?.generationModel ?? `${provider}-legacy`,
    generationTimestamp: timestamp,
    generationPromptVersion: draft.provenance?.generationPromptVersion ?? GENERATION_PROMPT_VERSION,
    sourceUploadId: draft.provenance?.sourceUploadId ?? draft.sourceUploadId,
    knowledgeModelId: draft.provenance?.knowledgeModelId ?? draft.knowledgeModelId ?? '',
    sourceCandidateIds: draft.provenance?.sourceCandidateIds ?? draft.matchedSourceCandidateIds ?? [],
    confidence: draft.provenance?.confidence ?? 0.5,
    generationNotes: draft.provenance?.generationNotes ?? ['Migrated draft record'],
    knowledgeElementsUsed: draft.provenance?.knowledgeElementsUsed ?? [],
    draftVersion: draft.provenance?.draftVersion ?? draft.draftVersion ?? 1,
  };
}

/** Normalizes legacy persisted drafts to current state machine + provenance shape. */
export function normalizeSectionDraft(draft: GeneratedSectionDraft): GeneratedSectionDraft {
  const state = draft.state ?? reviewStatusToState(draft.reviewStatus);
  const now = draft.stateChangedAt ?? draft.generatedAt ?? new Date().toISOString();
  const actor = draft.stateChangedBy ?? draft.reviewer ?? 'local-user';
  const provenance = draft.provenance ?? defaultProvenance(draft);
  const draftVersion = draft.draftVersion ?? provenance.draftVersion ?? 1;
  const normalizedProvenance: SectionGenerationProvenance = {
    ...provenance,
    draftVersion,
  };

  return {
    ...draft,
    knowledgeModelId: draft.knowledgeModelId ?? draft.sourceExtractionId ?? '',
    generationProvider: normalizedProvenance.generationProvider,
    provenance: normalizedProvenance,
    draftVersion,
    state,
    stateChangedAt: now,
    stateChangedBy: actor,
    stateHistory:
      draft.stateHistory?.length > 0
        ? draft.stateHistory
        : [{ state, changedAt: now, changedBy: actor, note: 'Migrated draft record' }],
    matchedSourceCandidateIds: draft.matchedSourceCandidateIds ?? [],
    validationMessages: draft.validationMessages ?? [],
    validationFindings: draft.validationFindings ?? [],
    reviewStatus: undefined,
  };
}

const EMPTY_KNOWLEDGE_ARRAY_FIELDS: Array<keyof ProtocolKnowledgeModel> = [
  'extractionNotes',
  'sourceReferences',
  'primaryObjectives',
  'secondaryObjectives',
  'exploratoryObjectives',
  'estimands',
  'arms',
  'armDefinitions',
  'interventions',
  'visits',
  'assessments',
  'safetyMonitoring',
  'safetyAssessments',
  'efficacyAssessments',
  'endpoints',
];

/** Normalizes legacy or partial persisted knowledge models to the current shape. */
export function normalizeProtocolKnowledgeModel(
  raw: Partial<ProtocolKnowledgeModel> | null | undefined,
): ProtocolKnowledgeModel | null {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.sourceUploadId) {
    return null;
  }

  const normalized: ProtocolKnowledgeModel = {
    id: raw.id,
    sourceUploadId: raw.sourceUploadId,
    extractedAt: raw.extractedAt ?? new Date().toISOString(),
    knowledgeProvider: raw.knowledgeProvider ?? 'fixture',
    understandingModel: raw.understandingModel ?? `${raw.knowledgeProvider ?? 'fixture'}-legacy`,
    understandingPromptVersion: raw.understandingPromptVersion ?? UNDERSTANDING_PROMPT_VERSION,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    extractionNotes: raw.extractionNotes ?? ['Migrated protocol knowledge record'],
    sourceReferences: raw.sourceReferences ?? [],
    studyTitle: raw.studyTitle,
    shortTitle: raw.shortTitle,
    sponsor: raw.sponsor,
    protocolIdentifier: raw.protocolIdentifier,
    version: raw.version,
    phase: raw.phase,
    indication: raw.indication,
    targetPopulation: raw.targetPopulation ?? raw.population,
    inclusionCriteriaSummary: raw.inclusionCriteriaSummary ?? raw.eligibilitySummary,
    exclusionCriteriaSummary: raw.exclusionCriteriaSummary,
    primaryObjectives: raw.primaryObjectives ?? raw.objectives ?? [],
    secondaryObjectives: raw.secondaryObjectives ?? [],
    exploratoryObjectives: raw.exploratoryObjectives ?? [],
    estimands: raw.estimands ?? [],
    arms: raw.arms ?? [],
    armDefinitions: raw.armDefinitions ?? [],
    interventionModel: raw.interventionModel,
    controlType: raw.controlType,
    interventions: raw.interventions ?? [],
    visits: raw.visits ?? [],
    assessments: raw.assessments ?? [],
    safetyMonitoring: raw.safetyMonitoring ?? raw.safetyAssessments ?? [],
    safetyAssessments: raw.safetyAssessments ?? [],
    efficacyAssessments: raw.efficacyAssessments ?? [],
    statisticalSummary: raw.statisticalSummary,
    riskBenefitSummary: raw.riskBenefitSummary,
    population: raw.targetPopulation ?? raw.population,
    objectives: raw.primaryObjectives ?? raw.objectives,
    endpoints: raw.endpoints ?? [],
    eligibilitySummary: raw.inclusionCriteriaSummary ?? raw.eligibilitySummary,
  };

  for (const field of EMPTY_KNOWLEDGE_ARRAY_FIELDS) {
    const value = normalized[field];
    if (value === undefined || value === null) {
      (normalized as Record<string, unknown>)[field] = [];
    }
  }

  return normalized;
}

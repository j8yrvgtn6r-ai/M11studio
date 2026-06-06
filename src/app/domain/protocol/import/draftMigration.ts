import { GENERATION_PROMPT_VERSION, UNDERSTANDING_PROMPT_VERSION } from './llm/types';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';
import type { GeneratedSectionDraft, GeneratedSectionGenerationStatus, GeneratedSectionReviewStatus, ImportedProtocolSourceSummary, ProtocolImportState, SectionReviewState, SectionGenerationProvenance } from './types';

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

function normalizeGenerationStatus(value: unknown): GeneratedSectionGenerationStatus {
  return value === 'failed' ? 'failed' : 'generated';
}

/** Normalizes persisted import summaries (legacy PR3 and interrupted imports may omit arrays). */
export function normalizeImportedSourceSummary(
  raw: Partial<ImportedProtocolSourceSummary> | null | undefined,
): ImportedProtocolSourceSummary | null {
  if (!raw || typeof raw !== 'object' || typeof raw.uploadId !== 'string') {
    return null;
  }

  return {
    uploadId: raw.uploadId,
    filename: typeof raw.filename === 'string' ? raw.filename : 'Unknown protocol',
    extractedAt: typeof raw.extractedAt === 'string' ? raw.extractedAt : new Date().toISOString(),
    paragraphCount: typeof raw.paragraphCount === 'number' ? raw.paragraphCount : 0,
    headingCount: typeof raw.headingCount === 'number' ? raw.headingCount : 0,
    sectionCandidateCount:
      typeof raw.sectionCandidateCount === 'number' ? raw.sectionCandidateCount : 0,
    tableCount: typeof raw.tableCount === 'number' ? raw.tableCount : 0,
    extractionWarnings: Array.isArray(raw.extractionWarnings) ? raw.extractionWarnings : [],
    fullTextLength: typeof raw.fullTextLength === 'number' ? raw.fullTextLength : 0,
  };
}

/** Normalizes persisted import metadata after partial writes or interrupted live imports. */
export function normalizePersistedImportMetadata(parsed: {
  artifact?: ProtocolImportState['artifact'];
  importedSourceSummary?: Partial<ImportedProtocolSourceSummary> | null;
  protocolKnowledgeModelId?: string | null;
  protocolKnowledgeModel?: Partial<ProtocolKnowledgeModel> | null;
  protocolId?: string;
  sectionDrafts?: Record<string, GeneratedSectionDraft>;
  lastImportCompletedAt?: string | null;
}): {
  artifact: ProtocolImportState['artifact'];
  importedSourceSummary: ImportedProtocolSourceSummary | null;
  protocolKnowledgeModelId: string | null;
  sectionDrafts: Record<string, GeneratedSectionDraft>;
  lastImportCompletedAt: string | null;
  protocolId: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const normalizedDrafts: Record<string, GeneratedSectionDraft> = {};

  for (const [key, draft] of Object.entries(parsed.sectionDrafts ?? {})) {
    try {
      if (draft && typeof draft === 'object') {
        normalizedDrafts[key] = normalizeSectionDraft(draft);
      }
    } catch {
      warnings.push(`Skipped malformed section draft "${key}".`);
    }
  }

  const normalizedKnowledge = normalizeProtocolKnowledgeModel(parsed.protocolKnowledgeModel);
  const normalizedSummary = normalizeImportedSourceSummary(parsed.importedSourceSummary);
  if (parsed.importedSourceSummary && !normalizedSummary) {
    warnings.push('Import source summary was invalid and was cleared.');
  }

  let artifact = parsed.artifact ?? null;
  if (artifact && typeof artifact !== 'object') {
    warnings.push('Import artifact metadata was invalid and was cleared.');
    artifact = null;
  }

  if (artifact?.status === 'processing') {
    warnings.push('Recovered from an interrupted import — previous processing did not finish.');
    artifact = { ...artifact, status: 'uploaded' };
  }

  return {
    artifact,
    importedSourceSummary: normalizedSummary,
    protocolKnowledgeModelId:
      parsed.protocolKnowledgeModelId ?? normalizedKnowledge?.id ?? null,
    sectionDrafts: normalizedDrafts,
    lastImportCompletedAt:
      typeof parsed.lastImportCompletedAt === 'string' ? parsed.lastImportCompletedAt : null,
    protocolId: typeof parsed.protocolId === 'string' ? parsed.protocolId : '',
    warnings,
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
    generationStatus: normalizeGenerationStatus(draft.generationStatus),
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
    validationMessages: Array.isArray(draft.validationMessages) ? draft.validationMessages : [],
    validationFindings: Array.isArray(draft.validationFindings) ? draft.validationFindings : [],
    generatedText: typeof draft.generatedText === 'string' ? draft.generatedText : '',
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

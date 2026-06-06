import { getProtocolDocument } from '../store/protocolStore';
import { updateSectionGenerationState } from '../build/protocolBuildConsoleStore';
import { clearStudyModel, rebuildStudyModel } from '../../study-model/studyModelStore';
import { refreshStudyModelFromContext } from '../../study-model/refreshStudyModelFromContext';

import { ICH_M11_TERMINOLOGY_META } from '../ichM11/ichM11ControlledTerminology';

import {

  loadImportedProtocolSource,

  loadProtocolSourceDocument,

  saveImportedProtocolSource,

} from './protocolImportStorage';

import { commitApprovedSectionToProtocol } from './protocolImportProcessor';
import {
  isImportGenerationContextReady,
  logImportGenerationContextGap,
} from './importGenerationContext';

import { normalizePersistedImportMetadata, normalizeProtocolKnowledgeModel, normalizeSectionDraft } from './draftMigration';

import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';

import {

  createImportOverwriteCommit,

  createImportProcessingCommit,

  createM11GenerationCommit,

  createProtocolUnderstandingCommit,

  createSectionApprovalCommit,

  createSectionRegeneratedCommit,

  getCurrentProtocolVersion,

  getProtocolCommits,

} from './protocolVersioning';

import {

  isSectionActionable,

  isSectionApproved,

  transitionSectionState,

} from './sectionReviewStateMachine';

import { validateGeneratedSectionDraft } from './sectionDraftValidation';

import type {

  GeneratedSectionDraft,

  ImportedProtocolSource,

  ImportedProtocolSourceSummary,

  ProtocolImportReviewSummary,

  ProtocolImportState,

  ProtocolSourceArtifact,

} from './types';



const STORAGE_KEY = 'm11-protocol-import-v3';



const blobUrlCache = new Map<string, string>();

const extractionCache = new Map<string, ImportedProtocolSource>();

const knowledgeCache = new Map<string, ProtocolKnowledgeModel>();

const listeners = new Set<() => void>();



function defaultProtocolId(): string {

  return getProtocolDocument().id ?? 'PROTO-XYZ-301';

}



let state: ProtocolImportState = {

  artifact: null,

  importedSourceSummary: null,

  protocolKnowledgeModelId: null,

  protocolId: defaultProtocolId(),

  sectionDrafts: {},

  lastImportCompletedAt: null,

  storageWarnings: [],

  importContextPhase: 'idle',

};



let hydrated = false;



function notify(): void {

  for (const listener of listeners) {

    listener();

  }

}



function toSummary(source: ImportedProtocolSource): ImportedProtocolSourceSummary {

  return {

    uploadId: source.uploadId,

    filename: source.filename,

    extractedAt: source.extractedAt,

    paragraphCount: source.paragraphs.length,

    headingCount: source.headings.length,

    sectionCandidateCount: source.sections.length,

    tableCount: source.tables.length,

    extractionWarnings: source.extractionWarnings,

    fullTextLength: source.fullText.length,

  };

}



function persistMetadata(): void {

  if (typeof localStorage === 'undefined') {

    return;

  }

  localStorage.setItem(

    STORAGE_KEY,

    JSON.stringify({

      artifact: state.artifact,

      importedSourceSummary: state.importedSourceSummary,

      protocolKnowledgeModelId: state.protocolKnowledgeModelId,

      protocolId: state.protocolId,

      sectionDrafts: state.sectionDrafts,

      lastImportCompletedAt: state.lastImportCompletedAt,

      protocolKnowledgeModel: state.protocolKnowledgeModelId

        ? knowledgeCache.get(state.protocolKnowledgeModelId) ?? null

        : null,

    }),

  );

}



function loadPersistedMetadata(): void {

  if (typeof localStorage === 'undefined') {

    return;

  }

  const raw =

    localStorage.getItem(STORAGE_KEY) ??

    localStorage.getItem('m11-protocol-import-v2') ??

    localStorage.getItem('m11-protocol-import-v1');

  if (!raw) {

    return;

  }

  try {

    const parsed = JSON.parse(raw) as ProtocolImportState & {

      protocolKnowledgeModel?: ProtocolKnowledgeModel | null;

      sectionDrafts?: Record<string, GeneratedSectionDraft>;

    };

    const normalized = normalizePersistedImportMetadata(parsed);
    const normalizedKnowledge = normalizeProtocolKnowledgeModel(parsed.protocolKnowledgeModel);

    if (normalizedKnowledge) {

      knowledgeCache.set(normalizedKnowledge.id, normalizedKnowledge);

    }

    state = {

      artifact: normalized.artifact,

      importedSourceSummary: normalized.importedSourceSummary,

      protocolKnowledgeModelId:

        normalized.protocolKnowledgeModelId ?? normalizedKnowledge?.id ?? null,

      protocolId: normalized.protocolId || defaultProtocolId(),

      sectionDrafts: normalized.sectionDrafts,

      lastImportCompletedAt: normalized.lastImportCompletedAt,

      storageWarnings: normalized.warnings,

    };

    persistMetadata();

  } catch {

    localStorage.removeItem(STORAGE_KEY);

    localStorage.removeItem('m11-protocol-import-v2');

    localStorage.removeItem('m11-protocol-import-v1');

    state = {

      ...state,

      storageWarnings: ['Import storage was corrupted and has been reset. Re-import your protocol to continue.'],

    };

  }

}



export async function initProtocolImportStore(): Promise<void> {

  if (hydrated) {

    return;

  }

  loadPersistedMetadata();

  state.protocolId = state.protocolId || defaultProtocolId();



  if (state.artifact?.id) {

    const stored = await loadProtocolSourceDocument(state.artifact.id);

    if (stored?.blob) {

      revokeBlobUrl(state.artifact.id);

      blobUrlCache.set(state.artifact.id, URL.createObjectURL(stored.blob));

    }

  }



  if (state.importedSourceSummary?.uploadId) {

    const extraction = await loadImportedProtocolSource(state.importedSourceSummary.uploadId);

    if (extraction) {

      extractionCache.set(extraction.uploadId, extraction);

    }

  }



  hydrated = true;

  notify();

}



export function subscribeProtocolImport(listener: () => void): () => void {

  listeners.add(listener);

  return () => listeners.delete(listener);

}



export function getProtocolImportState(): ProtocolImportState {

  return state;

}



export function getImportedProtocolSource(): ImportedProtocolSource | null {

  const uploadId = state.importedSourceSummary?.uploadId;

  if (!uploadId) {

    return null;

  }

  return extractionCache.get(uploadId) ?? null;

}



export function getProtocolKnowledgeModel(): ProtocolKnowledgeModel | null {

  const id = state.protocolKnowledgeModelId;

  if (!id) {

    return null;

  }

  return knowledgeCache.get(id) ?? null;

}



export function getProtocolImportReviewSummary(): ProtocolImportReviewSummary {

  const drafts = Object.values(state.sectionDrafts);

  return {

    totalGenerated: drafts.length,

    pendingReview: drafts.filter((draft) => draft.state === 'pendingReview').length,

    inReview: drafts.filter((draft) => draft.state === 'inReview').length,

    approved: drafts.filter((draft) => isSectionApproved(draft.state)).length,

    changesRequested: drafts.filter((draft) => draft.state === 'changesRequested').length,

    validationPassed: drafts.filter((draft) => draft.state === 'validationPassed').length,

    validationFailed: drafts.filter((draft) => draft.state === 'validationFailed').length,

    validationWarnings: drafts.filter((draft) => draft.validationStatus === 'warnings').length,

    validationErrors: drafts.filter((draft) => draft.validationStatus === 'failed').length,

  };

}



export function getSectionImportDraft(sectionId: string): GeneratedSectionDraft | undefined {

  return state.sectionDrafts[sectionId];

}



export function getProtocolSourceBlobUrl(artifactId: string): string | null {

  return blobUrlCache.get(artifactId) ?? null;

}



export function getProtocolVersioningForImport() {

  const protocolId = state.protocolId;

  return {

    currentVersion: getCurrentProtocolVersion(protocolId),

    commits: getProtocolCommits(protocolId),

  };

}



function revokeBlobUrl(artifactId: string): void {

  const existing = blobUrlCache.get(artifactId);

  if (existing) {

    URL.revokeObjectURL(existing);

    blobUrlCache.delete(artifactId);

  }

}



export function setProtocolImportArtifact(artifact: ProtocolSourceArtifact, blob?: Blob): void {

  if (artifact.id !== state.artifact?.id) {

    revokeBlobUrl(state.artifact?.id ?? '');

  }

  state.artifact = artifact;

  if (blob) {

    revokeBlobUrl(artifact.id);

    blobUrlCache.set(artifact.id, URL.createObjectURL(blob));

  }

  persistMetadata();

  notify();

}



export function setProtocolImportExtractionFailed(

  artifact: ProtocolSourceArtifact,

  errorMessage: string,

): void {

  state.artifact = {

    ...artifact,

    status: 'extraction-failed',

    errorMessage,

  };

  state.importedSourceSummary = null;

  state.protocolKnowledgeModelId = null;

  state.sectionDrafts = {};

  persistMetadata();

  notify();

}



/** Clears persisted import/review state when the user confirms a new protocol overwrite. */
export function prepareProtocolImportOverwrite(): void {
  state.sectionDrafts = {};
  state.importedSourceSummary = null;
  state.protocolKnowledgeModelId = null;
  state.lastImportCompletedAt = null;
  state.storageWarnings = [];
  state.artifact = null;
  state.importContextPhase = 'idle';
  clearStudyModel();
  persistMetadata();
  notify();
}

/** Stages extraction + artifact immediately after DOCX parse — before protocol understanding. */
export async function stageProtocolImportExtraction(
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
): Promise<void> {
  extractionCache.set(importedSource.uploadId, importedSource);
  await saveImportedProtocolSource(importedSource);

  state.artifact = artifact;
  state.importedSourceSummary = toSummary(importedSource);
  state.protocolId = defaultProtocolId();
  state.importContextPhase = 'extraction';
  persistMetadata();
  notify();
}

export function markProtocolImportUnderstandingPhase(): void {
  if (state.importContextPhase === 'extraction' || state.importContextPhase === 'understanding') {
    state.importContextPhase = 'understanding';
    notify();
  }
}

/** Stages artifact, extraction summary, and knowledge model while M11 reconstruction is still running. */
export async function stageProtocolImportUnderstanding(
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
  protocolKnowledgeModel: ProtocolKnowledgeModel,
): Promise<void> {
  extractionCache.set(importedSource.uploadId, importedSource);
  knowledgeCache.set(protocolKnowledgeModel.id, protocolKnowledgeModel);
  await saveImportedProtocolSource(importedSource);

  state.artifact = artifact;
  state.importedSourceSummary = toSummary(importedSource);
  state.protocolKnowledgeModelId = protocolKnowledgeModel.id;
  state.protocolId = defaultProtocolId();
  state.importContextPhase = 'ready';
  persistMetadata();
  notify();
}

/** Makes a freshly generated section draft available in the workspace before import completes. */
export function upsertLiveSectionImportDraft(draft: GeneratedSectionDraft): void {
  state.sectionDrafts[draft.sectionId] = normalizeSectionDraft(draft);
  persistMetadata();
  notify();
}

/** Replaces import drafts after on-demand or remaining-section generation. */
export function syncSectionImportDrafts(drafts: GeneratedSectionDraft[]): void {
  for (const draft of drafts) {
    state.sectionDrafts[draft.sectionId] = normalizeSectionDraft(draft);
  }
  persistMetadata();
  notify();
}



export async function setProtocolImportResult(

  drafts: GeneratedSectionDraft[],

  artifact: ProtocolSourceArtifact,

  importedSource: ImportedProtocolSource,

  protocolKnowledgeModel: ProtocolKnowledgeModel,

  options?: { isOverwrite?: boolean },

): Promise<void> {

  const hadPriorImport = Boolean(state.lastImportCompletedAt && Object.keys(state.sectionDrafts).length > 0);



  extractionCache.set(importedSource.uploadId, importedSource);

  knowledgeCache.set(protocolKnowledgeModel.id, protocolKnowledgeModel);

  await saveImportedProtocolSource(importedSource);



  state.sectionDrafts = Object.fromEntries(

    drafts.map((draft) => [draft.sectionId, normalizeSectionDraft(draft)]),

  );

  state.artifact = artifact;

  state.importedSourceSummary = toSummary(importedSource);

  state.protocolKnowledgeModelId = protocolKnowledgeModel.id;

  state.lastImportCompletedAt = new Date().toISOString();

  state.protocolId = defaultProtocolId();

  state.storageWarnings = [];
  state.importContextPhase = 'ready';

  if (hadPriorImport || options?.isOverwrite) {
    createImportOverwriteCommit(state.protocolId, artifact.filename);
  }

  createImportProcessingCommit(state.protocolId, artifact.filename);

  createProtocolUnderstandingCommit(state.protocolId, {
    knowledgeModelId: protocolKnowledgeModel.id,
    knowledgeProvider: protocolKnowledgeModel.knowledgeProvider,
    understandingModel: protocolKnowledgeModel.understandingModel,
    understandingPromptVersion: protocolKnowledgeModel.understandingPromptVersion,
    confidence: protocolKnowledgeModel.confidence,
    studyTitle: protocolKnowledgeModel.studyTitle,
  });

  createM11GenerationCommit(
    state.protocolId,
    drafts.map((draft) => draft.sectionId),
    {
      generationProvider: drafts[0]?.provenance.generationProvider,
      generationModel: drafts[0]?.provenance.generationModel,
      generationPromptVersion: drafts[0]?.provenance.generationPromptVersion,
      sectionCount: drafts.length,
    },
  );

  persistMetadata();

  rebuildStudyModel({
    sourceUploadId: importedSource.uploadId,
    knowledge: protocolKnowledgeModel,
    document: getProtocolDocument(),
  });

  notify();

}



export function openSectionForReview(sectionId: string, actor = 'Current user'): void {

  const current = state.sectionDrafts[sectionId];

  if (!current || current.state === 'inReview') {

    return;

  }

  if (!['pendingReview', 'changesRequested', 'validationFailed'].includes(current.state)) {

    return;

  }

  state.sectionDrafts[sectionId] = transitionSectionState(current, 'openReview', actor, 'Opened for review');

  persistMetadata();

  notify();

}



export function updateSectionImportDraft(

  sectionId: string,

  patch: Partial<GeneratedSectionDraft>,

): void {

  const current = state.sectionDrafts[sectionId];

  if (!current) {

    return;

  }



  let next: GeneratedSectionDraft = { ...current, ...patch };



  if (patch.generatedText !== undefined && patch.generatedText !== current.generatedText) {

    next = {

      ...next,

      state: 'pendingReview',

      stateChangedAt: new Date().toISOString(),

      stateChangedBy: 'Current user',

      validationStatus: 'not-run',

      validationMessages: [],

      stateHistory: [

        ...next.stateHistory,

        {

          state: 'pendingReview',

          changedAt: new Date().toISOString(),

          changedBy: 'Current user',

          note: 'Draft text edited — requires re-review',

        },

      ],

    };

  }



  state.sectionDrafts[sectionId] = next;

  persistMetadata();

  notify();

}



export function approveSectionImportDraft(sectionId: string, reviewer = 'Current user'): void {

  const draft = state.sectionDrafts[sectionId];

  if (!draft || !isSectionActionable(draft.state)) {

    return;

  }



  let working = transitionSectionState(draft, 'approve', reviewer, 'Reviewer approved — running validation');

  working = {

    ...working,

    validationStatus: 'not-run',

    validationMessages: [],

    reviewer,

    lastReviewedAt: new Date().toISOString(),

  };

  state.sectionDrafts[sectionId] = working;

  notify();



  const validation = validateGeneratedSectionDraft(working);

  const validationEvent = validation.validationStatus === 'failed' ? 'validationFailed' : 'validationSucceeded';



  const finalized = {

    ...transitionSectionState(working, validationEvent, reviewer, 'Validation completed after approval'),

    validationStatus: validation.validationStatus,

    validationMessages: validation.messages,

    lastReviewedAt: new Date().toISOString(),

    reviewer,

  };



  state.sectionDrafts[sectionId] = finalized;



  if (finalized.state === 'validationPassed') {

    commitApprovedSectionToProtocol(finalized);

    createSectionApprovalCommit(

      state.protocolId,

      finalized,

      validation.messages.join(' ') || 'Section approved after validation.',

    );

    updateSectionGenerationState(sectionId, 'approved');
    refreshStudyModelFromContext();

  }



  persistMetadata();

  notify();

}



export function requestChangesOnSectionImportDraft(sectionId: string, reviewer = 'Current user'): void {

  const draft = state.sectionDrafts[sectionId];

  if (!draft) {

    return;

  }

  state.sectionDrafts[sectionId] = {

    ...transitionSectionState(draft, 'requestChanges', reviewer, 'Reviewer requested changes'),

    reviewer,

    lastReviewedAt: new Date().toISOString(),

    validationStatus: 'not-run',

    validationMessages: [],

  };

  persistMetadata();

  notify();

}



export async function regenerateSectionImportDraftAsync(
  sectionId: string,
  actor = 'Current user',
): Promise<void> {
  const current = state.sectionDrafts[sectionId];
  const source = getImportedProtocolSource();
  const knowledge = getProtocolKnowledgeModel();
  const artifact = state.artifact;

  if (!current || !source || !knowledge || !artifact) {
    throw new Error('Cannot regenerate section — import context is incomplete.');
  }

  const { runM11SectionRegeneration } = await import('./llm/m11GenerationProvider');
  const { applyPostGenerationValidation } = await import('./postGenerationValidation');
  const { ICH_M11_TEMPLATE_SECTION_SPECS } = await import('../ichM11/ichM11Template');
  const { ICH_M11_TECHNICAL_SPEC_SECTION_SPECS } = await import('../ichM11/ichM11TechnicalSpecification');
  const { getM11CodelistCount, getM11TermCount } = await import('../ichM11/ichM11ControlledTerminology');

  let newDraft = await runM11SectionRegeneration(
    {
      sourceExtraction: source,
      protocolKnowledgeModel: knowledge,
      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
      m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
      controlledTerminology: {
        codelistCount: getM11CodelistCount(),
        termCount: getM11TermCount(),
      },
      artifact,
      sectionIds: [sectionId],
    },
    sectionId,
    current,
  );

  newDraft = applyPostGenerationValidation(newDraft);
  newDraft = normalizeSectionDraft({
    ...newDraft,
    state: 'pendingReview',
    stateChangedAt: new Date().toISOString(),
    stateChangedBy: actor,
    stateHistory: [
      ...(current?.stateHistory ?? []),
      {
        state: 'superseded',
        changedAt: new Date().toISOString(),
        changedBy: actor,
        note: `Superseded v${current?.draftVersion ?? 1}`,
      },
      {
        state: 'pendingReview',
        changedAt: new Date().toISOString(),
        changedBy: actor,
        note: `Regenerated v${newDraft.draftVersion}`,
      },
    ],
    validationStatus: 'not-run',
    validationMessages: [],
  });

  state.sectionDrafts[sectionId] = newDraft;

  createSectionRegeneratedCommit(state.protocolId, sectionId, {
    draftVersion: newDraft.draftVersion,
    generationProvider: newDraft.provenance.generationProvider,
    generationModel: newDraft.provenance.generationModel,
    supersededVersion: current?.draftVersion,
  });

  updateSectionGenerationState(sectionId, 'needsReview');
  refreshStudyModelFromContext();

  persistMetadata();
  notify();
}

export function regenerateSectionImportDraft(

  sectionId: string,

  newDraft: GeneratedSectionDraft,

  actor = 'Current user',

): void {

  const current = state.sectionDrafts[sectionId];

  if (current) {

    state.sectionDrafts[sectionId] = transitionSectionState(

      { ...current, draftVersion: current.draftVersion },

      'regenerate',

      actor,

      'Superseded by regeneration',

    );

    const superseded = state.sectionDrafts[sectionId];

    if (superseded.state !== 'superseded') {

      state.sectionDrafts[sectionId] = {

        ...superseded,

        state: 'superseded',

        stateChangedAt: new Date().toISOString(),

        stateHistory: [

          ...superseded.stateHistory,

          {

            state: 'superseded',

            changedAt: new Date().toISOString(),

            changedBy: actor,

            note: 'Replaced by newer draft version',

          },

        ],

      };

    }

  }



  const version = (current?.draftVersion ?? 0) + 1;

  const fresh = normalizeSectionDraft({

    ...newDraft,

    sectionId,

    draftVersion: version,

    state: 'pendingReview',

    stateChangedAt: new Date().toISOString(),

    stateChangedBy: actor,

    stateHistory: [

      {

        state: 'pendingReview',

        changedAt: new Date().toISOString(),

        changedBy: actor,

        note: `Regenerated draft v${version}`,

      },

    ],

    validationStatus: 'not-run',

    validationMessages: [],

  });



  state.sectionDrafts[sectionId] = fresh;

  persistMetadata();

  notify();

}



export function downloadProtocolSourceArtifact(): void {

  const artifact = state.artifact;

  const url = artifact ? blobUrlCache.get(artifact.id) : null;

  if (!artifact || !url) {

    throw new Error('Original protocol document is not available.');

  }

  const anchor = document.createElement('a');

  anchor.href = url;

  anchor.download = artifact.filename;

  anchor.rel = 'noopener';

  document.body.appendChild(anchor);

  anchor.click();

  document.body.removeChild(anchor);

}



export function openProtocolSourceArtifact(): void {

  const artifact = state.artifact;

  const url = artifact ? blobUrlCache.get(artifact.id) : null;

  if (!artifact || !url) {

    throw new Error('Original protocol document is not available.');

  }

  window.open(url, '_blank', 'noopener,noreferrer');

}



/** @deprecated Use setProtocolImportResult */

export function setProtocolImportDrafts(

  drafts: GeneratedSectionDraft[],

  artifact: ProtocolSourceArtifact,

): void {

  void setProtocolImportResult(drafts, artifact, {

    uploadId: artifact.id,

    filename: artifact.filename,

    extractedAt: new Date().toISOString(),

    fullText: '',

    paragraphs: [],

    headings: [],

    sections: [],

    tables: [],

    extractionWarnings: ['Legacy import metadata without extraction body.'],

  }, {

    id: `knowledge-${artifact.id}`,

    sourceUploadId: artifact.id,

    extractedAt: new Date().toISOString(),

    knowledgeProvider: 'local-deterministic',

    confidence: 0,

    extractionNotes: ['Legacy migration stub'],

    objectives: [],

    endpoints: [],

    estimands: [],

    arms: [],

    interventions: [],

    safetyAssessments: [],

    efficacyAssessments: [],

  });

}



export async function generateSectionImportDraftOnDemandAsync(sectionId: string): Promise<void> {
  if (!isImportGenerationContextReady()) {
    logImportGenerationContextGap('generateSectionImportDraftOnDemandAsync');
    return;
  }

  const { generateM11SectionOnDemand } = await import('./protocolImportProcessor');
  const { setProtocolBuildGenerationProgress } = await import('../build/protocolBuildConsoleStore');
  try {
    await generateM11SectionOnDemand(sectionId, {
      onSectionDraftGenerated: (draft) => upsertLiveSectionImportDraft(draft),
      onGenerationProgress: setProtocolBuildGenerationProgress,
      onStepsUpdate: () => {},
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ImportGenerationContextNotReadyError') {
      logImportGenerationContextGap('generateSectionImportDraftOnDemandAsync');
      return;
    }
    throw error;
  }
}

export async function generateRemainingSectionImportDraftsAsync(): Promise<{
  failedSectionIds: string[];
}> {
  if (!isImportGenerationContextReady()) {
    logImportGenerationContextGap('generateRemainingSectionImportDraftsAsync');
    return { failedSectionIds: [] };
  }

  const { generateRemainingM11Sections } = await import('./protocolImportProcessor');
  const { setProtocolBuildGenerationProgress } = await import('../build/protocolBuildConsoleStore');
  try {
    const result = await generateRemainingM11Sections({
      onSectionDraftGenerated: (draft) => upsertLiveSectionImportDraft(draft),
      onGenerationProgress: setProtocolBuildGenerationProgress,
      onStepsUpdate: () => {},
    });
    syncSectionImportDrafts(result.sectionDrafts);
    return { failedSectionIds: result.failedSectionIds };
  } catch (error) {
    if (error instanceof Error && error.name === 'ImportGenerationContextNotReadyError') {
      logImportGenerationContextGap('generateRemainingSectionImportDraftsAsync');
      return { failedSectionIds: [] };
    }
    throw error;
  }
}



export { ICH_M11_TERMINOLOGY_META };



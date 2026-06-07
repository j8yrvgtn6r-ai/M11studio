import { getProtocolDocument, isBlankProjectMode, clearBlankProjectMode } from '../store/protocolStore';
import { updateSectionGenerationState, getProtocolBuildConsoleState } from '../build/protocolBuildConsoleStore';
import { clearStudyModel, rebuildStudyModel } from '../../study-model/studyModelStore';
import { refreshStudyModelFromContext } from '../../study-model/refreshStudyModelFromContext';
import { inferWorkflowState, resolveWorkflowGenerationState } from './sectionWorkflowState';
import {
  buildCanonicalDocumentFromImportedSource,
  clearCanonicalDocuments,
  getCanonicalDocumentByUploadId,
  saveCanonicalDocument,
} from '../../document-ingestion';

import { ICH_M11_TERMINOLOGY_META } from '../ichM11/ichM11ControlledTerminology';

import {

  loadImportedProtocolSource,

  loadProtocolSourceDocument,

  saveImportedProtocolSource,

} from './protocolImportStorage';

import { commitApprovedSectionToProtocol } from './protocolImportProcessor';
import {
  isImportGenerationContextReady,
  isPriorityGenerationContextReady,
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
import { buildValidatedTarget } from './sectionValidationTargetEngine';
import type { ValidationAgentOutput } from '../../../agents/validationRules';
import { TITLE_PAGE_SECTION_ID } from '../authoring/titlePageAuthoring';
import {
  buildTitlePageValidationOutput,
  ensureTitlePageAuthoringDraft,
} from '../authoring/titlePageValidation';
import { selectFieldDefinitions } from '../selectors/toFieldDefinitions';

import type {

  GeneratedSectionDraft,

  ImportedProtocolSource,

  ImportedProtocolSourceSummary,

  ImportSummaryReport,

  LlmRoutingAuditReport,

  MappedProtocolSection,

  ProtocolImportReviewSummary,

  ProtocolImportState,

  ProtocolSourceArtifact,

  SectionImportDiagnostics,

  SuspiciousMappingRecord,

} from './types';



const STORAGE_KEY = 'm11-protocol-import-v3';



function hydrateCanonicalDocumentFromSource(source: ImportedProtocolSource): void {
  if (getCanonicalDocumentByUploadId(source.uploadId)) {
    return;
  }
  saveCanonicalDocument(buildCanonicalDocumentFromImportedSource(source));
}

function cacheImportedSource(source: ImportedProtocolSource): void {
  extractionCache.set(source.uploadId, source);
  hydrateCanonicalDocumentFromSource(source);
}

const blobUrlCache = new Map<string, string>();
const extractionCache = new Map<string, ImportedProtocolSource>();

function queueKnowledgeAgentFromDraft(
  draft: GeneratedSectionDraft,
  trigger: 'import' | 'sectionEdit' | 'sectionValidation' | 'sectionReviewed' | 'sectionApproval' | 'regeneration' | 'manual' | 'background',
  previousText?: string,
): void {
  void import('../../../agents/knowledgeAgentRunner').then(({ triggerKnowledgeAgentFromDraft }) => {
    triggerKnowledgeAgentFromDraft(draft, trigger, previousText);
  });
}

function queueKnowledgeAgentEdit(
  draft: GeneratedSectionDraft,
  previousText?: string,
): void {
  void import('../../../agents/knowledgeAgentRunner').then(({ scheduleKnowledgeAgentForSectionEdit }) => {
    scheduleKnowledgeAgentForSectionEdit({
      sectionId: draft.sectionId,
      sectionTitle: draft.title,
      currentText: draft.generatedText,
      previousText,
    });
  });
}

const knowledgeCache = new Map<string, ProtocolKnowledgeModel>();

const listeners = new Set<() => void>();
const persistListeners = new Set<(timestamp: string) => void>();
let lastPersistedAt: string | null = null;



function defaultProtocolId(): string {
  if (isBlankProjectMode()) {
    return '';
  }
  return getProtocolDocument().id ?? '';
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



function sectionDraftsForStorage(): Record<string, GeneratedSectionDraft> {
  const serialized: Record<string, GeneratedSectionDraft> = {};
  for (const [sectionId, draft] of Object.entries(state.sectionDrafts)) {
    const { consistencyImpacts: _ignored, ...rest } = draft;
    serialized[sectionId] = rest;
  }
  return serialized;
}

function persistMetadata(): void {

  if (typeof localStorage === 'undefined') {

    return;

  }

  try {
    localStorage.setItem(

      STORAGE_KEY,

      JSON.stringify({

        artifact: state.artifact,

        importedSourceSummary: state.importedSourceSummary,

        protocolKnowledgeModelId: state.protocolKnowledgeModelId,

        protocolId: state.protocolId,

        sectionDrafts: sectionDraftsForStorage(),

        structuralMappings: state.structuralMappings,

        suspiciousMappings: state.suspiciousMappings,

        sectionImportDiagnostics: state.sectionImportDiagnostics,

        importSummaryReport: state.importSummaryReport,

        llmRoutingAudit: state.llmRoutingAudit,

        lastImportCompletedAt: state.lastImportCompletedAt,

        protocolKnowledgeModel: state.protocolKnowledgeModelId

          ? knowledgeCache.get(state.protocolKnowledgeModelId) ?? null

          : null,

      }),

    );
    lastPersistedAt = new Date().toISOString();
    persistListeners.forEach((listener) => listener(lastPersistedAt!));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Import metadata could not be saved to browser storage.';
    if (!state.storageWarnings.includes(message)) {
      state.storageWarnings = [...state.storageWarnings, message];
    }
  }

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

      structuralMappings: parsed.structuralMappings,

      suspiciousMappings: parsed.suspiciousMappings,

      sectionImportDiagnostics: parsed.sectionImportDiagnostics,

      importSummaryReport: parsed.importSummaryReport,

      llmRoutingAudit: parsed.llmRoutingAudit,

      lastImportCompletedAt: normalized.lastImportCompletedAt,

      storageWarnings: normalized.warnings,

      importContextPhase: parsed.importContextPhase ?? (normalized.lastImportCompletedAt ? 'ready' : 'idle'),

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

      cacheImportedSource(extraction);

    }

  }



  hydrated = true;

  notify();

}



export function subscribeProtocolImport(listener: () => void): () => void {

  listeners.add(listener);

  return () => listeners.delete(listener);

}

export function subscribeProtocolImportPersist(listener: (timestamp: string) => void): () => void {
  persistListeners.add(listener);
  if (lastPersistedAt) {
    listener(lastPersistedAt);
  }
  return () => persistListeners.delete(listener);
}

export function getLastPersistedAt(): string | null {
  return lastPersistedAt;
}

export function collectImportValidationFindings(
  sectionDrafts: Record<string, GeneratedSectionDraft> = state.sectionDrafts,
): Array<{
  sectionId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
}> {
  const findings: Array<{
    sectionId: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    code?: string;
  }> = [];
  for (const [sectionId, draft] of Object.entries(sectionDrafts)) {
    for (const finding of draft.validationFindings ?? []) {
      findings.push({
        sectionId,
        severity: finding.severity,
        message: finding.message,
        code: finding.code,
      });
    }
  }
  return findings;
}

export function normalizeValidationText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function isValidationTextUnchanged(originalText: string, validatedText: string): boolean {
  return normalizeValidationText(originalText) === normalizeValidationText(validatedText);
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
  persistImportWorkspaceReset();
}

/** Clears in-memory import caches (extractions, blobs, knowledge models). */
export function clearImportInMemoryCaches(): void {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
  extractionCache.clear();
  knowledgeCache.clear();
}

/** Resets import workspace persisted state before a replacement import. */
export function persistImportWorkspaceReset(): void {
  clearImportInMemoryCaches();
  state.sectionDrafts = {};
  state.importedSourceSummary = null;
  state.protocolKnowledgeModelId = null;
  state.lastImportCompletedAt = null;
  state.storageWarnings = [];
  state.artifact = null;
  state.structuralMappings = undefined;
  state.suspiciousMappings = undefined;
  state.sectionImportDiagnostics = undefined;
  state.importSummaryReport = undefined;
  state.llmRoutingAudit = undefined;
  state.importContextPhase = 'idle';
  clearCanonicalDocuments();
  clearStudyModel();
  persistMetadata();
  notify();
}

/** Resets all persisted import metadata for a blank project. */
export function persistProjectReset(): void {
  clearImportInMemoryCaches();
  state = {
    artifact: null,
    importedSourceSummary: null,
    protocolKnowledgeModelId: null,
    protocolId: defaultProtocolId(),
    sectionDrafts: {},
    lastImportCompletedAt: null,
    storageWarnings: [],
    importContextPhase: 'idle',
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('m11-protocol-import-v2');
    localStorage.removeItem('m11-protocol-import-v1');
  }
  notify();
}

export async function stageImportSummaryReports(
  importSummaryReport: ImportSummaryReport,
  llmRoutingAudit: LlmRoutingAuditReport,
): Promise<void> {
  state.importSummaryReport = importSummaryReport;
  state.llmRoutingAudit = llmRoutingAudit;
  persistMetadata();
  notify();
}

export function getImportSummaryReport(): ImportSummaryReport | null {
  return state.importSummaryReport ?? null;
}

export function getLlmRoutingAuditReport(): LlmRoutingAuditReport | null {
  return state.llmRoutingAudit ?? null;
}

/** Persists structural mapping results for the active import session. */
export async function stageProtocolImportMappings(
  mappings: MappedProtocolSection[],
  suspiciousMappings?: SuspiciousMappingRecord[],
): Promise<void> {
  state.structuralMappings = mappings;
  if (suspiciousMappings) {
    state.suspiciousMappings = suspiciousMappings;
  }
  persistMetadata();
  notify();
}

/** Persists import diagnostics snapshot captured after structural mapping + generation scheduling. */
export async function stageProtocolImportDiagnostics(
  diagnostics: Record<string, SectionImportDiagnostics>,
): Promise<void> {
  state.sectionImportDiagnostics = diagnostics;
  persistMetadata();
  notify();
}

export function getSectionImportDiagnostics(sectionId: string): SectionImportDiagnostics | null {
  return state.sectionImportDiagnostics?.[sectionId] ?? null;
}

export function getAllSectionImportDiagnostics(): Record<string, SectionImportDiagnostics> {
  return state.sectionImportDiagnostics ?? {};
}

export function getStructuralMappings(): MappedProtocolSection[] {
  return state.structuralMappings ?? [];
}

/** Stages extraction + artifact immediately after DOCX parse — before protocol understanding. */
export async function stageProtocolImportExtraction(
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
): Promise<void> {
  cacheImportedSource(importedSource);
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

/** Stages core knowledge model — priority generation can begin. */
export async function stageProtocolImportCoreUnderstanding(
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
  protocolKnowledgeModel: ProtocolKnowledgeModel,
): Promise<void> {
  cacheImportedSource(importedSource);
  knowledgeCache.set(protocolKnowledgeModel.id, protocolKnowledgeModel);
  await saveImportedProtocolSource(importedSource);

  state.artifact = artifact;
  state.importedSourceSummary = toSummary(importedSource);
  state.protocolKnowledgeModelId = protocolKnowledgeModel.id;
  state.protocolId = defaultProtocolId();
  state.importContextPhase = 'core-ready';
  persistMetadata();
  notify();
}

/** Merges deep enrichment into the active knowledge model without blocking generation. */
export function mergeProtocolKnowledgeEnrichment(protocolKnowledgeModel: ProtocolKnowledgeModel): void {
  knowledgeCache.set(protocolKnowledgeModel.id, protocolKnowledgeModel);
  state.protocolKnowledgeModelId = protocolKnowledgeModel.id;
  if (state.importContextPhase === 'core-ready' || state.importContextPhase === 'understanding') {
    state.importContextPhase = 'enriching';
  }
  persistMetadata();
  notify();
}

/** Stages artifact, extraction summary, and knowledge model while M11 reconstruction is still running. */
export async function stageProtocolImportUnderstanding(
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
  protocolKnowledgeModel: ProtocolKnowledgeModel,
): Promise<void> {
  cacheImportedSource(importedSource);
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
  const normalized = normalizeSectionDraft(draft);
  state.sectionDrafts[draft.sectionId] = normalized;
  updateSectionGenerationState(draft.sectionId, resolveWorkflowGenerationState(normalized));
  persistMetadata();
  notify();
  queueKnowledgeAgentFromDraft(
    draft,
    draft.contentOrigin === 'generated' ? 'regeneration' : 'import',
  );
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



  cacheImportedSource(importedSource);

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
  clearBlankProjectMode();

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



export function upsertSectionImportDraft(
  sectionId: string,
  draft: GeneratedSectionDraft,
): void {
  state.sectionDrafts[sectionId] = draft;
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

  if (patch.generatedText !== undefined && patch.generatedText !== current.generatedText) {
    queueKnowledgeAgentEdit(next, current.generatedText);
  }

}



export function runTitlePageValidation(actor = 'Current user'): void {
  const fields = selectFieldDefinitions(getProtocolDocument());
  const output = buildTitlePageValidationOutput(fields);

  if (output.validationSummary.status === 'failed') {
    return;
  }

  let draft = state.sectionDrafts[TITLE_PAGE_SECTION_ID];
  if (!draft) {
    draft = ensureTitlePageAuthoringDraft(fields);
    state.sectionDrafts[TITLE_PAGE_SECTION_ID] = draft;
    updateSectionGenerationState(TITLE_PAGE_SECTION_ID, 'importedUnvalidated');
  }

  if (draft.workflowState === 'validationRunning' || draft.workflowState === 'validationProposed') {
    return;
  }

  const now = new Date().toISOString();
  state.sectionDrafts[TITLE_PAGE_SECTION_ID] = {
    ...draft,
    generatedText: output.validatedText,
    sourceText: draft.sourceText ?? output.originalText,
    workflowState: 'validationRunning',
    state: 'validationPending',
    stateChangedAt: now,
    stateChangedBy: actor,
    stateHistory: [
      ...draft.stateHistory,
      { state: 'validationPending', changedAt: now, changedBy: actor, note: 'Title Page validation running' },
    ],
  };
  updateSectionGenerationState(TITLE_PAGE_SECTION_ID, 'validationRunning');
  persistMetadata();
  notify();

  if (output.changes.length === 0) {
    applyValidationNoChangesRequired(TITLE_PAGE_SECTION_ID, output, actor);
    return;
  }

  applyValidationAgentProposal(TITLE_PAGE_SECTION_ID, output, actor);
}

export function runSectionValidation(sectionId: string, actor = 'Current user'): void {
  if (sectionId === TITLE_PAGE_SECTION_ID) {
    runTitlePageValidation(actor);
    return;
  }

  const draft = state.sectionDrafts[sectionId];
  if (!draft) {
    return;
  }
  if (draft.workflowState === 'validationRunning' || draft.workflowState === 'validationProposed') {
    return;
  }

  const now = new Date().toISOString();
  state.sectionDrafts[sectionId] = {
    ...draft,
    workflowState: 'validationRunning',
    state: 'validationPending',
    stateChangedAt: now,
    stateChangedBy: actor,
    stateHistory: [
      ...draft.stateHistory,
      { state: 'validationPending', changedAt: now, changedBy: actor, note: 'Validation Agent running' },
    ],
  };
  updateSectionGenerationState(sectionId, 'validationRunning');
  persistMetadata();
  notify();

  void import('../../../agents/validationAgentRunner').then(({ runValidationAgentForSection }) =>
    runValidationAgentForSection(sectionId, actor),
  );
}

export function applyValidationAgentProposal(
  sectionId: string,
  output: ValidationAgentOutput,
  actor = 'Current user',
  options?: {
    provider?: import('./types').SectionGenerationProvider | 'local-deterministic';
    model?: string;
  },
): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft) {
    return;
  }

  const now = new Date().toISOString();
  const provider = options?.provider ?? 'local-deterministic';
  const historyEntry = {
    attemptedAt: now,
    validatedTargetText: output.validatedText,
    changeCount: output.changes.length,
    outcome: 'proposed' as const,
    provider,
  };

  state.sectionDrafts[sectionId] = {
    ...draft,
    validatedTargetText: output.validatedText,
    validationMessages: output.findings.map((finding) => finding.message),
    validationFindings: output.findings,
    validationChanges: output.changes,
    validationStatus: output.validationSummary.status === 'failed' ? 'failed' : 'warnings',
    validationProvider: provider,
    validationModel: options?.model,
    lastValidatedAt: now,
    llmValidationInProgress: false,
    workflowState: 'validationProposed',
    state: 'validationPending',
    stateChangedAt: now,
    stateChangedBy: provider === 'local-deterministic' ? 'Validation Agent' : 'LLM Validation',
    validationHistory: [...(draft.validationHistory ?? []), historyEntry],
    stateHistory: [
      ...draft.stateHistory,
      {
        state: 'validationPending',
        changedAt: now,
        changedBy: provider === 'local-deterministic' ? 'Validation Agent' : 'LLM Validation',
        note: `Validation proposed (${output.validationSummary.changeCount} changes)`,
      },
    ],
  };
  updateSectionGenerationState(sectionId, 'validationProposed');
  persistMetadata();
  notify();
}

function captureValidationProposalSnapshot(draft: GeneratedSectionDraft): import('./types').ValidationProposalSnapshot {
  return {
    validatedTargetText: draft.validatedTargetText,
    validationChanges: draft.validationChanges,
    validationFindings: draft.validationFindings,
    validationMessages: draft.validationMessages,
    validationProvider: draft.validationProvider ?? 'local-deterministic',
    validationModel: draft.validationModel,
    lastValidatedAt: draft.lastValidatedAt,
  };
}

export function revertToDeterministicValidationProposal(sectionId: string, actor = 'Current user'): void {
  const draft = state.sectionDrafts[sectionId];
  const backup = draft?.deterministicValidationBackup;
  if (!draft || !backup) {
    return;
  }

  const now = new Date().toISOString();
  state.sectionDrafts[sectionId] = {
    ...draft,
    validatedTargetText: backup.validatedTargetText,
    validationChanges: backup.validationChanges,
    validationFindings: backup.validationFindings ?? [],
    validationMessages: backup.validationMessages ?? [],
    validationProvider: backup.validationProvider ?? 'local-deterministic',
    validationModel: backup.validationModel,
    lastValidatedAt: backup.lastValidatedAt,
    llmValidationInProgress: false,
    workflowState: 'validationProposed',
    state: 'validationPending',
    stateChangedAt: now,
    stateChangedBy: actor,
    stateHistory: [
      ...draft.stateHistory,
      { state: 'validationPending', changedAt: now, changedBy: actor, note: 'Reverted to deterministic validation proposal' },
    ],
  };
  updateSectionGenerationState(sectionId, 'validationProposed');
  persistMetadata();
  notify();
}

export function runLlmSectionValidation(sectionId: string, actor = 'Current user'): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft || draft.llmValidationInProgress) {
    return;
  }

  const now = new Date().toISOString();
  const backup =
    draft.deterministicValidationBackup ??
    (draft.workflowState === 'validationProposed' ? captureValidationProposalSnapshot(draft) : null);

  state.sectionDrafts[sectionId] = {
    ...draft,
    deterministicValidationBackup: backup ?? draft.deterministicValidationBackup,
    llmValidationInProgress: true,
    stateChangedAt: now,
    stateChangedBy: actor,
  };
  notify();

  void import('../../../agents/validationAgentRunner')
    .then(({ runLlmValidationAgentForSection }) => runLlmValidationAgentForSection(sectionId, actor))
    .catch((error) => {
      console.error('LLM validation failed to start', error);
      const current = state.sectionDrafts[sectionId];
      if (current) {
        state.sectionDrafts[sectionId] = { ...current, llmValidationInProgress: false };
        notify();
      }
    });
}

export function clearLlmValidationInProgress(sectionId: string): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft?.llmValidationInProgress) {
    return;
  }
  state.sectionDrafts[sectionId] = { ...draft, llmValidationInProgress: false };
  notify();
}

export function applyValidationNoChangesRequired(
  sectionId: string,
  output: ValidationAgentOutput,
  actor = 'Current user',
): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft) {
    return;
  }

  const now = new Date().toISOString();
  const originalText = draft.sourceText ?? draft.generatedText;
  state.sectionDrafts[sectionId] = {
    ...draft,
    validatedTargetText: undefined,
    validationChanges: [],
    validationMessages: output.findings.map((finding) => finding.message),
    validationFindings: output.findings,
    validationStatus:
      output.validationSummary.status === 'failed'
        ? 'failed'
        : output.findings.some((finding) => finding.severity === 'warning')
          ? 'warnings'
          : 'passed',
    workflowState: 'validated',
    state: 'validationPassed',
    stateChangedAt: now,
    stateChangedBy: 'Validation Agent',
    validationProvider: 'local-deterministic',
    lastValidatedAt: now,
    llmValidationInProgress: false,
    generatedText: originalText,
    validationHistory: [
      ...(draft.validationHistory ?? []),
      {
        attemptedAt: now,
        validatedTargetText: output.validatedText,
        changeCount: 0,
        outcome: 'no_changes_required',
        provider: 'local-deterministic',
      },
    ],
    stateHistory: [
      ...draft.stateHistory,
      {
        state: 'validationPassed',
        changedAt: now,
        changedBy: 'Validation Agent',
        note: 'Validation complete — no changes required',
      },
    ],
  };
  updateSectionGenerationState(sectionId, 'validated');
  persistMetadata();
  notify();
}

export function applyValidationAgentFailure(
  sectionId: string,
  output: ValidationAgentOutput,
  actor = 'Current user',
): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft) {
    return;
  }

  const now = new Date().toISOString();
  const originalText = draft.sourceText ?? draft.generatedText;
  state.sectionDrafts[sectionId] = {
    ...draft,
    validatedTargetText: undefined,
    validationChanges: undefined,
    validationMessages: output.findings.map((finding) => finding.message),
    validationFindings: output.findings,
    validationStatus: 'failed',
    workflowState: draft.contentOrigin === 'imported' ? 'importedUnvalidated' : inferWorkflowStateFromDraft(draft),
    state: 'validationFailed',
    stateChangedAt: now,
    stateChangedBy: actor,
    generatedText: originalText,
    validationHistory: [
      ...(draft.validationHistory ?? []),
      {
        attemptedAt: now,
        validatedTargetText: output.validatedText,
        changeCount: output.changes.length,
        outcome: 'failed',
        reason: output.findings[0]?.message,
      },
    ],
    stateHistory: [
      ...draft.stateHistory,
      { state: 'validationFailed', changedAt: now, changedBy: actor, note: 'Validation Agent failed' },
    ],
  };
  updateSectionGenerationState(
    sectionId,
    draft.contentOrigin === 'imported' ? 'importedUnvalidated' : 'failed',
  );
  persistMetadata();
  notify();
}

function inferWorkflowStateFromDraft(draft: GeneratedSectionDraft): GeneratedSectionDraft['workflowState'] {
  if (draft.contentOrigin === 'generated') {
    return 'generated';
  }
  return 'importedUnvalidated';
}

export function acceptSectionValidation(sectionId: string, reviewer = 'Current user'): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft?.validatedTargetText) {
    return;
  }

  const now = new Date().toISOString();
  const finalized: GeneratedSectionDraft = {
    ...draft,
    generatedText: draft.validatedTargetText,
    workflowState: 'validated',
    state: 'validationPassed',
    validationStatus: 'passed',
    lastValidatedAt: now,
    reviewer,
    validationHistory: [
      ...(draft.validationHistory ?? []),
      {
        attemptedAt: now,
        validatedTargetText: draft.validatedTargetText,
        changeCount: draft.validationChanges?.length ?? 0,
        outcome: 'accepted',
      },
    ],
    stateChangedAt: now,
    stateChangedBy: reviewer,
    stateHistory: [
      ...draft.stateHistory,
      { state: 'validationPassed', changedAt: now, changedBy: reviewer, note: 'Validation accepted' },
    ],
  };

  state.sectionDrafts[sectionId] = finalized;
  commitApprovedSectionToProtocol(finalized);
  createSectionApprovalCommit(
    state.protocolId,
    finalized,
    finalized.validationMessages.join(' ') || 'Section validated against M11 guidance.',
  );
  updateSectionGenerationState(sectionId, 'validated');
  void import('../../../agents/validationAgentRunner').then(({ emitValidationAccepted }) => {
    emitValidationAccepted(sectionId, finalized.title);
  });
  queueKnowledgeAgentFromDraft(finalized, 'sectionValidation', draft.generatedText);
  refreshStudyModelFromContext();
  persistMetadata();
  notify();
}

export function rejectSectionValidation(sectionId: string, reviewer = 'Current user'): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft) {
    return;
  }

  const now = new Date().toISOString();
  const preservedText = draft.sourceText ?? draft.generatedText;
  state.sectionDrafts[sectionId] = {
    ...draft,
    validatedTargetText: undefined,
    validationChanges: undefined,
    generatedText: preservedText,
    workflowState: 'importedUnvalidated',
    state: 'pendingReview',
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
    stateChangedAt: now,
    stateChangedBy: reviewer,
    validationHistory: [
      ...(draft.validationHistory ?? []),
      {
        attemptedAt: now,
        validatedTargetText: draft.validatedTargetText ?? '',
        changeCount: draft.validationChanges?.length ?? 0,
        outcome: 'rejected',
      },
    ],
    stateHistory: [
      ...draft.stateHistory,
      { state: 'pendingReview', changedAt: now, changedBy: reviewer, note: 'Validation rejected — restored imported text' },
    ],
  };
  updateSectionGenerationState(sectionId, 'importedUnvalidated');
  void import('../../../agents/validationAgentRunner').then(({ emitValidationRejected }) => {
    emitValidationRejected(sectionId, draft.title);
  });
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
    queueKnowledgeAgentFromDraft(finalized, 'sectionReviewed', draft.generatedText);
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
  queueKnowledgeAgentFromDraft(newDraft, 'regeneration', current?.generatedText);
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
  if (!isPriorityGenerationContextReady()) {
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
  if (!isPriorityGenerationContextReady()) {
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



export function getSectionImportDrafts(): Record<string, GeneratedSectionDraft> {
  return state.sectionDrafts;
}

function slugImpactToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function buildConsistencyImpactId(
  sourceSectionId: string,
  collection: string,
  changedItemName: string,
  targetSectionId: string,
): string {
  return `${sourceSectionId}:${collection}:${slugImpactToken(changedItemName)}:${targetSectionId}`;
}

export function applyConsistencyAgentResults(
  sourceSectionId: string,
  impacts: Array<{
    sectionId: string;
    reasons: Array<{
      sourceSectionId: string;
      sourceSectionTitle?: string;
      changedItemName: string;
      changedItemCollection: string;
      relationship: string;
      reason: string;
      suggestedAction: 'validate' | 'regenerate' | 'edit';
    }>;
  }>,
): string[] {
  const marked: string[] = [];
  const now = new Date().toISOString();

  for (const impact of impacts) {
    if (impact.sectionId === sourceSectionId) {
      continue;
    }

    const draft = state.sectionDrafts[impact.sectionId];
    if (!draft) {
      continue;
    }
    if (draft.generationStatus === 'failed') {
      continue;
    }
    const liveState = getProtocolBuildConsoleState().sectionStates[impact.sectionId];
    if (liveState === 'generating' || liveState === 'queued') {
      continue;
    }
    if (draft.workflowState === 'importedUnvalidated' || draft.workflowState === 'needsGeneration') {
      continue;
    }

    const impactMap = new Map((draft.consistencyImpacts ?? []).map((entry) => [entry.impactId, entry]));
    for (const reason of impact.reasons) {
      const impactId = buildConsistencyImpactId(
        reason.sourceSectionId,
        reason.changedItemCollection,
        reason.changedItemName,
        impact.sectionId,
      );
      impactMap.set(impactId, {
        impactId,
        sourceSectionId: reason.sourceSectionId,
        sourceSectionTitle: reason.sourceSectionTitle,
        changedItemName: reason.changedItemName,
        changedItemCollection: reason.changedItemCollection,
        relationship: reason.relationship,
        reason: reason.reason,
        suggestedAction: reason.suggestedAction,
        detectedAt: now,
      });
    }

    const priorWorkflowState =
      draft.workflowState === 'outOfSync'
        ? draft.priorWorkflowState
        : draft.workflowState ?? inferWorkflowState(draft);

    state.sectionDrafts[impact.sectionId] = {
      ...draft,
      priorWorkflowState,
      workflowState: 'outOfSync',
      consistencyImpacts: [...impactMap.values()],
    };
    updateSectionGenerationState(impact.sectionId, 'outOfSync');
    marked.push(impact.sectionId);
  }

  if (marked.length > 0) {
    persistMetadata();
    notify();
  }

  return marked;
}

export function clearSectionOutOfSyncState(sectionId: string): void {
  const draft = state.sectionDrafts[sectionId];
  if (!draft || draft.workflowState !== 'outOfSync') {
    return;
  }

  const restoredWorkflow = draft.priorWorkflowState ?? 'generated';
  const nextDraft: GeneratedSectionDraft = {
    ...draft,
    workflowState: restoredWorkflow,
    priorWorkflowState: undefined,
    consistencyImpacts: undefined,
  };
  state.sectionDrafts[sectionId] = nextDraft;
  updateSectionGenerationState(sectionId, resolveWorkflowGenerationState(nextDraft));
  persistMetadata();
  notify();
}

export { ICH_M11_TERMINOLOGY_META };



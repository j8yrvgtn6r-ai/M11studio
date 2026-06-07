import type { M11GenerationProgressSnapshot } from '../import/llm/m11GenerationProgress';
import { resolveWorkflowGenerationState } from '../import/sectionWorkflowState';
import type { GeneratedSectionDraft } from '../import/types';

export type ProtocolBuildEventType = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface ProtocolBuildEvent {
  id: string;
  timestamp: string;
  type: ProtocolBuildEventType;
  message: string;
  sectionId?: string;
  sectionTitle?: string;
  provider?: string;
  model?: string;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

export type SectionGenerationState =
  | 'notGenerated'
  | 'queued'
  | 'backgroundQueued'
  | 'generating'
  | 'generated'
  | 'needsReview'
  | 'approved'
  | 'failed'
  | 'outOfDate'
  | 'imported'
  | 'importedUnvalidated'
  | 'validationRunning'
  | 'validationProposed'
  | 'unvalidated'
  | 'validated'
  | 'reviewed'
  | 'outOfSync'
  | 'needsGeneration';

export interface GenerationScheduleSnapshot {
  queueType: string;
  queuedCount: number;
  skippedCount: number;
  priorityCount: number;
  backgroundCount: number;
  trigger: string;
}

export type ProtocolBuildStatus = 'idle' | 'running' | 'paused' | 'complete' | 'failed' | 'cancelled';

export type ProtocolBuildMode = 'Full' | 'Quick' | 'Selected';

export type ImportVisualizationPhase = 'idle' | 'reset' | 'generating' | 'complete';

export interface ProtocolBuildSessionControls {
  cancel?: () => void;
  pauseAfterCurrent?: () => void;
  resume?: () => void;
  retryFailed?: () => void;
  generateRemaining?: () => void;
}

export type StudyModelEnrichmentStatus = 'idle' | 'core-complete' | 'running' | 'complete' | 'partial';

export interface StudyModelEnrichmentTrack {
  status: StudyModelEnrichmentStatus;
  completedSlices: number;
  totalSlices: number;
  currentLabel?: string;
}

export interface ProtocolBuildConsoleState {
  status: ProtocolBuildStatus;
  events: ProtocolBuildEvent[];
  generationProgress: M11GenerationProgressSnapshot | null;
  studyModelEnrichment: StudyModelEnrichmentTrack;
  sectionStates: Record<string, SectionGenerationState>;
  visualizationPhase: ImportVisualizationPhase;
  mode: ProtocolBuildMode;
  failedSectionIds: string[];
  sectionSkipReasons: Record<string, string>;
  generationSchedule: GenerationScheduleSnapshot | null;
  controls: ProtocolBuildSessionControls;
  completionSummary: {
    sectionsGenerated: number;
    sectionsFailed: number;
    sectionsNeedingReview: number;
    totalDurationMs: number;
    provider?: string;
    model?: string;
  } | null;
}

const MAX_EVENTS = 1500;

/** Import milestones kept visible even when the rolling event buffer truncates during generation. */
const PINNED_BUILD_MILESTONES = [
  'Building Canonical Document',
  'Classifying document blocks',
  'Constructing canonical sections',
  'Canonical document complete',
  'Building Core Study Model',
  'Core Study Model complete',
  'sections mapped',
  'Mapping content into M11 hierarchy',
  'First draft available',
  'Deep Study Model enrichment started',
  'Priority generation complete',
  'Hybrid import workspace ready',
] as const;

let eventCounter = 0;
let pinnedBuildEvents: ProtocolBuildEvent[] = [];
let pauseRequested = false;
let resumePromise: Promise<void> | null = null;
let resumeResolve: (() => void) | null = null;
let prioritySectionQueue: string[] = [];
let injectedSectionQueue: string[] = [];

const listeners = new Set<() => void>();

let state: ProtocolBuildConsoleState = {
  status: 'idle',
  events: [],
  generationProgress: null,
  studyModelEnrichment: { status: 'idle', completedSlices: 0, totalSlices: 7 },
  sectionStates: {},
  visualizationPhase: 'idle',
  mode: 'Full',
  failedSectionIds: [],
  sectionSkipReasons: {},
  generationSchedule: null,
  controls: {},
  completionSummary: null,
};

function notify(): void {
  listeners.forEach((listener) => listener());
}

function nextEventId(): string {
  eventCounter += 1;
  return `build-event-${eventCounter}`;
}

function isPinnedBuildMilestone(message: string): boolean {
  return PINNED_BUILD_MILESTONES.some((milestone) => message.includes(milestone));
}

function mergePinnedBuildEvents(recent: ProtocolBuildEvent[]): ProtocolBuildEvent[] {
  const recentIds = new Set(recent.map((event) => event.id));
  const pinned = pinnedBuildEvents.filter((event) => !recentIds.has(event.id));
  return [...pinned, ...recent];
}

function rememberPinnedBuildEvent(entry: ProtocolBuildEvent): void {
  if (!isPinnedBuildMilestone(entry.message)) {
    return;
  }
  pinnedBuildEvents = [
    ...pinnedBuildEvents.filter((event) => event.message !== entry.message),
    entry,
  ];
}

function clearPinnedBuildEvents(): void {
  pinnedBuildEvents = [];
}

export function subscribeProtocolBuildConsole(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProtocolBuildConsoleState(): ProtocolBuildConsoleState {
  return state;
}

export function normalizeSectionGenerationState(value: unknown): SectionGenerationState {
  const allowed: SectionGenerationState[] = [
    'notGenerated',
    'queued',
    'backgroundQueued',
    'generating',
    'generated',
    'needsReview',
    'approved',
    'failed',
    'outOfDate',
    'imported',
    'importedUnvalidated',
    'unvalidated',
    'validated',
    'reviewed',
    'outOfSync',
    'needsGeneration',
  ];
  return allowed.includes(value as SectionGenerationState) ? (value as SectionGenerationState) : 'notGenerated';
}

export function normalizeSectionGenerationStates(
  raw: Record<string, unknown> | null | undefined,
): Record<string, SectionGenerationState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const normalized: Record<string, SectionGenerationState> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = normalizeSectionGenerationState(value);
  }
  return normalized;
}

export function resolveSectionGenerationState(
  sectionId: string,
  liveStates: Record<string, SectionGenerationState>,
  importDraft: GeneratedSectionDraft | undefined,
  buildActive: boolean,
): SectionGenerationState {
  const live = liveStates[sectionId];
  const fromDraft = importDraft ? resolveWorkflowGenerationState(importDraft) : undefined;

  if (live === 'queued' || live === 'generating' || live === 'validationRunning') {
    return live;
  }

  if (buildActive) {
    if (fromDraft && fromDraft !== 'notGenerated') {
      return fromDraft;
    }
    if (live) {
      return live;
    }
    return fromDraft ?? 'notGenerated';
  }

  if (!importDraft) {
    return live ?? 'notGenerated';
  }
  if (importDraft.generationStatus === 'failed') {
    return 'failed';
  }
  if (live && (live === 'queued' || live === 'generating')) {
    return live;
  }
  return fromDraft ?? live ?? 'notGenerated';
}

export function appendProtocolBuildEvent(
  event: Omit<ProtocolBuildEvent, 'id' | 'timestamp'> & { timestamp?: string },
): ProtocolBuildEvent {
  const entry: ProtocolBuildEvent = {
    id: nextEventId(),
    timestamp: event.timestamp ?? new Date().toISOString(),
    type: event.type,
    message: event.message,
    sectionId: event.sectionId,
    sectionTitle: event.sectionTitle,
    provider: event.provider,
    model: event.model,
    durationMs: event.durationMs,
    metadata: event.metadata,
  };

  rememberPinnedBuildEvent(entry);
  state = {
    ...state,
    events: mergePinnedBuildEvents([...state.events, entry].slice(-MAX_EVENTS)),
  };
  notify();
  return entry;
}

export function clearProtocolBuildEvents(): void {
  clearPinnedBuildEvents();
  state = { ...state, events: [] };
  notify();
}

/** Resets build console workspace state without clearing provider/UI preferences elsewhere. */
export function resetImportBuildConsoleWorkspace(): void {
  clearPinnedBuildEvents();
  pauseRequested = false;
  resumePromise = null;
  resumeResolve = null;
  prioritySectionQueue = [];
  injectedSectionQueue = [];
  state = {
    ...state,
    status: 'idle',
    events: [],
    generationProgress: null,
    studyModelEnrichment: { status: 'idle', completedSlices: 0, totalSlices: 7 },
    sectionStates: {},
    visualizationPhase: 'idle',
    failedSectionIds: [],
    sectionSkipReasons: {},
    generationSchedule: null,
    completionSummary: null,
  };
  notify();
}

export function startProtocolBuildSession(options?: {
  mode?: ProtocolBuildMode;
  filename?: string;
}): void {
  pauseRequested = false;
  resumePromise = null;
  resumeResolve = null;
  prioritySectionQueue = [];
  injectedSectionQueue = [];
  clearPinnedBuildEvents();
  state = {
    status: 'running',
    events: [],
    generationProgress: null,
    studyModelEnrichment: { status: 'idle', completedSlices: 0, totalSlices: 7 },
    sectionStates: {},
    visualizationPhase: 'idle',
    mode: options?.mode ?? 'Full',
    failedSectionIds: [],
    controls: state.controls,
    completionSummary: null,
  };
  notify();

  if (options?.filename) {
    appendProtocolBuildEvent({
      type: 'info',
      message: `DOCX uploaded: ${options.filename}`,
    });
  }
}

export function registerProtocolBuildControls(controls: ProtocolBuildSessionControls): void {
  state = { ...state, controls };
  notify();
}

export function endProtocolBuildSession(status: ProtocolBuildStatus = 'idle'): void {
  pauseRequested = false;
  resumePromise = null;
  resumeResolve = null;
  if (status === 'idle' || status === 'complete' || status === 'cancelled' || status === 'failed') {
    prioritySectionQueue = [];
    injectedSectionQueue = [];
  }
  state = {
    ...state,
    status,
    visualizationPhase: status === 'idle' ? 'idle' : state.visualizationPhase,
    controls: status === 'idle' ? {} : state.controls,
  };
  notify();
}

export function setProtocolBuildGenerationProgress(progress: M11GenerationProgressSnapshot | null): void {
  state = { ...state, generationProgress: progress };
  notify();
}

export function setStudyModelEnrichmentTrack(track: Partial<StudyModelEnrichmentTrack>): void {
  state = {
    ...state,
    studyModelEnrichment: { ...state.studyModelEnrichment, ...track },
  };
  notify();
}

export function markStudyModelCoreComplete(): void {
  setStudyModelEnrichmentTrack({ status: 'core-complete', completedSlices: 0, currentLabel: 'Core complete' });
}

export function markStudyModelEnrichmentStarted(totalSlices: number): void {
  setStudyModelEnrichmentTrack({
    status: 'running',
    totalSlices,
    completedSlices: 0,
    currentLabel: 'Deep enrichment started',
  });
}

export function updateStudyModelEnrichmentProgress(completedSlices: number, currentLabel: string): void {
  setStudyModelEnrichmentTrack({
    status: 'running',
    completedSlices,
    currentLabel,
  });
}

export function markStudyModelEnrichmentFinished(partial: boolean): void {
  setStudyModelEnrichmentTrack({
    status: partial ? 'partial' : 'complete',
    currentLabel: partial ? 'Enrichment partial' : 'Enrichment complete',
  });
}

export function resetQuickReconstructionVisualization(options: {
  protocolSectionIds: string[];
  allM11SectionIds: string[];
  prioritySectionIds: string[];
}): void {
  const prioritySet = new Set(options.prioritySectionIds);
  const sectionStates: Record<string, SectionGenerationState> = {};
  for (const sectionId of new Set([...options.protocolSectionIds, ...options.allM11SectionIds])) {
    sectionStates[sectionId] = prioritySet.has(sectionId) ? 'queued' : 'notGenerated';
  }

  state = {
    ...state,
    status: 'running',
    visualizationPhase: 'reset',
    mode: 'Quick',
    sectionStates,
    generationProgress: {
      totalSections: options.prioritySectionIds.length,
      completedSections: 0,
      failedSections: 0,
      elapsedMs: 0,
    },
    failedSectionIds: [],
    completionSummary: null,
  };

  appendProtocolBuildEvent({ type: 'info', message: 'Resetting protocol state...' });
  appendProtocolBuildEvent({ type: 'info', message: 'Clearing review package...' });
  appendProtocolBuildEvent({ type: 'info', message: 'Clearing validation results...' });
  appendProtocolBuildEvent({ type: 'info', message: 'Clearing MAP indicators...' });
  appendProtocolBuildEvent({ type: 'info', message: 'Quick Reconstruction initialized' });
  appendProtocolBuildEvent({
    type: 'progress',
    message: `${options.prioritySectionIds.length} priority sections selected`,
    metadata: { prioritySections: options.prioritySectionIds.length },
  });
  appendProtocolBuildEvent({
    type: 'progress',
    message: `${options.allM11SectionIds.length - options.prioritySectionIds.length} sections marked notGenerated`,
    metadata: {
      notGeneratedSections: options.allM11SectionIds.length - options.prioritySectionIds.length,
    },
  });
  notify();
}

export function resetProtocolImportVisualization(options: {
  protocolSectionIds: string[];
  m11TargetSectionIds: string[];
}): void {
  const sectionStates: Record<string, SectionGenerationState> = {};
  for (const sectionId of new Set([...options.protocolSectionIds, ...options.m11TargetSectionIds])) {
    sectionStates[sectionId] = 'queued';
  }

  state = {
    ...state,
    status: 'running',
    visualizationPhase: 'reset',
    sectionStates,
    generationProgress: null,
    failedSectionIds: [],
    completionSummary: null,
  };

  appendProtocolBuildEvent({ type: 'info', message: 'Resetting protocol state...' });
  appendProtocolBuildEvent({ type: 'info', message: 'Clearing review package...' });
  appendProtocolBuildEvent({ type: 'info', message: 'Clearing validation results...' });
  appendProtocolBuildEvent({ type: 'info', message: 'Clearing MAP indicators...' });
  appendProtocolBuildEvent({ type: 'info', message: 'Initializing protocol reconstruction...' });
  appendProtocolBuildEvent({
    type: 'progress',
    message: `${options.m11TargetSectionIds.length} M11 sections queued.`,
    metadata: { queuedSections: options.m11TargetSectionIds.length },
  });
  notify();
}

export function markProtocolImportGenerationPhase(): void {
  state = { ...state, visualizationPhase: 'generating' };
  notify();
}

export function getImportVisualizationPhase(): ImportVisualizationPhase {
  return state.visualizationPhase;
}

export function initializeSectionGenerationQueue(sectionIds: string[]): void {
  const sectionStates: Record<string, SectionGenerationState> = {};
  for (const sectionId of sectionIds) {
    sectionStates[sectionId] = 'queued';
  }
  state = { ...state, sectionStates, visualizationPhase: 'generating' };
  notify();
}

/** Bumps a section to the front of the active generation loop. */
export function prependSectionGenerationPriority(sectionId: string): void {
  prioritySectionQueue = [sectionId, ...prioritySectionQueue.filter((id) => id !== sectionId)];
}

export function pullPrioritySectionGenerationId(): string | undefined {
  return prioritySectionQueue.shift();
}

/** Adds a section into the active generation loop even if it was not in the original batch. */
export function injectSectionIntoGenerationQueue(sectionId: string): void {
  injectedSectionQueue = [sectionId, ...injectedSectionQueue.filter((id) => id !== sectionId)];
}

export function pullInjectedSectionGenerationId(): string | undefined {
  return injectedSectionQueue.shift();
}

export function hasPendingInjectedSections(): boolean {
  return injectedSectionQueue.length > 0 || prioritySectionQueue.length > 0;
}

const PROTECTED_SECTION_STATES: SectionGenerationState[] = [
  'needsReview',
  'approved',
  'generating',
  'imported',
  'importedUnvalidated',
  'validationRunning',
  'validationProposed',
  'unvalidated',
  'validated',
  'reviewed',
  'backgroundQueued',
];

export function markSectionsQueued(sectionIds: string[]): void {
  const next = { ...state.sectionStates };
  for (const sectionId of sectionIds) {
    const current = next[sectionId];
    if (!current || !PROTECTED_SECTION_STATES.includes(current)) {
      next[sectionId] = 'queued';
    }
  }
  state = { ...state, sectionStates: next, visualizationPhase: 'generating' };
  notify();
}

export function updateSectionGenerationState(sectionId: string, generationState: SectionGenerationState): void {
  state = {
    ...state,
    sectionStates: {
      ...state.sectionStates,
      [sectionId]: generationState,
    },
  };
  notify();
}

export function mergeSectionGenerationStatesFromDrafts(
  drafts: GeneratedSectionDraft[],
  options?: { allM11SectionIds?: string[]; prioritySectionIds?: string[] },
): void {
  const next = { ...state.sectionStates };
  for (const draft of drafts) {
    if (draft.generationStatus === 'failed') {
      next[draft.sectionId] = 'failed';
      continue;
    }
    next[draft.sectionId] = resolveWorkflowGenerationState(draft);
  }

  if (options?.allM11SectionIds) {
    const draftIds = new Set(drafts.map((draft) => draft.sectionId));
    for (const sectionId of options.allM11SectionIds) {
      if (!draftIds.has(sectionId) && next[sectionId] !== 'failed') {
        next[sectionId] = 'needsGeneration';
      }
    }
  }

  state = { ...state, sectionStates: next, visualizationPhase: 'complete' };
  notify();
}

export function markSectionsNotGenerated(sectionIds: string[]): void {
  const next = { ...state.sectionStates };
  const skipReasons = { ...state.sectionSkipReasons };
  for (const sectionId of sectionIds) {
    if (next[sectionId] !== 'generating' && next[sectionId] !== 'needsReview' && next[sectionId] !== 'approved' && next[sectionId] !== 'imported' && next[sectionId] !== 'importedUnvalidated' && next[sectionId] !== 'validated') {
      next[sectionId] = 'needsGeneration';
    }
    if (!skipReasons[sectionId]) {
      skipReasons[sectionId] = 'Not generated because source/context is insufficient.';
    }
  }
  state = { ...state, sectionStates: next, sectionSkipReasons: skipReasons };
  notify();
}

export function markSectionsBackgroundQueued(sectionIds: string[]): void {
  const next = { ...state.sectionStates };
  for (const sectionId of sectionIds) {
    const current = next[sectionId];
    if (!current || !PROTECTED_SECTION_STATES.includes(current)) {
      next[sectionId] = 'backgroundQueued';
    }
  }
  state = { ...state, sectionStates: next };
  notify();
}

export function setSectionSkipReasons(reasons: Record<string, string>): void {
  state = {
    ...state,
    sectionSkipReasons: {
      ...state.sectionSkipReasons,
      ...reasons,
    },
  };
  notify();
}

export function getSectionSkipReason(sectionId: string | undefined): string | undefined {
  if (!sectionId) {
    return undefined;
  }
  return state.sectionSkipReasons[sectionId];
}

export function setGenerationScheduleSnapshot(snapshot: GenerationScheduleSnapshot): void {
  state = { ...state, generationSchedule: snapshot };
  notify();
}

export function getGenerationScheduleSnapshot(): GenerationScheduleSnapshot | null {
  return state.generationSchedule;
}

export function setProtocolBuildFailedSectionIds(sectionIds: string[]): void {
  state = { ...state, failedSectionIds: sectionIds };
  notify();
}

export function completeProtocolBuildSession(summary: {
  sectionsGenerated: number;
  sectionsFailed: number;
  sectionsNeedingReview: number;
  totalDurationMs: number;
  provider?: string;
  model?: string;
  failedSectionIds?: string[];
}): void {
  state = {
    ...state,
    status: 'complete',
    visualizationPhase: 'complete',
    completionSummary: {
      sectionsGenerated: summary.sectionsGenerated,
      sectionsFailed: summary.sectionsFailed,
      sectionsNeedingReview: summary.sectionsNeedingReview,
      totalDurationMs: summary.totalDurationMs,
      provider: summary.provider,
      model: summary.model,
    },
    failedSectionIds: summary.failedSectionIds ?? state.failedSectionIds,
    generationProgress: state.generationProgress
      ? { ...state.generationProgress, isComplete: true, isPaused: false }
      : null,
  };
  notify();
}

export function requestPauseAfterCurrentSection(): void {
  if (state.status !== 'running') {
    return;
  }
  pauseRequested = true;
  appendProtocolBuildEvent({
    type: 'info',
    message: 'Pause requested — will stop after the current section completes.',
  });
  notify();
}

export function isProtocolBuildPauseRequested(): boolean {
  return pauseRequested;
}

export function markProtocolBuildPaused(): void {
  if (state.status !== 'running') {
    return;
  }
  pauseRequested = false;
  state = {
    ...state,
    status: 'paused',
    generationProgress: state.generationProgress
      ? { ...state.generationProgress, isPaused: true }
      : null,
  };
  if (!resumePromise) {
    resumePromise = new Promise((resolve) => {
      resumeResolve = resolve;
    });
  }
  notify();
}

export function resumeProtocolBuild(): void {
  if (state.status !== 'paused') {
    return;
  }
  state = {
    ...state,
    status: 'running',
    generationProgress: state.generationProgress
      ? { ...state.generationProgress, isPaused: false }
      : null,
  };
  resumeResolve?.();
  resumeResolve = null;
  resumePromise = null;
  appendProtocolBuildEvent({ type: 'info', message: 'Import resumed.' });
  notify();
}

export async function waitForProtocolBuildResume(): Promise<void> {
  if (resumePromise) {
    await resumePromise;
  }
}

export function cancelProtocolBuildSession(): void {
  appendProtocolBuildEvent({ type: 'warning', message: 'Import cancelled.' });
  endProtocolBuildSession('cancelled');
}

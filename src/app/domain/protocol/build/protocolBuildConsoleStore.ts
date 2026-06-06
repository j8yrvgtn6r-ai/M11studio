import type { M11GenerationProgressSnapshot } from '../import/llm/m11GenerationProgress';
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
  | 'generating'
  | 'generated'
  | 'needsReview'
  | 'approved'
  | 'failed'
  | 'outOfDate';

export type ProtocolBuildStatus = 'idle' | 'running' | 'paused' | 'complete' | 'failed' | 'cancelled';

export type ProtocolBuildMode = 'Full' | 'Quick' | 'Selected';

export interface ProtocolBuildSessionControls {
  cancel?: () => void;
  pauseAfterCurrent?: () => void;
  resume?: () => void;
  retryFailed?: () => void;
}

export interface ProtocolBuildConsoleState {
  status: ProtocolBuildStatus;
  events: ProtocolBuildEvent[];
  generationProgress: M11GenerationProgressSnapshot | null;
  sectionStates: Record<string, SectionGenerationState>;
  mode: ProtocolBuildMode;
  failedSectionIds: string[];
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

const MAX_EVENTS = 500;

let eventCounter = 0;
let pauseRequested = false;
let resumePromise: Promise<void> | null = null;
let resumeResolve: (() => void) | null = null;

const listeners = new Set<() => void>();

let state: ProtocolBuildConsoleState = {
  status: 'idle',
  events: [],
  generationProgress: null,
  sectionStates: {},
  mode: 'Full',
  failedSectionIds: [],
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
    'generating',
    'generated',
    'needsReview',
    'approved',
    'failed',
    'outOfDate',
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
  if (buildActive && live) {
    return live;
  }
  if (!importDraft) {
    return 'notGenerated';
  }
  if (importDraft.generationStatus === 'failed') {
    return 'failed';
  }
  if (importDraft.state === 'approved' || importDraft.state === 'validationPassed') {
    return 'approved';
  }
  if (importDraft.state === 'changesRequested') {
    return 'outOfDate';
  }
  if (importDraft.state === 'generated' || importDraft.state === 'pendingReview' || importDraft.state === 'inReview') {
    return 'needsReview';
  }
  return 'needsReview';
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

  state = {
    ...state,
    events: [...state.events, entry].slice(-MAX_EVENTS),
  };
  notify();
  return entry;
}

export function clearProtocolBuildEvents(): void {
  state = { ...state, events: [] };
  notify();
}

export function startProtocolBuildSession(options?: {
  mode?: ProtocolBuildMode;
  filename?: string;
}): void {
  pauseRequested = false;
  resumePromise = null;
  resumeResolve = null;
  state = {
    status: 'running',
    events: [],
    generationProgress: null,
    sectionStates: {},
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
  state = {
    ...state,
    status,
    controls: status === 'idle' ? {} : state.controls,
  };
  notify();
}

export function setProtocolBuildGenerationProgress(progress: M11GenerationProgressSnapshot | null): void {
  state = { ...state, generationProgress: progress };
  notify();
}

export function initializeSectionGenerationQueue(sectionIds: string[]): void {
  const sectionStates: Record<string, SectionGenerationState> = {};
  for (const sectionId of sectionIds) {
    sectionStates[sectionId] = 'queued';
  }
  state = { ...state, sectionStates };
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

export function mergeSectionGenerationStatesFromDrafts(drafts: GeneratedSectionDraft[]): void {
  const next = { ...state.sectionStates };
  for (const draft of drafts) {
    if (draft.generationStatus === 'failed') {
      next[draft.sectionId] = 'failed';
    } else if (draft.state === 'approved' || draft.state === 'validationPassed') {
      next[draft.sectionId] = 'approved';
    } else {
      next[draft.sectionId] = 'needsReview';
    }
  }
  state = { ...state, sectionStates: next };
  notify();
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

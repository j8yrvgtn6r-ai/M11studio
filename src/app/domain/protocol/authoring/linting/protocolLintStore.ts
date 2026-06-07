import type {
  ProtocolLintIssue,
  ProtocolLintSchedulerState,
  ProtocolLintSummary,
  ProtocolQuickFix,
} from './protocolLintTypes';

interface SectionLintState {
  issues: ProtocolLintIssue[];
  quickFixes: ProtocolQuickFix[];
  schedulerState: ProtocolLintSchedulerState;
  lastLintedAt: string | null;
}

const sectionState = new Map<string, SectionLintState>();
const listeners = new Set<() => void>();

function emptyState(): SectionLintState {
  return {
    issues: [],
    quickFixes: [],
    schedulerState: 'idle',
    lastLintedAt: null,
  };
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getOrCreate(sectionId: string): SectionLintState {
  const existing = sectionState.get(sectionId);
  if (existing) {
    return existing;
  }
  const created = emptyState();
  sectionState.set(sectionId, created);
  return created;
}

export function getLintIssues(sectionId?: string): ProtocolLintIssue[] {
  if (!sectionId) {
    return [...sectionState.values()].flatMap((entry) => entry.issues);
  }
  return [...(sectionState.get(sectionId)?.issues ?? [])];
}

export function getLintQuickFixes(sectionId?: string): ProtocolQuickFix[] {
  if (!sectionId) {
    return [...sectionState.values()].flatMap((entry) => entry.quickFixes);
  }
  return [...(sectionState.get(sectionId)?.quickFixes ?? [])];
}

export function setLintIssues(
  sectionId: string,
  issues: ProtocolLintIssue[],
  quickFixes: ProtocolQuickFix[] = [],
): void {
  const state = getOrCreate(sectionId);
  sectionState.set(sectionId, {
    ...state,
    issues,
    quickFixes,
    schedulerState: 'complete',
    lastLintedAt: new Date().toISOString(),
  });
  notify();
}

export function setLintSchedulerState(sectionId: string, schedulerState: ProtocolLintSchedulerState): void {
  const state = getOrCreate(sectionId);
  sectionState.set(sectionId, { ...state, schedulerState });
  notify();
}

export function clearLintIssues(sectionId?: string): void {
  if (!sectionId) {
    sectionState.clear();
    notify();
    return;
  }
  sectionState.delete(sectionId);
  notify();
}

export function getLintSummary(sectionId: string): ProtocolLintSummary {
  const state = sectionState.get(sectionId) ?? emptyState();
  return {
    sectionId,
    issueCount: state.issues.length,
    errorCount: state.issues.filter((entry) => entry.severity === 'error').length,
    warningCount: state.issues.filter((entry) => entry.severity === 'warning').length,
    infoCount: state.issues.filter((entry) => entry.severity === 'info').length,
    lastLintedAt: state.lastLintedAt,
    schedulerState: state.schedulerState,
  };
}

export function subscribeLintIssues(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLintSchedulerState(sectionId: string): ProtocolLintSchedulerState {
  return sectionState.get(sectionId)?.schedulerState ?? 'idle';
}

let quickFixHandler: ((fix: ProtocolQuickFix) => void) | null = null;

export function registerProtocolQuickFixHandler(
  handler: ((fix: ProtocolQuickFix) => void) | null,
): () => void {
  quickFixHandler = handler;
  return () => {
    if (quickFixHandler === handler) {
      quickFixHandler = null;
    }
  };
}

export function applyProtocolQuickFix(fix: ProtocolQuickFix): void {
  quickFixHandler?.(fix);
}

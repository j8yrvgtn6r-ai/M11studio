import { runProtocolLint } from './protocolLintEngine';
import {
  clearLintIssues,
  getLintSchedulerState,
  setLintIssues,
  setLintSchedulerState,
} from './protocolLintStore';

export const LINT_DEBOUNCE_MS = 650;

interface PendingLintJob {
  sectionId: string;
  sectionTitle?: string;
  content: string;
  timer: ReturnType<typeof setTimeout> | null;
  generation: number;
}

const pendingJobs = new Map<string, PendingLintJob>();
const backgroundQueue = new Set<string>();

export function scheduleSectionLint(input: {
  sectionId: string;
  sectionTitle?: string;
  content: string;
  debounceMs?: number;
}): void {
  const existing = pendingJobs.get(input.sectionId);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }

  const generation = (existing?.generation ?? 0) + 1;
  const job: PendingLintJob = {
    sectionId: input.sectionId,
    sectionTitle: input.sectionTitle,
    content: input.content,
    timer: null,
    generation,
  };

  setLintSchedulerState(input.sectionId, 'scheduled');
  job.timer = setTimeout(() => {
    void executeSectionLint(job);
  }, input.debounceMs ?? LINT_DEBOUNCE_MS);

  pendingJobs.set(input.sectionId, job);
}

export function cancelSectionLint(sectionId: string): void {
  const job = pendingJobs.get(sectionId);
  if (job?.timer) {
    clearTimeout(job.timer);
  }
  pendingJobs.delete(sectionId);
  setLintSchedulerState(sectionId, 'idle');
}

async function executeSectionLint(job: PendingLintJob): Promise<void> {
  const current = pendingJobs.get(job.sectionId);
  if (!current || current.generation !== job.generation) {
    return;
  }

  setLintSchedulerState(job.sectionId, 'running');
  try {
    const result = runProtocolLint({
      sectionId: job.sectionId,
      sectionTitle: job.sectionTitle,
      content: job.content,
    });
    const latest = pendingJobs.get(job.sectionId);
    if (!latest || latest.generation !== job.generation) {
      return;
    }
    setLintIssues(job.sectionId, result.issues, result.quickFixes);
  } catch (error) {
    console.warn('[protocol-lint] scheduler failed', error);
    setLintSchedulerState(job.sectionId, 'failed');
  } finally {
    pendingJobs.delete(job.sectionId);
  }
}

export function scheduleImpactedSectionLint(
  sections: Array<{ sectionId: string; sectionTitle?: string; content: string }>,
): void {
  for (const section of sections) {
    if (backgroundQueue.has(section.sectionId)) {
      continue;
    }
    backgroundQueue.add(section.sectionId);
    scheduleSectionLint({
      ...section,
      debounceMs: Math.max(LINT_DEBOUNCE_MS, 800),
    });
    setTimeout(() => backgroundQueue.delete(section.sectionId), LINT_DEBOUNCE_MS + 500);
  }
}

export function getScheduledLintStatus(sectionId: string): ReturnType<typeof getLintSchedulerState> {
  return getLintSchedulerState(sectionId);
}

export function resetProtocolLintScheduler(): void {
  for (const job of pendingJobs.values()) {
    if (job.timer) {
      clearTimeout(job.timer);
    }
  }
  pendingJobs.clear();
  backgroundQueue.clear();
  clearLintIssues();
}

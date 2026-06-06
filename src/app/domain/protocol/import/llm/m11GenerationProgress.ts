import { computeEstimatedRemainingMs, formatBuildDurationMs } from '../../build/formatBuildDuration';
import type { GeneratedSectionDraft } from '../types';
import type { LlmProviderConfig } from './types';

export interface M11GenerationProgressSnapshot {
  totalSections: number;
  completedSections: number;
  failedSections: number;
  queuedSections?: number;
  skippedSections?: number;
  queueType?: string;
  currentComplexity?: string;
  currentSectionId?: string;
  currentSectionTitle?: string;
  elapsedMs: number;
  currentRequestDurationMs?: number;
  averageSectionDurationMs?: number;
  estimatedRemainingMs?: number | null;
  providerLabel?: string;
  model?: string;
  lastError?: string;
  isComplete?: boolean;
  isPaused?: boolean;
  mode?: string;
}

export interface M11GenerationCallbacks {
  onProgress?: (progress: M11GenerationProgressSnapshot) => void;
  onSectionDraft?: (draft: GeneratedSectionDraft) => void;
  signal?: AbortSignal;
}

export type M11GenerationLogEvent =
  | 'generation-started'
  | 'section-started'
  | 'section-completed'
  | 'section-failed'
  | 'generation-completed';

export function logM11Generation(
  event: M11GenerationLogEvent,
  details: Record<string, string | number | undefined>,
): void {
  console.info('[m11-generation]', event, details);
}

export function providerProgressMeta(config: LlmProviderConfig): {
  providerLabel: string;
  model: string;
} {
  if (config.providerId === 'azure-openai') {
    return {
      providerLabel: 'Azure OpenAI',
      model: config.azureDeployment ?? config.model ?? 'unknown',
    };
  }
  if (config.providerId === 'openai') {
    return {
      providerLabel: 'OpenAI',
      model: config.model ?? 'unknown',
    };
  }
  return {
    providerLabel: 'Simulation Mode',
    model: config.model ?? 'fixture-m11-reconstruct-v1',
  };
}

export function enrichGenerationProgressSnapshot(
  snapshot: M11GenerationProgressSnapshot,
  sectionDurations: number[],
): M11GenerationProgressSnapshot {
  const averageSectionDurationMs =
    snapshot.completedSections >= 2
      ? Math.round(snapshot.elapsedMs / snapshot.completedSections)
      : sectionDurations.length > 0
        ? Math.round(sectionDurations.reduce((sum, value) => sum + value, 0) / sectionDurations.length)
        : undefined;
  const estimatedRemainingMs = computeEstimatedRemainingMs(snapshot);

  return {
    ...snapshot,
    queuedSections: Math.max(
      0,
      snapshot.totalSections - snapshot.completedSections - snapshot.failedSections - (snapshot.currentSectionId ? 1 : 0),
    ),
    averageSectionDurationMs,
    estimatedRemainingMs,
  };
}

export function formatEstimatedRemaining(progress: M11GenerationProgressSnapshot): string {
  if (progress.estimatedRemainingMs === null || progress.estimatedRemainingMs === undefined) {
    return 'Estimating…';
  }
  return `~${formatBuildDurationMs(progress.estimatedRemainingMs)}`;
}

export function formatGenerationProgressDetail(progress: M11GenerationProgressSnapshot): string {
  const parts = [
    `${progress.completedSections}/${progress.totalSections} complete`,
    progress.failedSections > 0 ? `${progress.failedSections} failed` : null,
    progress.currentSectionId
      ? `Working on ${progress.currentSectionId}${progress.currentSectionTitle ? ` · ${progress.currentSectionTitle}` : ''}`
      : null,
    progress.providerLabel && progress.model ? `${progress.providerLabel}/${progress.model}` : null,
    `elapsed ${Math.round(progress.elapsedMs / 1000)}s`,
    progress.currentRequestDurationMs !== undefined
      ? `request ${Math.round(progress.currentRequestDurationMs / 1000)}s`
      : null,
    progress.averageSectionDurationMs !== undefined
      ? `avg ${Math.round(progress.averageSectionDurationMs / 1000)}s/section`
      : null,
    progress.isPaused ? 'paused' : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

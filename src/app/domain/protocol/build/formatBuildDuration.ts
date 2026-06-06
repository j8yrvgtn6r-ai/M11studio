export function formatBuildDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function formatBuildClockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function computeEstimatedRemainingMs(progress: {
  completedSections: number;
  totalSections: number;
  failedSections: number;
  elapsedMs: number;
}): number | null {
  if (progress.completedSections < 2) {
    return null;
  }
  const averageMs = progress.elapsedMs / progress.completedSections;
  const remainingSections = Math.max(
    0,
    progress.totalSections - progress.completedSections - progress.failedSections,
  );
  return Math.round(averageMs * remainingSections);
}

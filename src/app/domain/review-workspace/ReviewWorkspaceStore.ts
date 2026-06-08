import type { ReviewActionRecord, ReviewItemSource, ReviewItemStatus } from './ReviewItemTypes';

const HISTORY_KEY = 'm11-review-workspace-history-v1';
const STATUS_KEY = 'm11-review-workspace-status-v1';

const listeners = new Set<() => void>();

let statusOverrides = new Map<string, ReviewItemStatus>();
let actionHistory: ReviewActionRecord[] = [];

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(Object.fromEntries(statusOverrides.entries())));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(actionHistory.slice(-500)));
  } catch {
    // ignore storage failures
  }
}

function load(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const rawStatus = JSON.parse(localStorage.getItem(STATUS_KEY) ?? '{}') as Record<string, ReviewItemStatus>;
    statusOverrides = new Map(Object.entries(rawStatus));
    actionHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as ReviewActionRecord[];
  } catch {
    statusOverrides = new Map();
    actionHistory = [];
  }
}

load();

export function subscribeReviewWorkspace(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReviewItemStatusOverride(provenanceKey: string): ReviewItemStatus | undefined {
  return statusOverrides.get(provenanceKey);
}

export function getReviewActionHistory(): ReviewActionRecord[] {
  return [...actionHistory];
}

export function setReviewItemStatus(options: {
  itemId: string;
  provenanceKey: string;
  source: ReviewItemSource;
  status: ReviewItemStatus;
  recordHistory?: boolean;
}): void {
  if (options.status === 'open') {
    statusOverrides.delete(options.provenanceKey);
  } else {
    statusOverrides.set(options.provenanceKey, options.status);
  }

  if (options.recordHistory !== false && options.status !== 'open') {
    actionHistory.push({
      itemId: options.itemId,
      provenanceKey: options.provenanceKey,
      source: options.source,
      userAction: options.status,
      timestamp: new Date().toISOString(),
    });
  }

  persist();
  notify();
}

export function clearResolvedReviewItems(): number {
  let cleared = 0;
  for (const [key, status] of statusOverrides.entries()) {
    if (status === 'accepted' || status === 'rejected') {
      statusOverrides.delete(key);
      cleared += 1;
    }
  }
  persist();
  notify();
  return cleared;
}

export function resetReviewWorkspaceForTests(): void {
  statusOverrides = new Map();
  actionHistory = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STATUS_KEY);
    localStorage.removeItem(HISTORY_KEY);
  }
  notify();
}

/** Deterministic stable USDM IDs derived from study design entity ids. */

export interface UsdmIdFactory {
  idFor: (type: UsdmIdType, sourceId?: string) => string;
  seed: string;
}

export type UsdmIdType =
  | 'Study'
  | 'StudyVersion'
  | 'StudyDesign'
  | 'StudyArm'
  | 'StudyEpoch'
  | 'StudyElement'
  | 'Encounter'
  | 'Activity'
  | 'Procedure'
  | 'Timing'
  | 'ScheduledActivityInstance'
  | 'ScheduleTimeline'
  | 'Code';

const TYPE_COUNTERS = new Map<string, Map<string, number>>();

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sanitizeSourceSuffix(sourceId: string): string {
  const cleaned = sourceId.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!cleaned) return '';
  if (/^\d/.test(cleaned)) {
    return `x${cleaned}`;
  }
  return cleaned.slice(0, 48);
}

export function createUsdmIdFactory(seed = 'm11-studio'): UsdmIdFactory {
  const cache = new Map<string, string>();
  const counters = new Map<string, number>();

  function nextIndex(type: UsdmIdType): number {
    const next = (counters.get(type) ?? 0) + 1;
    counters.set(type, next);
    return next;
  }

  function idFor(type: UsdmIdType, sourceId?: string): string {
    const cacheKey = `${seed}:${type}:${sourceId ?? '__anonymous__'}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    let id: string;
    if (sourceId) {
      const suffix = sanitizeSourceSuffix(sourceId);
      if (suffix) {
        id = `${type}_${suffix}`;
      } else {
        const stable = (fnv1a(`${seed}:${type}:${sourceId}`) % 9999) + 1;
        id = `${type}_${stable}`;
      }
    } else {
      id = `${type}_${nextIndex(type)}`;
    }

    cache.set(cacheKey, id);
    return id;
  }

  return { idFor, seed };
}

/** Reset counters between tests — internal use only. */
export function resetUsdmIdFactoryForTests(): void {
  TYPE_COUNTERS.clear();
}

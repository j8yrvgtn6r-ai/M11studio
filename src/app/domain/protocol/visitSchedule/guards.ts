import type { ReanchorPolicy } from '../types';

const ROLLING_REANCHOR_POLICIES: ReadonlySet<ReanchorPolicy> = new Set([
  'reanchorToActualVisitDate',
  'reanchorOnlyWithinWindow',
  'reanchorOnlyIfProtocolSpecified',
  'hybrid',
]);

/** Returns whether a numeric offset value is a finite number. */
export function isValidScheduleOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Returns whether a visit window bound is a non-negative finite number. */
export function isValidVisitWindowBound(value: unknown): value is number {
  return isValidScheduleOffset(value) && value >= 0;
}

/** Returns whether a re-anchor policy implies rolling downstream schedule behavior. */
export function isRollingReanchorPolicy(reanchorPolicy: ReanchorPolicy | undefined): boolean {
  return reanchorPolicy !== undefined && ROLLING_REANCHOR_POLICIES.has(reanchorPolicy);
}

export { ROLLING_REANCHOR_POLICIES };

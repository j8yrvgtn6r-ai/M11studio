/** Global default for schedule selectors. Defaults to legacy hand-authored schedule. */
let useGeneratedSchedule = false;

/** Returns whether schedule selectors should read generated rules by default. */
export function getUseGeneratedSchedule(): boolean {
  return useGeneratedSchedule;
}

/** Sets the global default for schedule selectors (dev/preview only). */
export function setUseGeneratedSchedule(value: boolean): void {
  useGeneratedSchedule = value;
}

/** Resets the global schedule selector default to legacy mode. */
export function resetUseGeneratedSchedule(): void {
  useGeneratedSchedule = false;
}

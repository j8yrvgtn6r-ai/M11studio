/** Global default for schedule selectors. Reads authoritative generated cache in document.schedule. */
let useGeneratedSchedule = false;

/** Returns whether schedule selectors should read live generateScheduleFromRules() output (debug only). */
export function getUseGeneratedSchedule(): boolean {
  return useGeneratedSchedule;
}

/** Sets live generated preview mode for schedule selectors (debug comparison only). */
export function setUseGeneratedSchedule(value: boolean): void {
  useGeneratedSchedule = value;
}

/** Resets schedule selectors to the authoritative generated cache in document.schedule. */
export function resetUseGeneratedSchedule(): void {
  useGeneratedSchedule = false;
}

import { getUseGeneratedSchedule } from './scheduleSelectorConfig';

export type ScheduleSelectorOptions = {
  /** When true, read live output from generateScheduleFromRules() for debug comparison. */
  generated?: boolean;
};

/** Resolves whether a schedule selector call should use live generated preview output. */
export function shouldUseGeneratedSchedule(options?: ScheduleSelectorOptions): boolean {
  return options?.generated ?? getUseGeneratedSchedule();
}

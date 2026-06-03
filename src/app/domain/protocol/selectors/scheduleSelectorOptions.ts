import { getUseGeneratedSchedule } from './scheduleSelectorConfig';

export type ScheduleSelectorOptions = {
  /** When true, read generated schedule from visitSchedule + assessmentScheduleRules. */
  generated?: boolean;
};

/** Resolves whether a schedule selector call should use generated output. */
export function shouldUseGeneratedSchedule(options?: ScheduleSelectorOptions): boolean {
  return options?.generated ?? getUseGeneratedSchedule();
}

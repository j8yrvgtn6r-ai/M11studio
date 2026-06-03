import type { ProtocolDocument } from '../types';
import {
  formatScheduleParityReport,
  runScheduleParityCheck,
  type ScheduleParityReport,
} from '../scheduleGeneration/scheduleParity';

export {
  ACCEPTED_LEGACY_SCHEDULE_CONTENT_DIFFS,
  compareGeneratedScheduleFixtureParity,
  compareLegacyToGeneratedScheduleParity,
  formatScheduleParityReport,
  runScheduleParityCheck,
} from '../scheduleGeneration/scheduleParity';

export type {
  AcceptedScheduleContentDiff,
  ClassifiedScheduleDifference,
  ScheduleDifferenceKind,
  ScheduleParityReport,
  ScheduleParitySectionName,
  ScheduleSectionParityResult,
} from '../scheduleGeneration/scheduleParity';

/** Runs generated schedule parity checks for the supplied protocol document. */
export function checkScheduleParity(document: ProtocolDocument): ScheduleParityReport {
  return runScheduleParityCheck(document);
}

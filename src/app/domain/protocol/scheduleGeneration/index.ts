export {
  generateScheduleFromRules,
  generatedScheduleContentEquals,
  resolveGeneratedAssessmentRowId,
  resolveGeneratedVisitColumnId,
  verifyGeneratedScheduleIndependentOfLegacyScheduleMetadata,
} from './generateScheduleFromRules';
export type { GeneratedSchedule, GeneratedScheduleMetadata, ScheduleView } from './generateScheduleFromRules';

export {
  compareGeneratedScheduleToAuthoritative,
  formatGeneratedScheduleComparisonReport,
} from './compareGeneratedSchedule';

export type {
  GeneratedScheduleComparisonReport,
  ScheduleComparisonDifference,
  ScheduleComparisonSection,
} from './compareGeneratedSchedule';

export {
  formatGeneratedScheduleDiffReport,
  reportGeneratedScheduleDiff,
} from './reportGeneratedScheduleDiff';

export type { GeneratedScheduleDiffReport } from './reportGeneratedScheduleDiff';

export {
  buildScheduleSourceSnapshot,
  computeScheduleSourceHash,
  isScheduleCacheStale,
  regenerateScheduleCacheInDocument,
} from './scheduleCache';

export type { ScheduleSourceSnapshot } from './scheduleCache';

export { validateScheduleCache } from './scheduleCacheValidation';

export type { ScheduleCacheValidationMessage } from './scheduleCacheValidation';

export {
  ACCEPTED_LEGACY_SCHEDULE_CONTENT_DIFFS,
  compareGeneratedScheduleFixtureParity,
  compareLegacyToGeneratedScheduleParity,
  formatScheduleParityReport,
  runScheduleParityCheck,
} from './scheduleParity';

export type {
  AcceptedScheduleContentDiff,
  ClassifiedScheduleDifference,
  ScheduleDifferenceKind,
  ScheduleParityReport,
  ScheduleParitySectionName,
  ScheduleSectionParityResult,
} from './scheduleParity';

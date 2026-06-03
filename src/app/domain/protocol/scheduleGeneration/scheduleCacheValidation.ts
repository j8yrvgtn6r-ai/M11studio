import type { ProtocolDocument } from '../types';
import { computeScheduleSourceHash, isScheduleCacheStale } from './scheduleCache';

export interface ScheduleCacheValidationMessage {
  code: string;
  message: string;
  path?: string;
}

/** Validates cached schedule metadata and staleness against current generation sources. */
export function validateScheduleCache(
  document: ProtocolDocument,
  warnings: ScheduleCacheValidationMessage[]
): void {
  const metadata = document.schedule?.metadata;
  const path = 'schedule.metadata';

  if (!metadata) {
    warnings.push({
      code: 'schedule_cache_missing_metadata',
      path,
      message: 'schedule.metadata is missing; document.schedule is not tracked as a generated cache',
    });
    warnings.push({
      code: 'schedule_cache_not_generated_from_rules',
      path,
      message: 'document.schedule was not marked as generated from visitSchedule + SoA catalog + rules',
    });
    warnings.push({
      code: 'schedule_cache_stale',
      path,
      message: 'schedule cache has no sourceHash and cannot be verified against current generation sources',
    });
    return;
  }

  if (metadata.generatedFromRules !== true) {
    warnings.push({
      code: 'schedule_cache_not_generated_from_rules',
      path: `${path}.generatedFromRules`,
      message: 'schedule.metadata.generatedFromRules is not true',
    });
  }

  const requiredMetadataFields: Array<keyof typeof metadata> = [
    'generatedAt',
    'sourceHash',
    'sourceRuleCount',
    'sourceVisitDefinitionCount',
    'sourceSoAAssessmentDefinitionCount',
  ];

  for (const field of requiredMetadataFields) {
    if (metadata[field] === undefined || metadata[field] === null) {
      warnings.push({
        code: 'schedule_cache_missing_metadata',
        path: `${path}.${field}`,
        message: `schedule.metadata.${field} is required for generated cache tracking`,
      });
    }
  }

  if (isScheduleCacheStale(document)) {
    const currentHash = computeScheduleSourceHash(document);
    warnings.push({
      code: 'schedule_cache_stale',
      path: `${path}.sourceHash`,
      message: metadata.sourceHash
        ? `schedule cache sourceHash "${metadata.sourceHash}" does not match current sources "${currentHash}"`
        : 'schedule cache sourceHash is missing or does not match current generation sources',
    });
  }
}

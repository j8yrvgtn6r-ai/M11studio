import type { ProtocolDocument } from '../../domain/protocol/types';

/** True when the protocol has no SoA schedule configuration seeded or authored yet. */
export function isSoAConfigurationEmpty(document: ProtocolDocument): boolean {
  const anchorCount = document.visitSchedule?.anchors?.length ?? 0;
  const visitCount = document.visitSchedule?.visitDefinitions?.length ?? 0;
  const assessmentCount = document.soaAssessmentDefinitions?.length ?? 0;
  const ruleCount = document.assessmentScheduleRules?.length ?? 0;
  const hasGeneratedCache = Boolean(document.schedule?.metadata?.generatedFromRules);
  return anchorCount === 0 && visitCount === 0 && assessmentCount === 0 && ruleCount === 0 && !hasGeneratedCache;
}

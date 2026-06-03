import type { ProtocolDocument } from '../types';
import {
  selectAssessmentScheduleRules,
  selectAssessmentScheduleRulesForAssessment,
  selectAssessmentScheduleRulesForVisit,
} from '../assessmentScheduleRule/lookup';

export {
  selectAssessmentScheduleRules,
  selectAssessmentScheduleRulesForAssessment,
  selectAssessmentScheduleRulesForVisit,
};

export function selectAssessmentScheduleRule(document: ProtocolDocument, ruleId: string) {
  return document.assessmentScheduleRules?.find((rule) => rule.id === ruleId) ?? null;
}

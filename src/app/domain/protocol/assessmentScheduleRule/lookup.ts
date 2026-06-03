import type { AssessmentScheduleRule, ProtocolDocument } from '../types';
import { getProtocolDocument } from '../store/protocolStore';
import {
  assessmentReferencesMatch,
  collectValidAssessmentIds,
} from './assessmentRefs';

export interface AssessmentScheduleRuleLocation {
  rule: AssessmentScheduleRule;
  index: number;
}

/** Returns assessment schedule rules from a protocol document. */
export function selectAssessmentScheduleRules(document: ProtocolDocument): AssessmentScheduleRule[] {
  return document.assessmentScheduleRules ?? [];
}

/** Returns rules whose assessment reference matches the query id in either layer. */
export function selectAssessmentScheduleRulesForAssessment(
  document: ProtocolDocument,
  assessmentId: string
): AssessmentScheduleRule[] {
  return selectAssessmentScheduleRules(document).filter((rule) =>
    assessmentReferencesMatch(document, rule.assessmentId, assessmentId)
  );
}

/** Returns rules for a given visit definition id. */
export function selectAssessmentScheduleRulesForVisit(
  document: ProtocolDocument,
  visitDefinitionId: string
): AssessmentScheduleRule[] {
  return selectAssessmentScheduleRules(document).filter(
    (rule) => rule.visitDefinitionId === visitDefinitionId
  );
}

/** Finds an assessment schedule rule by id within a protocol document. */
export function findAssessmentScheduleRuleInDocument(
  document: ProtocolDocument,
  ruleId: string
): AssessmentScheduleRuleLocation | null {
  const rules = document.assessmentScheduleRules;
  if (!rules?.length) {
    return null;
  }

  const index = rules.findIndex((rule) => rule.id === ruleId);
  if (index < 0) {
    return null;
  }

  return {
    rule: rules[index],
    index,
  };
}

/** Finds an assessment schedule rule by id in the authoritative protocol store document. */
export function findAssessmentScheduleRule(ruleId: string): AssessmentScheduleRuleLocation | null {
  return findAssessmentScheduleRuleInDocument(getProtocolDocument(), ruleId);
}

/** Returns whether an assessment schedule rule id exists in a protocol document. */
export function assessmentScheduleRuleExistsInDocument(document: ProtocolDocument, ruleId: string): boolean {
  return findAssessmentScheduleRuleInDocument(document, ruleId) !== null;
}

export {
  assessmentIdExistsInDocument,
  collectClinicalDesignAssessmentIds,
  collectScheduleAssessmentIds,
  collectValidAssessmentIds,
} from './assessmentRefs';

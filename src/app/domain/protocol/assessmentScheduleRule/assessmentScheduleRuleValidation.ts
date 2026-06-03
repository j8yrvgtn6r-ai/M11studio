import type { ProtocolDocument } from '../types';
import { collectSectionIds } from '../clinicalDesign/entityValidation';
import { isRollingReanchorPolicy, isValidVisitWindowBound } from '../visitSchedule/guards';
import {
  buildAssessmentReferenceMetadata,
  collectValidAssessmentIds,
  isScheduleAssessmentId,
  resolveAssessmentReference,
} from './assessmentRefs';
import { findVisitDefinitionInDocument } from '../visitSchedule/lookup';

export interface AssessmentScheduleRuleValidationMessage {
  code: string;
  message: string;
  path?: string;
}

function visitUsesRollingSchedule(
  document: ProtocolDocument,
  visitDefinitionId: string
): boolean {
  const location = findVisitDefinitionInDocument(document, visitDefinitionId);
  if (!location) {
    return false;
  }

  const { visitDefinition } = location;
  const anchor = document.visitSchedule?.anchors.find((item) => item.id === visitDefinition.anchorId);
  if (anchor?.anchorType === 'previous-visit') {
    return true;
  }

  return isRollingReanchorPolicy(visitDefinition.reanchorPolicy);
}

function ruleHasTimingMetadata(rule: {
  timingNote?: string;
  relativeTiming?: string;
  windowBeforeDays?: number;
  windowAfterDays?: number;
}): boolean {
  return (
    !!rule.timingNote?.trim() ||
    !!rule.relativeTiming ||
    rule.windowBeforeDays !== undefined ||
    rule.windowAfterDays !== undefined
  );
}

/** Validates assessment schedule rules in a protocol document. */
export function validateAssessmentScheduleRules(
  document: ProtocolDocument,
  errors: AssessmentScheduleRuleValidationMessage[],
  warnings: AssessmentScheduleRuleValidationMessage[]
): void {
  const rules = document.assessmentScheduleRules;
  if (!rules) {
    errors.push({
      code: 'missing_assessment_schedule_rules',
      path: 'assessmentScheduleRules',
      message: 'assessmentScheduleRules is required',
    });
    return;
  }

  const sectionIds = collectSectionIds(document.sections ?? []);
  const validAssessmentIds = collectValidAssessmentIds(document);
  const seenRuleIds = new Map<string, string>();

  rules.forEach((rule, index) => {
    const path = `assessmentScheduleRules[${index}]`;
    const previousPath = seenRuleIds.get(rule.id);

    if (previousPath) {
      errors.push({
        code: 'duplicate_assessment_schedule_rule_id',
        path,
        message: `Duplicate assessment schedule rule id "${rule.id}" (also declared at ${previousPath})`,
      });
    } else {
      seenRuleIds.set(rule.id, path);
    }

    if (!rule.assessmentId?.trim()) {
      errors.push({
        code: 'assessment_schedule_rule_missing_assessment',
        path: `${path}.assessmentId`,
        message: 'assessmentId is required for assessment schedule rules',
      });
    } else if (!validAssessmentIds.has(rule.assessmentId)) {
      errors.push({
        code: 'invalid_assessment_schedule_rule_assessment',
        path: `${path}.assessmentId`,
        message: `assessmentId "${rule.assessmentId}" does not match any clinical design or schedule assessment id`,
      });
    } else {
      const resolution = resolveAssessmentReference(document, rule.assessmentId);

      if (resolution?.kind === 'schedule') {
        warnings.push({
          code: 'assessment_schedule_rule_schedule_assessment_ref',
          path: `${path}.assessmentId`,
          message:
            'assessmentId references schedule.assessments[]; prefer clinicalDesign.assessments[].id as the canonical WHAT reference',
        });

        if (resolution.clinicalDesignAssessmentId) {
          warnings.push({
            code: 'assessment_schedule_rule_prefer_clinical_design_assessment',
            path: `${path}.assessmentId`,
            message: `assessmentId "${rule.assessmentId}" maps to clinical design assessment "${resolution.clinicalDesignAssessmentId}" and should migrate to that canonical id before Stage 2d generation`,
          });
        }

        const metadataScheduleId = rule.metadata?.scheduleAssessmentId;
        if (metadataScheduleId !== undefined && metadataScheduleId !== rule.assessmentId) {
          warnings.push({
            code: 'assessment_schedule_rule_metadata_schedule_mismatch',
            path: `${path}.metadata.scheduleAssessmentId`,
            message: 'metadata.scheduleAssessmentId does not match assessmentId for schedule-layer reference',
          });
        }
      }

      if (resolution?.kind === 'clinicalDesign') {
        const metadataClinicalId = rule.metadata?.clinicalDesignAssessmentId;
        if (metadataClinicalId !== undefined && metadataClinicalId !== rule.assessmentId) {
          warnings.push({
            code: 'assessment_schedule_rule_metadata_clinical_mismatch',
            path: `${path}.metadata.clinicalDesignAssessmentId`,
            message: 'metadata.clinicalDesignAssessmentId does not match assessmentId for clinical design reference',
          });
        }
      }

      const expectedMetadata = buildAssessmentReferenceMetadata(document, rule.assessmentId);
      if (
        isScheduleAssessmentId(document, rule.assessmentId) &&
        rule.metadata?.assessmentRefKind !== expectedMetadata.assessmentRefKind
      ) {
        warnings.push({
          code: 'assessment_schedule_rule_missing_ref_metadata',
          path: `${path}.metadata`,
          message:
            'Schedule-layer assessmentId should include metadata.assessmentRefKind and cross-layer assessment id links',
        });
      }
    }

    if (!rule.visitDefinitionId?.trim()) {
      errors.push({
        code: 'assessment_schedule_rule_missing_visit',
        path: `${path}.visitDefinitionId`,
        message: 'visitDefinitionId is required for assessment schedule rules',
      });
    } else if (!findVisitDefinitionInDocument(document, rule.visitDefinitionId)) {
      errors.push({
        code: 'invalid_assessment_schedule_rule_visit',
        path: `${path}.visitDefinitionId`,
        message: `visitDefinitionId "${rule.visitDefinitionId}" does not match any visit definition id`,
      });
    }

    if (rule.sourceSectionId && !sectionIds.has(rule.sourceSectionId)) {
      errors.push({
        code: 'invalid_assessment_schedule_rule_section',
        path: `${path}.sourceSectionId`,
        message: `sourceSectionId "${rule.sourceSectionId}" does not match any section id`,
      });
    }

    if (rule.windowBeforeDays !== undefined && !isValidVisitWindowBound(rule.windowBeforeDays)) {
      errors.push({
        code: 'invalid_assessment_schedule_rule_window_before_days',
        path: `${path}.windowBeforeDays`,
        message: 'windowBeforeDays must be a non-negative number when provided',
      });
    }

    if (rule.windowAfterDays !== undefined && !isValidVisitWindowBound(rule.windowAfterDays)) {
      errors.push({
        code: 'invalid_assessment_schedule_rule_window_after_days',
        path: `${path}.windowAfterDays`,
        message: 'windowAfterDays must be a non-negative number when provided',
      });
    }

    if (rule.independentOfDoseDelay && visitUsesRollingSchedule(document, rule.visitDefinitionId)) {
      warnings.push({
        code: 'imaging_rolling_conflict',
        path,
        message:
          'independentOfDoseDelay is true but the linked visit uses rolling re-anchor or previous-visit anchoring',
      });
    }

    if (rule.required && !ruleHasTimingMetadata(rule)) {
      const visitLocation = findVisitDefinitionInDocument(document, rule.visitDefinitionId);
      const visitHasWindow =
        visitLocation &&
        (visitLocation.visitDefinition.windowBeforeDays !== undefined ||
          visitLocation.visitDefinition.windowAfterDays !== undefined);

      if (!visitHasWindow) {
        warnings.push({
          code: 'required_assessment_schedule_rule_missing_timing',
          path,
          message:
            'Required assessment schedule rule has no timingNote, relativeTiming, window overrides, or visit-level window',
        });
      }
    }
  });
}

import type { ProtocolDocument } from '../types';

import { collectSectionIds } from '../clinicalDesign/entityValidation';

import { isRollingReanchorPolicy, isValidVisitWindowBound } from '../visitSchedule/guards';

import {

  isClinicalDesignAssessmentId,

  isSoAAssessmentDefinitionId,

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

    } else if (isClinicalDesignAssessmentId(document, rule.assessmentId)) {

      errors.push({

        code: 'assessment_schedule_rule_clinical_design_assessment_ref',

        path: `${path}.assessmentId`,

        message: `assessmentId "${rule.assessmentId}" must reference soaAssessmentDefinitions[].id; clinical design linkage belongs on the catalog row`,

      });

    } else if (!isSoAAssessmentDefinitionId(document, rule.assessmentId)) {

      errors.push({

        code: 'invalid_assessment_schedule_rule_assessment',

        path: `${path}.assessmentId`,

        message: `assessmentId "${rule.assessmentId}" does not match any SoA assessment catalog id`,

      });

    } else {

      const resolution = resolveAssessmentReference(document, rule.assessmentId);

      const catalogDefinition = document.soaAssessmentDefinitions?.find(

        (definition) => definition.id === rule.assessmentId

      );



      if (resolution?.kind !== 'soaAssessment') {

        warnings.push({

          code: 'assessment_schedule_rule_unexpected_assessment_ref_kind',

          path: `${path}.assessmentId`,

          message: `assessmentId "${rule.assessmentId}" should resolve to assessmentRefKind "soaAssessment"`,

        });

      }



      const metadataClinicalId = rule.metadata?.clinicalDesignAssessmentId;

      if (

        typeof metadataClinicalId === 'string' &&

        catalogDefinition?.clinicalDesignAssessmentId &&

        metadataClinicalId !== catalogDefinition.clinicalDesignAssessmentId

      ) {

        warnings.push({

          code: 'assessment_schedule_rule_metadata_clinical_mismatch',

          path: `${path}.metadata.clinicalDesignAssessmentId`,

          message:

            'metadata.clinicalDesignAssessmentId does not match soaAssessmentDefinitions[].clinicalDesignAssessmentId',

        });

      }



      const metadataLegacyScheduleId = rule.metadata?.legacyScheduleAssessmentId;

      if (

        typeof metadataLegacyScheduleId === 'string' &&

        metadataLegacyScheduleId !== rule.assessmentId

      ) {

        warnings.push({

          code: 'assessment_schedule_rule_metadata_legacy_schedule_mismatch',

          path: `${path}.metadata.legacyScheduleAssessmentId`,

          message: 'metadata.legacyScheduleAssessmentId should match assessmentId after catalog normalization',

        });

      }



      const metadataScheduleAssessmentId = rule.metadata?.scheduleAssessmentId;

      if (metadataScheduleAssessmentId !== undefined) {

        warnings.push({

          code: 'assessment_schedule_rule_deprecated_schedule_metadata',

          path: `${path}.metadata.scheduleAssessmentId`,

          message:

            'metadata.scheduleAssessmentId is deprecated; use assessmentId and metadata.legacyScheduleAssessmentId',

        });

      }



      if (rule.metadata?.assessmentRefKind === 'schedule') {

        warnings.push({

          code: 'assessment_schedule_rule_deprecated_ref_kind',

          path: `${path}.metadata.assessmentRefKind`,

          message: 'metadata.assessmentRefKind "schedule" is deprecated; use "soaAssessment"',

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



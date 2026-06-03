import type { ProtocolDocument } from '../types';
import { collectClinicalDesignAssessmentIds } from '../assessmentScheduleRule/assessmentRefs';
import { collectSectionIds } from '../clinicalDesign/entityValidation';

export interface SoAAssessmentDefinitionValidationMessage {
  code: string;
  message: string;
  path?: string;
}

function isValidOrderValue(order: unknown): order is number {
  return typeof order === 'number' && Number.isFinite(order);
}

/** Validates SoA assessment definition catalog entries in a protocol document. */
export function validateSoAAssessmentDefinitions(
  document: ProtocolDocument,
  errors: SoAAssessmentDefinitionValidationMessage[],
  warnings: SoAAssessmentDefinitionValidationMessage[]
): void {
  if (!document.soaAssessmentDefinitions) {
    errors.push({
      code: 'missing_soa_assessment_definitions',
      path: 'soaAssessmentDefinitions',
      message: 'soaAssessmentDefinitions is required',
    });
    return;
  }

  const { soaAssessmentDefinitions } = document;
  const seenIds = new Map<string, string>();
  const seenOrders = new Map<number, string>();
  const sectionIds = collectSectionIds(document.sections ?? []);
  const clinicalDesignAssessmentIds = collectClinicalDesignAssessmentIds(document);

  soaAssessmentDefinitions.forEach((definition, index) => {
    const path = `soaAssessmentDefinitions[${index}]`;
    const previousIdPath = seenIds.get(definition.id);

    if (previousIdPath) {
      errors.push({
        code: 'duplicate_soa_assessment_definition_id',
        path,
        message: `Duplicate SoA assessment definition id "${definition.id}" (also declared at ${previousIdPath})`,
      });
    } else {
      seenIds.set(definition.id, path);
    }

    if (!definition.id?.trim()) {
      errors.push({
        code: 'missing_soa_assessment_definition_id',
        path: `${path}.id`,
        message: 'id is required for SoA assessment definitions',
      });
    }

    if (!definition.label?.trim()) {
      errors.push({
        code: 'missing_soa_assessment_definition_label',
        path: `${path}.label`,
        message: 'label is required for SoA assessment definitions',
      });
    }

    if (!definition.category?.trim()) {
      errors.push({
        code: 'missing_soa_assessment_definition_category',
        path: `${path}.category`,
        message: 'category is required for SoA assessment definitions',
      });
    }

    if (!isValidOrderValue(definition.order)) {
      errors.push({
        code: 'invalid_soa_assessment_definition_order',
        path: `${path}.order`,
        message: 'order must be a finite number',
      });
    } else {
      const previousOrderPath = seenOrders.get(definition.order);
      if (previousOrderPath) {
        warnings.push({
          code: 'duplicate_soa_assessment_definition_order',
          path: `${path}.order`,
          message: `Duplicate order value ${definition.order} (also used at ${previousOrderPath})`,
        });
      } else {
        seenOrders.set(definition.order, path);
      }
    }

    if (definition.linkedSectionId && !sectionIds.has(definition.linkedSectionId)) {
      errors.push({
        code: 'invalid_soa_assessment_definition_linked_section',
        path: `${path}.linkedSectionId`,
        message: `linkedSectionId "${definition.linkedSectionId}" does not match any section id`,
      });
    }

    if (
      definition.clinicalDesignAssessmentId &&
      !clinicalDesignAssessmentIds.has(definition.clinicalDesignAssessmentId)
    ) {
      errors.push({
        code: 'invalid_soa_assessment_definition_clinical_design_ref',
        path: `${path}.clinicalDesignAssessmentId`,
        message: `clinicalDesignAssessmentId "${definition.clinicalDesignAssessmentId}" does not match any clinical design assessment id`,
      });
    }
  });

  if (soaAssessmentDefinitions.length === 0) {
    warnings.push({
      code: 'soa_assessment_definitions_empty',
      path: 'soaAssessmentDefinitions',
      message: 'SoA assessment definition catalog has no entries',
    });
  }
}

import type {
  ClinicalDesignEntities,
  ProtocolDocument,
  SectionNode,
} from './types';

export interface ProtocolValidationMessage {
  code: string;
  message: string;
  path?: string;
}

export interface ProtocolValidationResult {
  valid: boolean;
  errors: ProtocolValidationMessage[];
  warnings: ProtocolValidationMessage[];
}

function collectSectionIds(sections: SectionNode[]): Set<string> {
  const ids = new Set<string>();

  const walk = (nodes: SectionNode[]) => {
    for (const node of nodes) {
      ids.add(node.id);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(sections);
  return ids;
}

function collectClinicalDesignEntityIds(clinicalDesign: ClinicalDesignEntities): Set<string> {
  const ids = new Set<string>();
  const entityGroups = [
    clinicalDesign.objectives,
    clinicalDesign.endpoints,
    clinicalDesign.estimands ?? [],
    clinicalDesign.assessments,
    clinicalDesign.visits,
    clinicalDesign.studyArms,
    clinicalDesign.populations,
    clinicalDesign.eligibilityCriteria,
    clinicalDesign.interventions,
    clinicalDesign.statisticalAnalyses,
    clinicalDesign.biomarkers ?? [],
    clinicalDesign.safetyAssessments ?? [],
  ];

  for (const entities of entityGroups) {
    for (const entity of entities) {
      ids.add(entity.id);
    }
  }

  return ids;
}

function checkUniqueIds(
  ids: string[],
  pathPrefix: string,
  errors: ProtocolValidationMessage[],
  code = 'duplicate_id'
): void {
  const seen = new Set<string>();

  ids.forEach((id, index) => {
    if (seen.has(id)) {
      errors.push({
        code,
        path: `${pathPrefix}[${index}]`,
        message: `Duplicate id "${id}" in ${pathPrefix}`,
      });
    }
    seen.add(id);
  });
}

function pushMissingReferenceError(
  errors: ProtocolValidationMessage[],
  path: string,
  field: string,
  value: string,
  targetCollection: string
): void {
  errors.push({
    code: 'missing_reference',
    path,
    message: `${field} "${value}" does not match any id in ${targetCollection}`,
  });
}

/** Validates structural integrity of a canonical protocol document. */
export function validateProtocol(document: ProtocolDocument): ProtocolValidationResult {
  const errors: ProtocolValidationMessage[] = [];
  const warnings: ProtocolValidationMessage[] = [];

  if (!document.schemaVersion) {
    errors.push({
      code: 'missing_schema_version',
      path: 'schemaVersion',
      message: 'schemaVersion is required',
    });
  }

  if (!document.id?.trim()) {
    errors.push({
      code: 'missing_protocol_id',
      path: 'id',
      message: 'Protocol id is required',
    });
  }

  if (!document.metadata || typeof document.metadata !== 'object') {
    errors.push({
      code: 'missing_metadata',
      path: 'metadata',
      message: 'metadata is required',
    });
  }

  const sectionIds = collectSectionIds(document.sections ?? []);
  checkUniqueIds(
    (document.sections ?? []).flatMap(function flattenSections(section): string[] {
      return [section.id, ...(section.children?.flatMap(flattenSections) ?? [])];
    }),
    'sections',
    errors
  );

  const elementIds = document.elements.map((element) => element.id);
  checkUniqueIds(elementIds, 'elements', errors);
  const elementIdSet = new Set(elementIds);

  document.elements.forEach((element, index) => {
    if (!sectionIds.has(element.sectionId)) {
      pushMissingReferenceError(
        errors,
        `elements[${index}].sectionId`,
        'sectionId',
        element.sectionId,
        'sections'
      );
    }
  });

  const relationshipIds = document.relationships.map((relationship) => relationship.id);
  checkUniqueIds(relationshipIds, 'relationships', errors);

  const clinicalDesignEntityIds = collectClinicalDesignEntityIds(document.clinicalDesign);

  document.relationships.forEach((relationship, index) => {
    if (!clinicalDesignEntityIds.has(relationship.sourceId)) {
      pushMissingReferenceError(
        errors,
        `relationships[${index}].sourceId`,
        'sourceId',
        relationship.sourceId,
        'clinicalDesign entities'
      );
    }

    if (!clinicalDesignEntityIds.has(relationship.targetId)) {
      pushMissingReferenceError(
        errors,
        `relationships[${index}].targetId`,
        'targetId',
        relationship.targetId,
        'clinicalDesign entities'
      );
    }
  });

  const scheduleVisitIds = document.schedule.visits.map((visit) => visit.id);
  checkUniqueIds(scheduleVisitIds, 'schedule.visits', errors);
  const scheduleVisitIdSet = new Set(scheduleVisitIds);

  const scheduleAssessmentIds = document.schedule.assessments.map((assessment) => assessment.id);
  checkUniqueIds(scheduleAssessmentIds, 'schedule.assessments', errors);
  const scheduleAssessmentIdSet = new Set(scheduleAssessmentIds);

  document.schedule.cells.forEach((cell, index) => {
    if (!scheduleVisitIdSet.has(cell.visitId)) {
      pushMissingReferenceError(
        errors,
        `schedule.cells[${index}].visitId`,
        'visitId',
        cell.visitId,
        'schedule.visits'
      );
    }

    if (!scheduleAssessmentIdSet.has(cell.assessmentId)) {
      pushMissingReferenceError(
        errors,
        `schedule.cells[${index}].assessmentId`,
        'assessmentId',
        cell.assessmentId,
        'schedule.assessments'
      );
    }
  });

  document.validationIssues.forEach((issue, index) => {
    if (issue.sectionId && !sectionIds.has(issue.sectionId)) {
      warnings.push({
        code: 'validation_issue_section_ref',
        path: `validationIssues[${index}].sectionId`,
        message: `sectionId "${issue.sectionId}" does not match any section id`,
      });
    }

    if (issue.elementId && !elementIdSet.has(issue.elementId)) {
      warnings.push({
        code: 'validation_issue_element_ref',
        path: `validationIssues[${index}].elementId`,
        message: `elementId "${issue.elementId}" does not match any element id`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function formatProtocolValidationResult(result: ProtocolValidationResult): string {
  const lines = ['Protocol integrity validation report', ''];

  lines.push(result.valid ? 'VALID' : 'INVALID');
  lines.push(`Errors: ${result.errors.length}`);
  lines.push(`Warnings: ${result.warnings.length}`);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  - [${error.code}] ${error.path ?? 'root'}: ${error.message}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  - [${warning.code}] ${warning.path ?? 'root'}: ${warning.message}`);
    }
    lines.push('');
  }

  if (result.valid && result.warnings.length === 0) {
    lines.push('No structural integrity issues found.');
  }

  return lines.join('\n');
}

/** Logs validation results in development without affecting runtime behavior. */
export function logDevProtocolValidation(document: ProtocolDocument): ProtocolValidationResult | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const result = validateProtocol(document);

  if (!result.valid) {
    console.error('[protocol] Integrity validation failed:', result.errors);
  }

  if (result.warnings.length > 0) {
    console.warn('[protocol] Integrity validation warnings:', result.warnings);
  }

  return result;
}

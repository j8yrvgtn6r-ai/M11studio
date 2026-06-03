import type { ProtocolDocument, ScheduleAssessment } from '../types';

export type AssessmentReferenceKind = 'clinicalDesign' | 'schedule';

export interface AssessmentReferenceResolution {
  kind: AssessmentReferenceKind;
  /** Value stored on AssessmentScheduleRule.assessmentId. */
  ruleAssessmentId: string;
  clinicalDesignAssessmentId?: string;
  scheduleAssessmentId?: string;
}

/** Returns clinical design assessment ids. */
export function collectClinicalDesignAssessmentIds(document: ProtocolDocument): Set<string> {
  const ids = new Set<string>();
  document.clinicalDesign.assessments?.forEach((assessment) => {
    ids.add(assessment.id);
  });
  return ids;
}

/** Returns schedule assessment row ids. */
export function collectScheduleAssessmentIds(document: ProtocolDocument): Set<string> {
  const ids = new Set<string>();
  document.schedule.assessments?.forEach((assessment) => {
    ids.add(assessment.id);
  });
  return ids;
}

/** Collects valid assessment ids from clinical design and schedule assessments. */
export function collectValidAssessmentIds(document: ProtocolDocument): Set<string> {
  const ids = collectClinicalDesignAssessmentIds(document);
  collectScheduleAssessmentIds(document).forEach((id) => ids.add(id));
  return ids;
}

export function findScheduleAssessmentInDocument(
  document: ProtocolDocument,
  scheduleAssessmentId: string
): ScheduleAssessment | null {
  return document.schedule.assessments?.find((assessment) => assessment.id === scheduleAssessmentId) ?? null;
}

export function isClinicalDesignAssessmentId(document: ProtocolDocument, assessmentId: string): boolean {
  return collectClinicalDesignAssessmentIds(document).has(assessmentId);
}

export function isScheduleAssessmentId(document: ProtocolDocument, assessmentId: string): boolean {
  return collectScheduleAssessmentIds(document).has(assessmentId);
}

/** Returns whether an assessment id exists in clinical design or schedule assessments. */
export function assessmentIdExistsInDocument(document: ProtocolDocument, assessmentId: string): boolean {
  return collectValidAssessmentIds(document).has(assessmentId);
}

/** Resolves how a rule assessment id maps across clinical design and schedule layers. */
export function resolveAssessmentReference(
  document: ProtocolDocument,
  ruleAssessmentId: string
): AssessmentReferenceResolution | null {
  if (isClinicalDesignAssessmentId(document, ruleAssessmentId)) {
    const scheduleAssessment = document.schedule.assessments?.find(
      (assessment) => assessment.entityId === ruleAssessmentId
    );

    return {
      kind: 'clinicalDesign',
      ruleAssessmentId,
      clinicalDesignAssessmentId: ruleAssessmentId,
      scheduleAssessmentId: scheduleAssessment?.id,
    };
  }

  const scheduleAssessment = findScheduleAssessmentInDocument(document, ruleAssessmentId);
  if (!scheduleAssessment) {
    return null;
  }

  return {
    kind: 'schedule',
    ruleAssessmentId,
    scheduleAssessmentId: scheduleAssessment.id,
    clinicalDesignAssessmentId: scheduleAssessment.entityId,
  };
}

/** Returns whether a rule's assessment reference matches a query id in either layer. */
export function assessmentReferencesMatch(
  document: ProtocolDocument,
  ruleAssessmentId: string,
  queryAssessmentId: string
): boolean {
  if (ruleAssessmentId === queryAssessmentId) {
    return true;
  }

  const ruleRef = resolveAssessmentReference(document, ruleAssessmentId);
  const queryRef = resolveAssessmentReference(document, queryAssessmentId);

  if (!ruleRef || !queryRef) {
    return false;
  }

  if (
    ruleRef.clinicalDesignAssessmentId &&
    ruleRef.clinicalDesignAssessmentId === queryRef.clinicalDesignAssessmentId
  ) {
    return true;
  }

  if (ruleRef.scheduleAssessmentId && ruleRef.scheduleAssessmentId === queryRef.scheduleAssessmentId) {
    return true;
  }

  if (
    ruleRef.clinicalDesignAssessmentId &&
    ruleRef.clinicalDesignAssessmentId === queryAssessmentId
  ) {
    return true;
  }

  if (ruleRef.scheduleAssessmentId && ruleRef.scheduleAssessmentId === queryAssessmentId) {
    return true;
  }

  return false;
}

/** Builds metadata links documenting how a rule assessment id maps across layers. */
export function buildAssessmentReferenceMetadata(
  document: ProtocolDocument,
  assessmentId: string
): Record<string, unknown> {
  const resolution = resolveAssessmentReference(document, assessmentId);
  if (!resolution) {
    return { assessmentRefKind: 'unknown' };
  }

  const metadata: Record<string, unknown> = {
    assessmentRefKind: resolution.kind,
  };

  if (resolution.clinicalDesignAssessmentId) {
    metadata.clinicalDesignAssessmentId = resolution.clinicalDesignAssessmentId;
  }

  if (resolution.scheduleAssessmentId) {
    metadata.scheduleAssessmentId = resolution.scheduleAssessmentId;
  }

  return metadata;
}

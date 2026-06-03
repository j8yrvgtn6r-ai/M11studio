import type { ProtocolDocument, ScheduleAssessment, SoAAssessmentDefinition } from '../types';

export type AssessmentReferenceKind = 'soaAssessment' | 'clinicalDesign';

export interface AssessmentReferenceResolution {
  kind: AssessmentReferenceKind;
  /** Value stored on AssessmentScheduleRule.assessmentId. */
  ruleAssessmentId: string;
  /** Canonical SoA assessment catalog row id. */
  soaAssessmentDefinitionId?: string;
  /** Linked clinical design assessment when the catalog row has a WHAT entity. */
  clinicalDesignAssessmentId?: string;
  /**
   * @deprecated Use soaAssessmentDefinitionId. Retained for transitional metadata reads only.
   */
  scheduleAssessmentId?: string;
}

function resolveSoAAssessmentLinkedSectionId(
  legacyLinkedSectionRef: unknown,
  linkedSectionId?: string
): string | undefined {
  if (typeof legacyLinkedSectionRef === 'string' && legacyLinkedSectionRef.trim()) {
    return legacyLinkedSectionRef;
  }

  return linkedSectionId;
}

function getSoAAssessmentDefinitions(document: ProtocolDocument): SoAAssessmentDefinition[] {
  return document.soaAssessmentDefinitions ?? [];
}

function findSoAAssessmentDefinitionById(
  document: ProtocolDocument,
  soaAssessmentDefinitionId: string
): SoAAssessmentDefinition | null {
  return (
    getSoAAssessmentDefinitions(document).find((definition) => definition.id === soaAssessmentDefinitionId) ??
    null
  );
}

function findSoAAssessmentDefinitionByClinicalDesignId(
  document: ProtocolDocument,
  clinicalDesignAssessmentId: string
): SoAAssessmentDefinition | null {
  return (
    getSoAAssessmentDefinitions(document).find(
      (definition) => definition.clinicalDesignAssessmentId === clinicalDesignAssessmentId
    ) ?? null
  );
}

function mapSoAAssessmentDefinitionToScheduleAssessment(definition: SoAAssessmentDefinition): ScheduleAssessment {
  const linkedSectionId = resolveSoAAssessmentLinkedSectionId(
    definition.metadata?.legacyLinkedSectionRef,
    definition.linkedSectionId
  );

  return {
    id: definition.id,
    label: definition.label,
    category: definition.category,
    ...(definition.clinicalDesignAssessmentId ? { entityId: definition.clinicalDesignAssessmentId } : {}),
    ...(linkedSectionId ? { linkedSectionId } : {}),
  };
}

function withScheduleAssessmentAlias(
  resolution: AssessmentReferenceResolution
): AssessmentReferenceResolution {
  if (resolution.soaAssessmentDefinitionId) {
    return {
      ...resolution,
      scheduleAssessmentId: resolution.soaAssessmentDefinitionId,
    };
  }

  return resolution;
}

/** Returns clinical design assessment ids. */
export function collectClinicalDesignAssessmentIds(document: ProtocolDocument): Set<string> {
  const ids = new Set<string>();
  document.clinicalDesign.assessments?.forEach((assessment) => {
    ids.add(assessment.id);
  });
  return ids;
}

/** Returns SoA assessment catalog ids. */
export function collectSoAAssessmentDefinitionIds(document: ProtocolDocument): Set<string> {
  const ids = new Set<string>();
  getSoAAssessmentDefinitions(document).forEach((definition) => {
    ids.add(definition.id);
  });
  return ids;
}

/** @deprecated Prefer collectSoAAssessmentDefinitionIds. */
export function collectScheduleAssessmentIds(document: ProtocolDocument): Set<string> {
  return collectSoAAssessmentDefinitionIds(document);
}

/** Collects valid assessment ids from clinical design and the SoA assessment catalog. */
export function collectValidAssessmentIds(document: ProtocolDocument): Set<string> {
  const ids = collectClinicalDesignAssessmentIds(document);
  collectSoAAssessmentDefinitionIds(document).forEach((id) => ids.add(id));
  return ids;
}

export function isClinicalDesignAssessmentId(document: ProtocolDocument, assessmentId: string): boolean {
  return collectClinicalDesignAssessmentIds(document).has(assessmentId);
}

export function isSoAAssessmentDefinitionId(document: ProtocolDocument, assessmentId: string): boolean {
  return collectSoAAssessmentDefinitionIds(document).has(assessmentId);
}

/** @deprecated Prefer isSoAAssessmentDefinitionId. */
export function isScheduleAssessmentId(document: ProtocolDocument, assessmentId: string): boolean {
  return isSoAAssessmentDefinitionId(document, assessmentId);
}

/** Returns whether an assessment id exists in clinical design or the SoA assessment catalog. */
export function assessmentIdExistsInDocument(document: ProtocolDocument, assessmentId: string): boolean {
  return collectValidAssessmentIds(document).has(assessmentId);
}

export function findScheduleAssessmentInDocument(
  document: ProtocolDocument,
  scheduleAssessmentId: string
): ScheduleAssessment | null {
  const definition = findSoAAssessmentDefinitionById(document, scheduleAssessmentId);
  if (!definition) {
    return null;
  }

  return mapSoAAssessmentDefinitionToScheduleAssessment(definition);
}

/** Resolves how a rule assessment id maps to the SoA catalog and clinical design layers. */
export function resolveAssessmentReference(
  document: ProtocolDocument,
  ruleAssessmentId: string
): AssessmentReferenceResolution | null {
  const soaAssessmentDefinition = findSoAAssessmentDefinitionById(document, ruleAssessmentId);
  if (soaAssessmentDefinition) {
    return withScheduleAssessmentAlias({
      kind: 'soaAssessment',
      ruleAssessmentId,
      soaAssessmentDefinitionId: soaAssessmentDefinition.id,
      clinicalDesignAssessmentId: soaAssessmentDefinition.clinicalDesignAssessmentId,
    });
  }

  if (isClinicalDesignAssessmentId(document, ruleAssessmentId)) {
    const linkedCatalogDefinition = findSoAAssessmentDefinitionByClinicalDesignId(document, ruleAssessmentId);

    return withScheduleAssessmentAlias({
      kind: 'clinicalDesign',
      ruleAssessmentId,
      clinicalDesignAssessmentId: ruleAssessmentId,
      soaAssessmentDefinitionId: linkedCatalogDefinition?.id,
    });
  }

  return null;
}

/** Returns whether a rule's assessment reference matches a query id across catalog and clinical design layers. */
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

  if (
    ruleRef.soaAssessmentDefinitionId &&
    ruleRef.soaAssessmentDefinitionId === queryRef.soaAssessmentDefinitionId
  ) {
    return true;
  }

  if (
    ruleRef.clinicalDesignAssessmentId &&
    ruleRef.clinicalDesignAssessmentId === queryAssessmentId
  ) {
    return true;
  }

  if (ruleRef.soaAssessmentDefinitionId && ruleRef.soaAssessmentDefinitionId === queryAssessmentId) {
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

  if (resolution.soaAssessmentDefinitionId) {
    metadata.soaAssessmentDefinitionId = resolution.soaAssessmentDefinitionId;
    metadata.legacyScheduleAssessmentId = resolution.soaAssessmentDefinitionId;
  }

  if (resolution.clinicalDesignAssessmentId) {
    metadata.clinicalDesignAssessmentId = resolution.clinicalDesignAssessmentId;
  }

  return metadata;
}

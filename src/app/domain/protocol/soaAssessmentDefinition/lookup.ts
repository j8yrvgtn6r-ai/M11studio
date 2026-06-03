import type { ProtocolDocument, SoAAssessmentDefinition } from '../types';
import { getProtocolDocument } from '../store/protocolStore';

export interface SoAAssessmentDefinitionLocation {
  soaAssessmentDefinition: SoAAssessmentDefinition;
  index: number;
}

/** Returns SoA assessment definitions from a protocol document. */
export function selectSoAAssessmentDefinitions(document: ProtocolDocument): SoAAssessmentDefinition[] {
  return document.soaAssessmentDefinitions ?? [];
}

/** Returns SoA assessment definitions matching a category. */
export function selectSoAAssessmentDefinitionsByCategory(
  document: ProtocolDocument,
  category: string
): SoAAssessmentDefinition[] {
  return selectSoAAssessmentDefinitions(document).filter(
    (definition) => definition.category === category
  );
}

/** Finds a SoA assessment definition by id within a protocol document. */
export function findSoAAssessmentDefinitionInDocument(
  document: ProtocolDocument,
  soaAssessmentDefinitionId: string
): SoAAssessmentDefinitionLocation | null {
  const definitions = document.soaAssessmentDefinitions;
  if (!definitions?.length) {
    return null;
  }

  const index = definitions.findIndex((definition) => definition.id === soaAssessmentDefinitionId);
  if (index < 0) {
    return null;
  }

  return {
    soaAssessmentDefinition: definitions[index],
    index,
  };
}

/** Finds a SoA assessment definition by id in the authoritative protocol store document. */
export function findSoAAssessmentDefinition(
  soaAssessmentDefinitionId: string
): SoAAssessmentDefinitionLocation | null {
  return findSoAAssessmentDefinitionInDocument(getProtocolDocument(), soaAssessmentDefinitionId);
}

/** Returns whether a SoA assessment definition id exists in a protocol document. */
export function soaAssessmentDefinitionExistsInDocument(
  document: ProtocolDocument,
  soaAssessmentDefinitionId: string
): boolean {
  return findSoAAssessmentDefinitionInDocument(document, soaAssessmentDefinitionId) !== null;
}

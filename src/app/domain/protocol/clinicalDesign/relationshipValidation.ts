import type { ProtocolDocument } from '../types';
import { CLINICAL_DESIGN_COLLECTION_KEYS } from './constants';
import type { ClinicalDesignValidationMessage } from './entityValidation';

function collectClinicalDesignEntityIds(document: ProtocolDocument): Set<string> {
  const ids = new Set<string>();

  for (const collectionKey of CLINICAL_DESIGN_COLLECTION_KEYS) {
    const collection = document.clinicalDesign[collectionKey];
    if (collection?.length) {
      for (const entity of collection) {
        ids.add(entity.id);
      }
    }
  }

  return ids;
}

function relationshipTupleKey(sourceId: string, targetId: string, kind?: string): string {
  return `${sourceId}\0${targetId}\0${kind ?? ''}`;
}

/** Validates relationship integrity against clinical design entities in a protocol document. */
export function validateRelationships(
  document: ProtocolDocument,
  errors: ClinicalDesignValidationMessage[],
  warnings: ClinicalDesignValidationMessage[]
): void {
  const clinicalDesignEntityIds = collectClinicalDesignEntityIds(document);
  const seenRelationshipIds = new Map<string, string>();
  const seenRelationshipTuples = new Map<string, string>();

  document.relationships.forEach((relationship, index) => {
    const path = `relationships[${index}]`;

    const previousIdPath = seenRelationshipIds.get(relationship.id);
    if (previousIdPath) {
      errors.push({
        code: 'duplicate_relationship_id',
        path,
        message: `Duplicate relationship id "${relationship.id}" (also declared at ${previousIdPath})`,
      });
    } else {
      seenRelationshipIds.set(relationship.id, path);
    }

    if (!clinicalDesignEntityIds.has(relationship.sourceId)) {
      errors.push({
        code: 'invalid_relationship_source',
        path: `${path}.sourceId`,
        message: `sourceId "${relationship.sourceId}" does not match any clinical design entity id`,
      });
    }

    if (!clinicalDesignEntityIds.has(relationship.targetId)) {
      errors.push({
        code: 'invalid_relationship_target',
        path: `${path}.targetId`,
        message: `targetId "${relationship.targetId}" does not match any clinical design entity id`,
      });
    }

    if (relationship.sourceId === relationship.targetId) {
      warnings.push({
        code: 'relationship_self_loop',
        path,
        message: `Relationship "${relationship.id}" references the same entity for source and target`,
      });
    }

    const tupleKey = relationshipTupleKey(relationship.sourceId, relationship.targetId, relationship.kind);
    const previousTuplePath = seenRelationshipTuples.get(tupleKey);
    if (previousTuplePath) {
      warnings.push({
        code: 'duplicate_relationship_tuple',
        path,
        message: `Duplicate relationship tuple sourceId="${relationship.sourceId}", targetId="${relationship.targetId}", kind="${relationship.kind ?? ''}" (also declared at ${previousTuplePath})`,
      });
    } else {
      seenRelationshipTuples.set(tupleKey, path);
    }
  });
}

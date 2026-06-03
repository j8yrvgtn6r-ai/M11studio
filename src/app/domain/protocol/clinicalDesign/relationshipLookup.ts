import type { ProtocolDocument, ProtocolRelationship } from '../types';
import { getProtocolDocument } from '../store/protocolStore';

export interface RelationshipLocation {
  relationship: ProtocolRelationship;
  index: number;
}

/** Finds a relationship by id within a protocol document. */
export function findRelationshipInDocument(
  document: ProtocolDocument,
  relationshipId: string
): RelationshipLocation | null {
  const index = document.relationships.findIndex((relationship) => relationship.id === relationshipId);
  if (index < 0) {
    return null;
  }

  return {
    relationship: document.relationships[index],
    index,
  };
}

/** Finds a relationship by id in the authoritative protocol store document. */
export function findRelationship(relationshipId: string): RelationshipLocation | null {
  return findRelationshipInDocument(getProtocolDocument(), relationshipId);
}

/** Returns whether a relationship id exists in the authoritative store document. */
export function relationshipExists(relationshipId: string): boolean {
  return findRelationship(relationshipId) !== null;
}

/** Finds relationships whose source or target references the given entity id. */
export function findRelationshipsReferencingEntityInDocument(
  document: ProtocolDocument,
  entityId: string
): ProtocolRelationship[] {
  return document.relationships.filter(
    (relationship) => relationship.sourceId === entityId || relationship.targetId === entityId
  );
}

/** Returns whether any relationship references the given entity id. */
export function entityHasRelationshipReferences(entityId: string): boolean {
  return findRelationshipsReferencingEntityInDocument(getProtocolDocument(), entityId).length > 0;
}

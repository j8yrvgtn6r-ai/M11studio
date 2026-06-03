import type { ProtocolRelationship, RelationshipKind } from '../types';
import { findDesignEntityInDocument } from '../clinicalDesign/entityLookup';
import { findRelationshipInDocument } from '../clinicalDesign/relationshipLookup';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';

export type CreateRelationshipInput = {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  kind?: RelationshipKind;
};

export type UpdateRelationshipPatch = Partial<
  Pick<ProtocolRelationship, 'sourceId' | 'targetId' | 'label' | 'kind'>
>;

function designEntityExistsInDocument(document: ReturnType<typeof getProtocolDocument>, entityId: string): boolean {
  return findDesignEntityInDocument(document, entityId) !== null;
}

function relationshipEndpointsExist(
  document: ReturnType<typeof getProtocolDocument>,
  sourceId: string,
  targetId: string
): boolean {
  return (
    designEntityExistsInDocument(document, sourceId) &&
    designEntityExistsInDocument(document, targetId)
  );
}

/** Creates a relationship when id and endpoints are valid and id is unique. */
export function createRelationship(input: CreateRelationshipInput): boolean {
  const document = getProtocolDocument();

  if (findRelationshipInDocument(document, input.id)) {
    return false;
  }

  if (!relationshipEndpointsExist(document, input.sourceId, input.targetId)) {
    return false;
  }

  let created = false;

  mutateProtocolDocument((draft) => {
    if (findRelationshipInDocument(draft, input.id)) {
      return;
    }

    if (!relationshipEndpointsExist(draft, input.sourceId, input.targetId)) {
      return;
    }

    const relationship: ProtocolRelationship = {
      id: input.id,
      sourceId: input.sourceId,
      targetId: input.targetId,
    };

    if (input.label !== undefined) {
      relationship.label = input.label;
    }

    if (input.kind !== undefined) {
      relationship.kind = input.kind;
    }

    draft.relationships.push(relationship);
    draft.metadata.updatedAt = new Date().toISOString();
    created = true;
  });

  return created;
}

/** Updates an existing relationship when endpoints remain valid. */
export function updateRelationship(relationshipId: string, patch: UpdateRelationshipPatch): boolean {
  const document = getProtocolDocument();
  const location = findRelationshipInDocument(document, relationshipId);

  if (!location) {
    return false;
  }

  const nextSourceId = patch.sourceId ?? location.relationship.sourceId;
  const nextTargetId = patch.targetId ?? location.relationship.targetId;

  if (!relationshipEndpointsExist(document, nextSourceId, nextTargetId)) {
    return false;
  }

  let updated = false;

  mutateProtocolDocument((draft) => {
    const draftLocation = findRelationshipInDocument(draft, relationshipId);
    if (!draftLocation) {
      return;
    }

    const resolvedSourceId = patch.sourceId ?? draftLocation.relationship.sourceId;
    const resolvedTargetId = patch.targetId ?? draftLocation.relationship.targetId;

    if (!relationshipEndpointsExist(draft, resolvedSourceId, resolvedTargetId)) {
      return;
    }

    if (patch.sourceId !== undefined) {
      draftLocation.relationship.sourceId = patch.sourceId;
    }

    if (patch.targetId !== undefined) {
      draftLocation.relationship.targetId = patch.targetId;
    }

    if (patch.label !== undefined) {
      draftLocation.relationship.label = patch.label;
    }

    if (patch.kind !== undefined) {
      draftLocation.relationship.kind = patch.kind;
    }

    draft.metadata.updatedAt = new Date().toISOString();
    updated = true;
  });

  return updated;
}

/** Deletes a relationship by id. Returns false when not found. */
export function deleteRelationship(relationshipId: string): boolean {
  let deleted = false;

  mutateProtocolDocument((document) => {
    const index = document.relationships.findIndex((relationship) => relationship.id === relationshipId);
    if (index < 0) {
      return;
    }

    document.relationships.splice(index, 1);
    document.metadata.updatedAt = new Date().toISOString();
    deleted = true;
  });

  return deleted;
}

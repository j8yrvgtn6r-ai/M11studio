import type { DesignEntity } from '../types';
import { getDesignEntityCollectionKey } from '../clinicalDesign/constants';
import { findDesignEntityInDocument } from '../clinicalDesign/entityLookup';
import { isValidSectionRef } from '../clinicalDesign/entityValidation';
import { findRelationshipsReferencingEntityInDocument } from '../clinicalDesign/relationshipLookup';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';

export type CreateDesignEntityInput = {
  id: string;
  type: DesignEntity['type'];
  name: string;
  description?: string;
  sectionRef?: string;
  status: DesignEntity['status'];
  metadata?: Record<string, unknown>;
};

function canCreateDesignEntity(
  document: ReturnType<typeof getProtocolDocument>,
  input: CreateDesignEntityInput
): boolean {
  const collectionKey = getDesignEntityCollectionKey(input.type);
  if (!collectionKey) {
    return false;
  }

  if (findDesignEntityInDocument(document, input.id)) {
    return false;
  }

  if (input.sectionRef !== undefined && !isValidSectionRef(document, input.sectionRef)) {
    return false;
  }

  return true;
}

/** Creates a design entity in the proper clinical design collection when input is valid. */
export function createDesignEntity(input: CreateDesignEntityInput): boolean {
  const document = getProtocolDocument();

  if (!canCreateDesignEntity(document, input)) {
    return false;
  }

  const collectionKey = getDesignEntityCollectionKey(input.type);
  if (!collectionKey) {
    return false;
  }

  let created = false;

  mutateProtocolDocument((draft) => {
    if (!canCreateDesignEntity(draft, input)) {
      return;
    }

    const resolvedCollectionKey = getDesignEntityCollectionKey(input.type);
    if (!resolvedCollectionKey) {
      return;
    }

    const entity: DesignEntity = {
      id: input.id,
      type: input.type,
      name: input.name,
      status: [...input.status],
    };

    if (input.description !== undefined) {
      entity.description = input.description;
    }

    if (input.sectionRef !== undefined) {
      entity.sectionRef = input.sectionRef;
    }

    if (input.metadata !== undefined) {
      entity.metadata = { ...input.metadata };
    }

    const collection = draft.clinicalDesign[resolvedCollectionKey];
    if (collection) {
      collection.push(entity);
    } else {
      draft.clinicalDesign[resolvedCollectionKey] = [entity];
    }

    draft.metadata.updatedAt = new Date().toISOString();
    created = true;
  });

  return created;
}

/** Deletes a design entity when it exists and is not referenced by relationships. */
export function deleteDesignEntity(entityId: string): boolean {
  const document = getProtocolDocument();
  const location = findDesignEntityInDocument(document, entityId);

  if (!location) {
    return false;
  }

  if (findRelationshipsReferencingEntityInDocument(document, entityId).length > 0) {
    return false;
  }

  let deleted = false;

  mutateProtocolDocument((draft) => {
    const draftLocation = findDesignEntityInDocument(draft, entityId);
    if (!draftLocation) {
      return;
    }

    if (findRelationshipsReferencingEntityInDocument(draft, entityId).length > 0) {
      return;
    }

    const collection = draft.clinicalDesign[draftLocation.collectionKey];
    if (!collection) {
      return;
    }

    collection.splice(draftLocation.index, 1);
    draft.metadata.updatedAt = new Date().toISOString();
    deleted = true;
  });

  return deleted;
}

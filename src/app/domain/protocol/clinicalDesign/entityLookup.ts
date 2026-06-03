import type { DesignEntity, ProtocolDocument } from '../types';
import { getProtocolDocument } from '../store/protocolStore';
import { CLINICAL_DESIGN_COLLECTION_KEYS, type ClinicalDesignCollectionKey } from './constants';

export { CLINICAL_DESIGN_COLLECTION_KEYS, getDesignEntityCollectionKey } from './constants';
export type { ClinicalDesignCollectionKey } from './constants';

export interface DesignEntityLocation {
  entity: DesignEntity;
  collectionKey: ClinicalDesignCollectionKey;
  index: number;
}

/** Returns all design entities across every populated clinical design collection. */
export function collectAllDesignEntities(
  document: ProtocolDocument = getProtocolDocument()
): DesignEntity[] {
  const entities: DesignEntity[] = [];

  for (const collectionKey of CLINICAL_DESIGN_COLLECTION_KEYS) {
    const collection = document.clinicalDesign[collectionKey];
    if (collection?.length) {
      entities.push(...collection);
    }
  }

  return entities;
}

/** Finds a design entity by id within a protocol document. */
export function findDesignEntityInDocument(
  document: ProtocolDocument,
  entityId: string
): DesignEntityLocation | null {
  for (const collectionKey of CLINICAL_DESIGN_COLLECTION_KEYS) {
    const collection = document.clinicalDesign[collectionKey];
    if (!collection?.length) {
      continue;
    }

    const index = collection.findIndex((entity) => entity.id === entityId);
    if (index >= 0) {
      return {
        entity: collection[index],
        collectionKey,
        index,
      };
    }
  }

  return null;
}

/** Finds a design entity by id in the authoritative protocol store document. */
export function findDesignEntity(entityId: string): DesignEntityLocation | null {
  return findDesignEntityInDocument(getProtocolDocument(), entityId);
}

/** Returns whether a design entity id exists in the authoritative store document. */
export function designEntityExists(entityId: string): boolean {
  return findDesignEntityInDocument(getProtocolDocument(), entityId) !== null;
}

/** Returns whether a design entity id exists in a protocol document. */
export function designEntityExistsInDocument(document: ProtocolDocument, entityId: string): boolean {
  return findDesignEntityInDocument(document, entityId) !== null;
}

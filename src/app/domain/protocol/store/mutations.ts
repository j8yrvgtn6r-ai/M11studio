import type { DesignEntity, ProtocolElement } from '../types';
import { isValidSectionRef } from '../clinicalDesign/entityValidation';
import { findDesignEntityInDocument } from '../clinicalDesign/entityLookup';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';
/**
 * Updates a protocol element's value by id in the authoritative store document.
 * Returns true when a matching element was found and updated.
 */
export function updateElementValue(elementId: string, value: unknown): boolean {
  let updated = false;

  mutateProtocolDocument((document) => {
    const element = document.elements.find((item) => item.id === elementId);
    if (!element) {
      return;
    }

    element.value = value;
    document.metadata.updatedAt = new Date().toISOString();
    updated = true;
  });

  return updated;
}

/** Alias for {@link updateElementValue}. */
export function updateElement(elementId: string, value: unknown): boolean {
  return updateElementValue(elementId, value);
}

export type UpdateElementPatch = Pick<ProtocolElement, 'value'>;

export type UpdateDesignEntityPatch = Partial<
  Pick<DesignEntity, 'name' | 'description' | 'sectionRef' | 'status' | 'metadata'>
>;

/**
 * Updates an existing clinical design entity by id in the authoritative store document.
 * Returns true when a matching entity was found and updated.
 */
export function updateDesignEntity(entityId: string, patch: UpdateDesignEntityPatch): boolean {
  if (patch.sectionRef !== undefined && !isValidSectionRef(getProtocolDocument(), patch.sectionRef)) {
    return false;
  }

  let updated = false;
  mutateProtocolDocument((document) => {
    const location = findDesignEntityInDocument(document, entityId);
    if (!location) {
      return;
    }

    const { entity } = location;

    if (patch.name !== undefined) {
      entity.name = patch.name;
    }

    if (patch.description !== undefined) {
      entity.description = patch.description;
    }

    if (patch.sectionRef !== undefined) {
      entity.sectionRef = patch.sectionRef;
    }

    if (patch.status !== undefined) {
      entity.status = [...patch.status];
    }

    if (patch.metadata !== undefined) {
      entity.metadata = { ...entity.metadata, ...patch.metadata };
    }

    document.metadata.updatedAt = new Date().toISOString();
    updated = true;
  });

  return updated;
}

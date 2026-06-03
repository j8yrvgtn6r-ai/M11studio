import type { ProtocolElement } from '../types';
import { mutateProtocolDocument } from './protocolStore';

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

import type { DesignEntity, ProtocolDocument, SectionNode } from '../types';
import { CLINICAL_DESIGN_COLLECTION_KEYS, getDesignEntityCollectionKey } from './constants';
import type { ClinicalDesignCollectionKey } from './constants';

export interface ClinicalDesignValidationMessage {
  code: string;
  message: string;
  path?: string;
}

export function collectSectionIds(sections: SectionNode[]): Set<string> {
  const ids = new Set<string>();

  const walk = (nodes: SectionNode[]) => {
    for (const node of nodes) {
      ids.add(node.id);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(sections);
  return ids;
}

export function isValidSectionRef(document: ProtocolDocument, sectionRef: string): boolean {
  return collectSectionIds(document.sections ?? []).has(sectionRef);
}

export function isEntityTypeCompatibleWithCollection(
  collectionKey: ClinicalDesignCollectionKey,
  type: DesignEntity['type']
): boolean {
  const expectedCollection = getDesignEntityCollectionKey(type);
  if (!expectedCollection) {
    return true;
  }

  return expectedCollection === collectionKey;
}

export function validateClinicalDesignEntities(
  document: ProtocolDocument,
  errors: ClinicalDesignValidationMessage[],
  warnings: ClinicalDesignValidationMessage[]
): void {
  const sectionIds = collectSectionIds(document.sections ?? []);
  const seenEntityIds = new Map<string, string>();

  for (const collectionKey of CLINICAL_DESIGN_COLLECTION_KEYS) {
    const collection = document.clinicalDesign[collectionKey];
    if (!collection?.length) {
      continue;
    }

    collection.forEach((entity, index) => {
      const path = `clinicalDesign.${collectionKey}[${index}]`;

      const previousPath = seenEntityIds.get(entity.id);
      if (previousPath) {
        errors.push({
          code: 'duplicate_design_entity_id',
          path,
          message: `Duplicate design entity id "${entity.id}" (also declared at ${previousPath})`,
        });
      } else {
        seenEntityIds.set(entity.id, path);
      }

      if (entity.sectionRef && !sectionIds.has(entity.sectionRef)) {
        errors.push({
          code: 'invalid_design_entity_section_ref',
          path: `${path}.sectionRef`,
          message: `sectionRef "${entity.sectionRef}" does not match any section id`,
        });
      }

      if (!isEntityTypeCompatibleWithCollection(collectionKey, entity.type)) {
        errors.push({
          code: 'design_entity_type_mismatch',
          path: `${path}.type`,
          message: `type "${entity.type}" is not compatible with collection "${collectionKey}"`,
        });
      } else if (!getDesignEntityCollectionKey(entity.type)) {
        warnings.push({
          code: 'design_entity_unmapped_type',
          path: `${path}.type`,
          message: `type "${entity.type}" has no expected clinical design collection mapping`,
        });
      }
    });
  }
}

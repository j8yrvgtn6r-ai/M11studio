import type { DesignEntity, ProtocolElement } from '../types';
import { isValidSectionRef } from '../clinicalDesign/entityValidation';
import { findDesignEntityInDocument } from '../clinicalDesign/entityLookup';
import { syncTitlePageSectionStatus, TITLE_PAGE_SECTION_ID } from '../authoring/titlePageAuthoring';
import { serializeTitlePageFieldsToText } from '../authoring/titlePageValidation';
import { getProtocolImportState, updateSectionImportDraft } from '../import/protocolImportStore';
import { updateSectionGenerationState } from '../build/protocolBuildConsoleStore';
import { selectFieldDefinitions } from '../selectors/toFieldDefinitions';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';

function syncTitlePageImportDraftFromFields(fields: ReturnType<typeof selectFieldDefinitions>): void {
  const draft = getProtocolImportState().sectionDrafts[TITLE_PAGE_SECTION_ID];
  if (!draft) {
    return;
  }

  const narrative = serializeTitlePageFieldsToText(fields);
  const wasValidated =
    draft.workflowState === 'validated' ||
    draft.state === 'validationPassed' ||
    draft.state === 'approved';
  const narrativeChanged = narrative !== (draft.generatedText ?? '').trim();

  if (!narrativeChanged && !wasValidated) {
    return;
  }

  const now = new Date().toISOString();
  updateSectionImportDraft(TITLE_PAGE_SECTION_ID, {
    generatedText: narrative,
    sourceText: draft.sourceText ?? narrative,
    generatedAt: now,
    workflowState: wasValidated || narrativeChanged ? 'importedUnvalidated' : draft.workflowState,
    validatedTargetText: wasValidated ? undefined : draft.validatedTargetText,
    validationChanges: wasValidated ? undefined : draft.validationChanges,
    validationFindings: wasValidated ? [] : draft.validationFindings,
    validationMessages: wasValidated ? [] : draft.validationMessages,
    validationStatus: wasValidated ? 'not-run' : draft.validationStatus,
    state: wasValidated ? 'pendingReview' : draft.state,
  });

  if (wasValidated || narrativeChanged) {
    updateSectionGenerationState(TITLE_PAGE_SECTION_ID, 'importedUnvalidated');
  }
}
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
    if (element.sectionId === TITLE_PAGE_SECTION_ID) {
      const fields = selectFieldDefinitions(document);
      syncTitlePageSectionStatus(document, fields);
      syncTitlePageImportDraftFromFields(fields);
    }
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

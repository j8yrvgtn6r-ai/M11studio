import type { ProtocolDocument, SoAAssessmentDefinition } from '../types';
import { collectClinicalDesignAssessmentIds } from '../assessmentScheduleRule/assessmentRefs';
import { selectAssessmentScheduleRulesForAssessment } from '../assessmentScheduleRule/lookup';
import { collectSectionIds } from '../clinicalDesign/entityValidation';
import {
  findSoAAssessmentDefinitionInDocument,
  soaAssessmentDefinitionExistsInDocument,
} from '../soaAssessmentDefinition/lookup';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';
import { regenerateScheduleCacheAfterMutation } from './scheduleCacheMutations';

export type CreateSoAAssessmentDefinitionInput = {
  id: string;
  label: string;
  category: string;
  order: number;
  linkedSectionId?: string;
  clinicalDesignAssessmentId?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateSoAAssessmentDefinitionPatch = Partial<
  Omit<CreateSoAAssessmentDefinitionInput, 'id'>
>;

export type SoAAssessmentDefinitionMutationFailure =
  | 'duplicate_id'
  | 'missing_id'
  | 'missing_label'
  | 'missing_category'
  | 'invalid_order'
  | 'invalid_linked_section'
  | 'invalid_clinical_design_assessment'
  | 'not_found'
  | 'referenced_by_rules';

const FAILURE_MESSAGES: Record<SoAAssessmentDefinitionMutationFailure, string> = {
  duplicate_id: 'A SoA assessment with this id already exists.',
  missing_id: 'Id is required.',
  missing_label: 'Label is required.',
  missing_category: 'Category is required.',
  invalid_order: 'Order must be a finite number.',
  invalid_linked_section: 'Linked section id does not match any protocol section.',
  invalid_clinical_design_assessment:
    'Clinical design assessment id does not match any clinicalDesign.assessments entry.',
  not_found: 'SoA assessment definition was not found.',
  referenced_by_rules:
    'Cannot delete: one or more assessment schedule rules reference this assessment.',
};

export function describeSoAAssessmentDefinitionMutationFailure(
  failure: SoAAssessmentDefinitionMutationFailure,
): string {
  return FAILURE_MESSAGES[failure];
}

function isValidOrderValue(order: unknown): order is number {
  return typeof order === 'number' && Number.isFinite(order);
}

function validateCreateInput(
  document: ProtocolDocument,
  input: CreateSoAAssessmentDefinitionInput,
): SoAAssessmentDefinitionMutationFailure | null {
  const id = input.id?.trim();
  if (!id) {
    return 'missing_id';
  }

  if (soaAssessmentDefinitionExistsInDocument(document, id)) {
    return 'duplicate_id';
  }

  if (!input.label?.trim()) {
    return 'missing_label';
  }

  if (!input.category?.trim()) {
    return 'missing_category';
  }

  if (!isValidOrderValue(input.order)) {
    return 'invalid_order';
  }

  if (input.linkedSectionId !== undefined && input.linkedSectionId !== '') {
    const sectionIds = collectSectionIds(document.sections ?? []);
    if (!input.linkedSectionId.trim() || !sectionIds.has(input.linkedSectionId)) {
      return 'invalid_linked_section';
    }
  }

  if (input.clinicalDesignAssessmentId !== undefined && input.clinicalDesignAssessmentId !== '') {
    if (!collectClinicalDesignAssessmentIds(document).has(input.clinicalDesignAssessmentId)) {
      return 'invalid_clinical_design_assessment';
    }
  }

  return null;
}

function validateUpdatePatch(
  document: ProtocolDocument,
  patch: UpdateSoAAssessmentDefinitionPatch,
): SoAAssessmentDefinitionMutationFailure | null {
  if (patch.label !== undefined && !patch.label.trim()) {
    return 'missing_label';
  }

  if (patch.category !== undefined && !patch.category.trim()) {
    return 'missing_category';
  }

  if (patch.order !== undefined && !isValidOrderValue(patch.order)) {
    return 'invalid_order';
  }

  if (patch.linkedSectionId !== undefined && patch.linkedSectionId !== '') {
    const sectionIds = collectSectionIds(document.sections ?? []);
    if (!patch.linkedSectionId.trim() || !sectionIds.has(patch.linkedSectionId)) {
      return 'invalid_linked_section';
    }
  }

  if (patch.clinicalDesignAssessmentId !== undefined && patch.clinicalDesignAssessmentId !== '') {
    if (!collectClinicalDesignAssessmentIds(document).has(patch.clinicalDesignAssessmentId)) {
      return 'invalid_clinical_design_assessment';
    }
  }

  return null;
}

function applySoAAssessmentDefinitionPatch(
  definition: SoAAssessmentDefinition,
  patch: UpdateSoAAssessmentDefinitionPatch,
): void {
  if (patch.label !== undefined) {
    definition.label = patch.label.trim();
  }

  if (patch.category !== undefined) {
    definition.category = patch.category.trim();
  }

  if (patch.order !== undefined) {
    definition.order = patch.order;
  }

  if (patch.linkedSectionId !== undefined) {
    const trimmed = patch.linkedSectionId.trim();
    definition.linkedSectionId = trimmed || undefined;
  }

  if (patch.clinicalDesignAssessmentId !== undefined) {
    const trimmed = patch.clinicalDesignAssessmentId.trim();
    definition.clinicalDesignAssessmentId = trimmed || undefined;
  }

  if (patch.metadata !== undefined) {
    definition.metadata = { ...patch.metadata };
  }
}

/** Returns a validation failure code for create input, or null when valid. */
export function getCreateSoAAssessmentDefinitionFailure(
  document: ProtocolDocument,
  input: CreateSoAAssessmentDefinitionInput,
): SoAAssessmentDefinitionMutationFailure | null {
  return validateCreateInput(document, input);
}

/** Returns a validation failure code for update patch, or null when valid. */
export function getUpdateSoAAssessmentDefinitionFailure(
  document: ProtocolDocument,
  patch: UpdateSoAAssessmentDefinitionPatch,
): SoAAssessmentDefinitionMutationFailure | null {
  return validateUpdatePatch(document, patch);
}

/** Creates a SoA assessment definition when input is valid and id is unique. */
export function createSoAAssessmentDefinition(input: CreateSoAAssessmentDefinitionInput): boolean {
  const document = getProtocolDocument();
  if (validateCreateInput(document, input)) {
    return false;
  }

  let created = false;

  mutateProtocolDocument((draft) => {
    if (validateCreateInput(draft, input)) {
      return;
    }

    if (!draft.soaAssessmentDefinitions) {
      draft.soaAssessmentDefinitions = [];
    }

    const definition: SoAAssessmentDefinition = {
      id: input.id.trim(),
      label: input.label.trim(),
      category: input.category.trim(),
      order: input.order,
    };

    if (input.linkedSectionId?.trim()) {
      definition.linkedSectionId = input.linkedSectionId.trim();
    }

    if (input.clinicalDesignAssessmentId?.trim()) {
      definition.clinicalDesignAssessmentId = input.clinicalDesignAssessmentId.trim();
    }

    if (input.metadata !== undefined) {
      definition.metadata = { ...input.metadata };
    }

    draft.soaAssessmentDefinitions.push(definition);
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    created = true;
  });

  return created;
}

/** Updates an existing SoA assessment definition by id. Id cannot be changed. */
export function updateSoAAssessmentDefinition(
  soaAssessmentDefinitionId: string,
  patch: UpdateSoAAssessmentDefinitionPatch,
): boolean {
  const document = getProtocolDocument();
  if (!findSoAAssessmentDefinitionInDocument(document, soaAssessmentDefinitionId)) {
    return false;
  }

  if (validateUpdatePatch(document, patch)) {
    return false;
  }

  let updated = false;

  mutateProtocolDocument((draft) => {
    const location = findSoAAssessmentDefinitionInDocument(draft, soaAssessmentDefinitionId);
    if (!location) {
      return;
    }

    if (validateUpdatePatch(draft, patch)) {
      return;
    }

    applySoAAssessmentDefinitionPatch(location.soaAssessmentDefinition, patch);
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    updated = true;
  });

  return updated;
}

/** Deletes a SoA assessment definition when no schedule rules reference it. */
export function deleteSoAAssessmentDefinition(soaAssessmentDefinitionId: string): boolean {
  const document = getProtocolDocument();
  if (!findSoAAssessmentDefinitionInDocument(document, soaAssessmentDefinitionId)) {
    return false;
  }

  if (selectAssessmentScheduleRulesForAssessment(document, soaAssessmentDefinitionId).length > 0) {
    return false;
  }

  let deleted = false;

  mutateProtocolDocument((draft) => {
    const location = findSoAAssessmentDefinitionInDocument(draft, soaAssessmentDefinitionId);
    if (!location) {
      return;
    }

    if (selectAssessmentScheduleRulesForAssessment(draft, soaAssessmentDefinitionId).length > 0) {
      return;
    }

    draft.soaAssessmentDefinitions.splice(location.index, 1);
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    deleted = true;
  });

  return deleted;
}

/** Returns whether delete would fail because schedule rules reference the assessment. */
export function soaAssessmentDefinitionHasScheduleRules(
  soaAssessmentDefinitionId: string,
  document: ProtocolDocument = getProtocolDocument(),
): boolean {
  return selectAssessmentScheduleRulesForAssessment(document, soaAssessmentDefinitionId).length > 0;
}

/** Maps delete failure to a mutation failure code when applicable. */
export function getDeleteSoAAssessmentDefinitionFailure(
  soaAssessmentDefinitionId: string,
  document: ProtocolDocument = getProtocolDocument(),
): SoAAssessmentDefinitionMutationFailure | null {
  if (!findSoAAssessmentDefinitionInDocument(document, soaAssessmentDefinitionId)) {
    return 'not_found';
  }

  if (soaAssessmentDefinitionHasScheduleRules(soaAssessmentDefinitionId, document)) {
    return 'referenced_by_rules';
  }

  return null;
}

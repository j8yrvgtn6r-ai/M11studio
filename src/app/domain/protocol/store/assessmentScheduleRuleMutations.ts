import type { AssessmentScheduleRule, ProtocolDocument, RelativeTiming, ScheduleCondition } from '../types';
import { collectSectionIds } from '../clinicalDesign/entityValidation';
import {
  assessmentScheduleRuleExistsInDocument,
  findAssessmentScheduleRuleInDocument,
} from '../assessmentScheduleRule/lookup';
import { buildAssessmentReferenceMetadata, isSoAAssessmentDefinitionId } from '../assessmentScheduleRule/assessmentRefs';
import { visitDefinitionExistsInDocument } from '../visitSchedule/lookup';
import { isValidVisitWindowBound } from '../visitSchedule/guards';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';
import { regenerateScheduleCacheAfterMutation } from './scheduleCacheMutations';

export type CreateAssessmentScheduleRuleInput = {
  id: string;
  assessmentId: string;
  visitDefinitionId: string;
  required: boolean;
  timingNote?: string;
  windowBeforeDays?: number;
  windowAfterDays?: number;
  relativeTiming?: RelativeTiming;
  condition?: ScheduleCondition;
  armRestrictions?: string[];
  repeats?: boolean;
  independentOfDoseDelay?: boolean;
  sourceSectionId?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateAssessmentScheduleRulePatch = Partial<
  Omit<CreateAssessmentScheduleRuleInput, 'id'>
>;

function ruleInputIsValid(
  document: ReturnType<typeof getProtocolDocument>,
  input: CreateAssessmentScheduleRuleInput | UpdateAssessmentScheduleRulePatch,
  options: { requireAssessmentId?: boolean; requireVisitDefinitionId?: boolean } = {}
): boolean {
  if (options.requireAssessmentId && !input.assessmentId?.trim()) {
    return false;
  }

  if (input.assessmentId !== undefined && !isSoAAssessmentDefinitionId(document, input.assessmentId)) {
    return false;
  }

  if (options.requireVisitDefinitionId && !input.visitDefinitionId?.trim()) {
    return false;
  }

  if (
    input.visitDefinitionId !== undefined &&
    !visitDefinitionExistsInDocument(document, input.visitDefinitionId)
  ) {
    return false;
  }

  if (input.sourceSectionId !== undefined) {
    const sectionIds = collectSectionIds(document.sections ?? []);
    if (!input.sourceSectionId.trim() || !sectionIds.has(input.sourceSectionId)) {
      return false;
    }
  }

  if (input.windowBeforeDays !== undefined && !isValidVisitWindowBound(input.windowBeforeDays)) {
    return false;
  }

  if (input.windowAfterDays !== undefined && !isValidVisitWindowBound(input.windowAfterDays)) {
    return false;
  }

  return true;
}

function applyAssessmentScheduleRulePatch(
  document: ProtocolDocument,
  rule: AssessmentScheduleRule,
  patch: UpdateAssessmentScheduleRulePatch
): void {
  if (patch.assessmentId !== undefined) {
    rule.assessmentId = patch.assessmentId;
    rule.metadata = {
      ...rule.metadata,
      ...buildAssessmentReferenceMetadata(document, patch.assessmentId),
    };
  }

  if (patch.visitDefinitionId !== undefined) {
    rule.visitDefinitionId = patch.visitDefinitionId;
  }

  if (patch.required !== undefined) {
    rule.required = patch.required;
  }

  if (patch.timingNote !== undefined) {
    rule.timingNote = patch.timingNote;
  }

  if (patch.windowBeforeDays !== undefined) {
    rule.windowBeforeDays = patch.windowBeforeDays;
  }

  if (patch.windowAfterDays !== undefined) {
    rule.windowAfterDays = patch.windowAfterDays;
  }

  if (patch.relativeTiming !== undefined) {
    rule.relativeTiming = patch.relativeTiming;
  }

  if (patch.condition !== undefined) {
    rule.condition = { ...patch.condition };
  }

  if (patch.armRestrictions !== undefined) {
    rule.armRestrictions = [...patch.armRestrictions];
  }

  if (patch.repeats !== undefined) {
    rule.repeats = patch.repeats;
  }

  if (patch.independentOfDoseDelay !== undefined) {
    rule.independentOfDoseDelay = patch.independentOfDoseDelay;
  }

  if (patch.sourceSectionId !== undefined) {
    rule.sourceSectionId = patch.sourceSectionId;
  }

  if (patch.metadata !== undefined) {
    rule.metadata = { ...rule.metadata, ...patch.metadata };
  }
}

/** Creates an assessment schedule rule when id and references are valid and id is unique. */
export function createAssessmentScheduleRule(input: CreateAssessmentScheduleRuleInput): boolean {
  const document = getProtocolDocument();

  if (assessmentScheduleRuleExistsInDocument(document, input.id)) {
    return false;
  }

  if (
    !ruleInputIsValid(document, input, {
      requireAssessmentId: true,
      requireVisitDefinitionId: true,
    })
  ) {
    return false;
  }

  let created = false;

  mutateProtocolDocument((draft) => {
    if (assessmentScheduleRuleExistsInDocument(draft, input.id)) {
      return;
    }

    if (
      !ruleInputIsValid(draft, input, {
        requireAssessmentId: true,
        requireVisitDefinitionId: true,
      })
    ) {
      return;
    }

    const rule: AssessmentScheduleRule = {
      id: input.id,
      assessmentId: input.assessmentId,
      visitDefinitionId: input.visitDefinitionId,
      required: input.required,
      metadata: {
        ...buildAssessmentReferenceMetadata(draft, input.assessmentId),
        ...input.metadata,
      },
    };

    applyAssessmentScheduleRulePatch(draft, rule, { ...input, metadata: undefined });
    draft.assessmentScheduleRules.push(rule);
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    created = true;
  });

  return created;
}

/** Updates an existing assessment schedule rule by id in the authoritative store document. */
export function updateAssessmentScheduleRule(
  ruleId: string,
  patch: UpdateAssessmentScheduleRulePatch
): boolean {
  const document = getProtocolDocument();
  if (!findAssessmentScheduleRuleInDocument(document, ruleId)) {
    return false;
  }

  if (!ruleInputIsValid(document, patch)) {
    return false;
  }

  let updated = false;

  mutateProtocolDocument((draft) => {
    const location = findAssessmentScheduleRuleInDocument(draft, ruleId);
    if (!location) {
      return;
    }

    if (!ruleInputIsValid(draft, patch)) {
      return;
    }

    applyAssessmentScheduleRulePatch(draft, location.rule, patch);
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    updated = true;
  });

  return updated;
}

/** Deletes an assessment schedule rule by id from the authoritative store document. */
export function deleteAssessmentScheduleRule(ruleId: string): boolean {
  const document = getProtocolDocument();
  if (!findAssessmentScheduleRuleInDocument(document, ruleId)) {
    return false;
  }

  let deleted = false;

  mutateProtocolDocument((draft) => {
    const index = draft.assessmentScheduleRules.findIndex((rule) => rule.id === ruleId);
    if (index < 0) {
      return;
    }

    draft.assessmentScheduleRules.splice(index, 1);
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    deleted = true;
  });

  return deleted;
}

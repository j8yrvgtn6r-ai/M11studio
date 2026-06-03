import type {
  MissedVisitPolicy,
  ReanchorPolicy,
  RipplePolicy,
  ScheduleAnchorType,
  VisitDefinitionType,
} from '../types';
import {
  findScheduleAnchorInDocument,
  findVisitDefinitionInDocument,
  visitDefinitionExistsInDocument,
} from '../visitSchedule/lookup';
import { isValidScheduleOffset, isValidVisitWindowBound } from '../visitSchedule/guards';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';
import { regenerateScheduleCacheAfterMutation } from './scheduleCacheMutations';

export type UpdateVisitDefinitionPatch = Partial<{
  name: string;
  visitType: VisitDefinitionType;
  epoch: string;
  cycleNumber: number;
  anchorId: string;
  offsetDays: number;
  offsetWeeks: number;
  offsetCycles: number;
  nominalDay: number;
  nominalWeek: number;
  windowBeforeDays: number;
  windowAfterDays: number;
  missedVisitPolicy: MissedVisitPolicy;
  reanchorPolicy: ReanchorPolicy;
  ripplePolicy: RipplePolicy;
  preserveOriginalSchedule: boolean;
  armRestrictions: string[];
  description: string;
  metadata: Record<string, unknown>;
}>;

export type UpdateScheduleAnchorPatch = Partial<{
  name: string;
  anchorType: ScheduleAnchorType;
  sourceVisitId: string;
  sourceEventType: string;
  description: string;
}>;

function visitDefinitionPatchIsValid(
  document: ReturnType<typeof getProtocolDocument>,
  patch: UpdateVisitDefinitionPatch
): boolean {
  if (patch.anchorId !== undefined) {
    if (!patch.anchorId.trim() || !findScheduleAnchorInDocument(document, patch.anchorId)) {
      return false;
    }
  }

  if (patch.windowBeforeDays !== undefined && !isValidVisitWindowBound(patch.windowBeforeDays)) {
    return false;
  }

  if (patch.windowAfterDays !== undefined && !isValidVisitWindowBound(patch.windowAfterDays)) {
    return false;
  }

  const offsetFields: Array<keyof Pick<
    UpdateVisitDefinitionPatch,
    'offsetDays' | 'offsetWeeks' | 'offsetCycles' | 'nominalDay' | 'nominalWeek' | 'cycleNumber'
  >> = ['offsetDays', 'offsetWeeks', 'offsetCycles', 'nominalDay', 'nominalWeek', 'cycleNumber'];

  for (const field of offsetFields) {
    const value = patch[field];
    if (value !== undefined && !isValidScheduleOffset(value)) {
      return false;
    }
  }

  return true;
}

function scheduleAnchorPatchIsValid(
  document: ReturnType<typeof getProtocolDocument>,
  anchorId: string,
  patch: UpdateScheduleAnchorPatch
): boolean {
  if (patch.sourceVisitId !== undefined) {
    if (!patch.sourceVisitId.trim() || !visitDefinitionExistsInDocument(document, patch.sourceVisitId)) {
      return false;
    }

    const anchorLocation = findScheduleAnchorInDocument(document, anchorId);
    const sourceVisit = findVisitDefinitionInDocument(document, patch.sourceVisitId);
    if (
      anchorLocation &&
      sourceVisit &&
      anchorLocation.anchor.anchorType === 'previous-visit' &&
      sourceVisit.visitDefinition.anchorId === anchorLocation.anchor.id
    ) {
      return false;
    }
  }

  return true;
}

/** Updates an existing visit definition by id in the authoritative store document. */
export function updateVisitDefinition(visitDefinitionId: string, patch: UpdateVisitDefinitionPatch): boolean {
  const document = getProtocolDocument();
  if (!findVisitDefinitionInDocument(document, visitDefinitionId)) {
    return false;
  }

  if (!visitDefinitionPatchIsValid(document, patch)) {
    return false;
  }

  let updated = false;

  mutateProtocolDocument((draft) => {
    const location = findVisitDefinitionInDocument(draft, visitDefinitionId);
    if (!location) {
      return;
    }

    if (patch.anchorId !== undefined && !findScheduleAnchorInDocument(draft, patch.anchorId)) {
      return;
    }

    if (!visitDefinitionPatchIsValid(draft, patch)) {
      return;
    }

    const { visitDefinition } = location;

    if (patch.name !== undefined) {
      visitDefinition.name = patch.name;
    }

    if (patch.visitType !== undefined) {
      visitDefinition.visitType = patch.visitType;
    }

    if (patch.epoch !== undefined) {
      visitDefinition.epoch = patch.epoch;
    }

    if (patch.cycleNumber !== undefined) {
      visitDefinition.cycleNumber = patch.cycleNumber;
    }

    if (patch.anchorId !== undefined) {
      visitDefinition.anchorId = patch.anchorId;
    }

    if (patch.offsetDays !== undefined) {
      visitDefinition.offsetDays = patch.offsetDays;
    }

    if (patch.offsetWeeks !== undefined) {
      visitDefinition.offsetWeeks = patch.offsetWeeks;
    }

    if (patch.offsetCycles !== undefined) {
      visitDefinition.offsetCycles = patch.offsetCycles;
    }

    if (patch.nominalDay !== undefined) {
      visitDefinition.nominalDay = patch.nominalDay;
    }

    if (patch.nominalWeek !== undefined) {
      visitDefinition.nominalWeek = patch.nominalWeek;
    }

    if (patch.windowBeforeDays !== undefined) {
      visitDefinition.windowBeforeDays = patch.windowBeforeDays;
    }

    if (patch.windowAfterDays !== undefined) {
      visitDefinition.windowAfterDays = patch.windowAfterDays;
    }

    if (patch.missedVisitPolicy !== undefined) {
      visitDefinition.missedVisitPolicy = patch.missedVisitPolicy;
    }

    if (patch.reanchorPolicy !== undefined) {
      visitDefinition.reanchorPolicy = patch.reanchorPolicy;
    }

    if (patch.ripplePolicy !== undefined) {
      visitDefinition.ripplePolicy = patch.ripplePolicy;
    }

    if (patch.preserveOriginalSchedule !== undefined) {
      visitDefinition.preserveOriginalSchedule = patch.preserveOriginalSchedule;
    }

    if (patch.armRestrictions !== undefined) {
      visitDefinition.armRestrictions = [...patch.armRestrictions];
    }

    if (patch.description !== undefined) {
      visitDefinition.description = patch.description;
    }

    if (patch.metadata !== undefined) {
      visitDefinition.metadata = { ...visitDefinition.metadata, ...patch.metadata };
    }

    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    updated = true;
  });

  return updated;
}

/** Updates an existing schedule anchor by id in the authoritative store document. */
export function updateScheduleAnchor(anchorId: string, patch: UpdateScheduleAnchorPatch): boolean {
  const document = getProtocolDocument();
  if (!findScheduleAnchorInDocument(document, anchorId)) {
    return false;
  }

  if (!scheduleAnchorPatchIsValid(document, anchorId, patch)) {
    return false;
  }

  let updated = false;

  mutateProtocolDocument((draft) => {
    const location = findScheduleAnchorInDocument(draft, anchorId);
    if (!location) {
      return;
    }

    if (!scheduleAnchorPatchIsValid(draft, anchorId, patch)) {
      return;
    }

    const { anchor } = location;

    if (patch.name !== undefined) {
      anchor.name = patch.name;
    }

    if (patch.anchorType !== undefined) {
      anchor.anchorType = patch.anchorType;
    }

    if (patch.sourceVisitId !== undefined) {
      anchor.sourceVisitId = patch.sourceVisitId;
    }

    if (patch.sourceEventType !== undefined) {
      anchor.sourceEventType = patch.sourceEventType;
    }

    if (patch.description !== undefined) {
      anchor.description = patch.description;
    }

    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    updated = true;
  });

  return updated;
}

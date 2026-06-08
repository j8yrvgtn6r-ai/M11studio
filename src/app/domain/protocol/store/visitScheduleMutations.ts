import type { ScheduleAnchor, ScheduleAnchorType, VisitDefinition, VisitDefinitionType } from '../types';
import { isValidVisitWindowBound } from '../visitSchedule/guards';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';
import { regenerateScheduleCacheAfterMutation } from './scheduleCacheMutations';

export type CreateScheduleAnchorInput = {
  id: string;
  name: string;
  anchorType: ScheduleAnchorType;
  description?: string;
  sourceVisitId?: string;
  sourceEventType?: string;
};

export type CreateVisitDefinitionInput = {
  id: string;
  name: string;
  visitType: VisitDefinitionType;
  anchorId: string;
  epoch?: string;
  order: number;
  required?: boolean;
  description?: string;
  nominalDay?: number;
  nominalWeek?: number;
  windowBeforeDays?: number;
  windowAfterDays?: number;
  offsetDays?: number;
  offsetWeeks?: number;
  metadata?: Record<string, unknown>;
};

function anchorExists(document: ReturnType<typeof getProtocolDocument>, anchorId: string): boolean {
  return (document.visitSchedule?.anchors ?? []).some((anchor) => anchor.id === anchorId);
}

export function createScheduleAnchor(input: CreateScheduleAnchorInput): boolean {
  const document = getProtocolDocument();
  if (anchorExists(document, input.id)) {
    return false;
  }
  if (!input.name.trim()) {
    return false;
  }

  let created = false;
  mutateProtocolDocument((draft) => {
    if (anchorExists(draft, input.id)) {
      return;
    }
    if (!draft.visitSchedule) {
      draft.visitSchedule = { anchors: [], visitDefinitions: [] };
    }
    const anchor: ScheduleAnchor = {
      id: input.id,
      name: input.name.trim(),
      anchorType: input.anchorType,
      description: input.description?.trim(),
      sourceVisitId: input.sourceVisitId,
      sourceEventType: input.sourceEventType,
    };
    draft.visitSchedule.anchors.push(anchor);
    draft.metadata.updatedAt = new Date().toISOString();
    created = true;
  });
  return created;
}

export function createVisitDefinition(input: CreateVisitDefinitionInput): boolean {
  const document = getProtocolDocument();
  if ((document.visitSchedule?.visitDefinitions ?? []).some((visit) => visit.id === input.id)) {
    return false;
  }
  if (!input.name.trim() || !input.anchorId.trim() || !anchorExists(document, input.anchorId)) {
    return false;
  }
  if (input.windowBeforeDays !== undefined && !isValidVisitWindowBound(input.windowBeforeDays)) {
    return false;
  }
  if (input.windowAfterDays !== undefined && !isValidVisitWindowBound(input.windowAfterDays)) {
    return false;
  }

  let created = false;
  mutateProtocolDocument((draft) => {
    if ((draft.visitSchedule?.visitDefinitions ?? []).some((visit) => visit.id === input.id)) {
      return;
    }
    if (!draft.visitSchedule) {
      draft.visitSchedule = { anchors: [], visitDefinitions: [] };
    }
    if (!anchorExists(draft, input.anchorId)) {
      return;
    }

    const visit: VisitDefinition = {
      id: input.id,
      name: input.name.trim(),
      visitType: input.visitType,
      anchorId: input.anchorId,
      epoch: input.epoch?.trim(),
      order: input.order,
      required: input.required ?? true,
      description: input.description?.trim(),
      nominalDay: input.nominalDay,
      nominalWeek: input.nominalWeek,
      windowBeforeDays: input.windowBeforeDays,
      windowAfterDays: input.windowAfterDays,
      offsetDays: input.offsetDays,
      offsetWeeks: input.offsetWeeks,
      metadata: {
        ...(input.metadata ?? {}),
        inferenceSource: 'user-created',
      },
    };
    draft.visitSchedule.visitDefinitions.push(visit);
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    created = true;
  });
  return created;
}

export function ensureDefaultScreeningAnchor(): string {
  const document = getProtocolDocument();
  const existing = document.visitSchedule?.anchors?.[0];
  if (existing) {
    return existing.id;
  }
  const anchorId = 'anchor-screening';
  createScheduleAnchor({
    id: anchorId,
    name: 'Screening',
    anchorType: 'screening',
    description: 'Default screening anchor for manual visit authoring.',
  });
  return anchorId;
}

export function updateScheduleAnchor(
  anchorId: string,
  patch: Partial<CreateScheduleAnchorInput>,
): boolean {
  const document = getProtocolDocument();
  if (!anchorExists(document, anchorId)) {
    return false;
  }
  if (patch.sourceVisitId !== undefined) {
    const visitExists = (document.visitSchedule?.visitDefinitions ?? []).some(
      (visit) => visit.id === patch.sourceVisitId,
    );
    if (!visitExists) {
      return false;
    }
  }
  let updated = false;
  mutateProtocolDocument((draft) => {
    const anchor = draft.visitSchedule?.anchors.find((item) => item.id === anchorId);
    if (!anchor) {
      return;
    }
    if (patch.name !== undefined) anchor.name = patch.name.trim();
    if (patch.anchorType !== undefined) anchor.anchorType = patch.anchorType;
    if (patch.description !== undefined) anchor.description = patch.description?.trim();
    if (patch.sourceVisitId !== undefined) anchor.sourceVisitId = patch.sourceVisitId;
    draft.metadata.updatedAt = new Date().toISOString();
    updated = true;
  });
  return updated;
}

export function deleteScheduleAnchor(anchorId: string): boolean {
  const document = getProtocolDocument();
  const usedByVisit = (document.visitSchedule?.visitDefinitions ?? []).some((visit) => visit.anchorId === anchorId);
  if (usedByVisit) {
    return false;
  }
  let deleted = false;
  mutateProtocolDocument((draft) => {
    const index = draft.visitSchedule?.anchors.findIndex((item) => item.id === anchorId) ?? -1;
    if (index < 0) {
      return;
    }
    draft.visitSchedule!.anchors.splice(index, 1);
    draft.metadata.updatedAt = new Date().toISOString();
    deleted = true;
  });
  return deleted;
}

export function updateVisitDefinition(
  visitId: string,
  patch: Partial<Omit<CreateVisitDefinitionInput, 'id'>>,
): boolean {
  const document = getProtocolDocument();
  const visit = document.visitSchedule?.visitDefinitions.find((item) => item.id === visitId);
  if (!visit) {
    return false;
  }
  if (patch.anchorId && !anchorExists(document, patch.anchorId)) {
    return false;
  }
  if (patch.windowBeforeDays !== undefined && !isValidVisitWindowBound(patch.windowBeforeDays)) {
    return false;
  }
  if (patch.windowAfterDays !== undefined && !isValidVisitWindowBound(patch.windowAfterDays)) {
    return false;
  }
  let updated = false;
  mutateProtocolDocument((draft) => {
    const target = draft.visitSchedule?.visitDefinitions.find((item) => item.id === visitId);
    if (!target) {
      return;
    }
    if (patch.name !== undefined) target.name = patch.name.trim();
    if (patch.visitType !== undefined) target.visitType = patch.visitType;
    if (patch.anchorId !== undefined) target.anchorId = patch.anchorId;
    if (patch.epoch !== undefined) target.epoch = patch.epoch?.trim();
    if (patch.required !== undefined) target.required = patch.required;
    if (patch.description !== undefined) target.description = patch.description?.trim();
    if (patch.nominalDay !== undefined) target.nominalDay = patch.nominalDay;
    if (patch.nominalWeek !== undefined) target.nominalWeek = patch.nominalWeek;
    if (patch.windowBeforeDays !== undefined) target.windowBeforeDays = patch.windowBeforeDays;
    if (patch.windowAfterDays !== undefined) target.windowAfterDays = patch.windowAfterDays;
    if (patch.offsetDays !== undefined) target.offsetDays = patch.offsetDays;
    if (patch.offsetWeeks !== undefined) target.offsetWeeks = patch.offsetWeeks;
    if (patch.order !== undefined) target.order = patch.order;
    target.metadata = { ...target.metadata, inferenceSource: 'user-modified' };
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    updated = true;
  });
  return updated;
}

export function deleteVisitDefinition(visitId: string): boolean {
  const document = getProtocolDocument();
  const hasRules = (document.assessmentScheduleRules ?? []).some((rule) => rule.visitDefinitionId === visitId);
  if (hasRules) {
    return false;
  }
  let deleted = false;
  mutateProtocolDocument((draft) => {
    const index = draft.visitSchedule?.visitDefinitions.findIndex((item) => item.id === visitId) ?? -1;
    if (index < 0) {
      return;
    }
    draft.visitSchedule!.visitDefinitions.splice(index, 1);
    draft.metadata.updatedAt = new Date().toISOString();
    regenerateScheduleCacheAfterMutation(draft);
    deleted = true;
  });
  return deleted;
}

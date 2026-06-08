import { getProtocolDocument } from '../protocol/store/protocolStore';
import { applyStudyDesignKnowledgeGraphPatchSafely } from './studyDesignGraphBridge';
import { setNarrativeImpactProposal } from './studyDesignProposalStore';
import { createNarrativeImpactProposal } from './synchronization/StudyDesignToNarrative';
import type {
  StudyDesign,
  StudyDesignDetectionSource,
  StudyDesignEntityFormValues,
  StudyDesignEntityKind,
  StudyDesignPatch,
  StudyDesignProvenance,
} from './StudyDesignTypes';

const STORAGE_KEY = 'm11-study-design-v1';

const listeners = new Set<() => void>();

let studyDesign: StudyDesign | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function persistModel(model: StudyDesign | null): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    if (!model) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Ignore storage failures.
  }
}

function loadPersistedModel(): StudyDesign | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeStudyDesign(JSON.parse(raw) as StudyDesign);
  } catch {
    return null;
  }
}

export function normalizeStudyDesign(model: StudyDesign): StudyDesign {
  return {
    ...model,
    anchors: model.anchors ?? [],
    milestones: (model.milestones ?? []).map((milestone) => ({
      ...milestone,
      description: milestone.description,
      anchorVisitId: milestone.anchorVisitId,
      offsetDays: milestone.offsetDays,
      offsetUnit: milestone.offsetUnit,
    })),
    visits: (model.visits ?? []).map((visit) => ({
      ...visit,
      scheduleAnchorId: visit.scheduleAnchorId,
      offsetDays: visit.offsetDays,
      offsetUnit: visit.offsetUnit ?? 'days',
      windowUnit: visit.windowUnit ?? 'days',
    })),
  };
}

function slugId(prefix: string, name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  return `study-${prefix}-${slug}-${Date.now().toString(36)}`;
}

function manualProvenance(): StudyDesignProvenance {
  const now = new Date().toISOString();
  return { source: 'manualEntry', createdAt: now, updatedAt: now };
}

function touchProvenance(existing?: StudyDesignProvenance): StudyDesignProvenance {
  const now = new Date().toISOString();
  return {
    source: 'manualEntry',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function emitNarrativeImpact(kind: StudyDesignEntityKind | 'epoch', entityId: string, entityName: string, changeType: 'added' | 'modified' | 'removed') {
  if (['visit', 'activity', 'milestone', 'epoch'].includes(kind)) {
    setNarrativeImpactProposal(createNarrativeImpactProposal({ entityKind: kind, entityId, entityName, changeType }));
  }
}

export function createEmptyStudyDesign(protocolId?: string): StudyDesign {
  const resolvedProtocolId = protocolId ?? getProtocolDocument().id ?? 'protocol-draft';
  return {
    id: `study-design-${resolvedProtocolId}`,
    protocolId: resolvedProtocolId,
    updatedAt: new Date().toISOString(),
    detectionSources: [],
    arms: [],
    cohorts: [],
    epochs: [],
    elements: [],
    anchors: [],
    visits: [],
    activities: [],
    milestones: [],
    scheduleRules: [],
  };
}

export function subscribeStudyDesign(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStudyDesign(): StudyDesign | null {
  if (!studyDesign) {
    studyDesign = loadPersistedModel();
  }
  return studyDesign;
}

export function setStudyDesign(model: StudyDesign): StudyDesign {
  studyDesign = normalizeStudyDesign({
    ...model,
    updatedAt: new Date().toISOString(),
  });
  persistModel(studyDesign);
  notify();
  return studyDesign;
}

function mergeCollection<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return [...map.values()];
}

function mergeDetectionSources(
  existing: StudyDesignDetectionSource[],
  incoming: StudyDesignDetectionSource[],
): StudyDesignDetectionSource[] {
  return [...new Set([...existing, ...incoming])];
}

export function patchStudyDesign(patch: StudyDesignPatch): StudyDesign {
  const base = getStudyDesign() ?? createEmptyStudyDesign();
  const next: StudyDesign = normalizeStudyDesign({
    ...base,
    arms: patch.arms ? mergeCollection(base.arms, patch.arms) : base.arms,
    cohorts: patch.cohorts ? mergeCollection(base.cohorts, patch.cohorts) : base.cohorts,
    epochs: patch.epochs ? mergeCollection(base.epochs, patch.epochs) : base.epochs,
    elements: patch.elements ? mergeCollection(base.elements, patch.elements) : base.elements,
    anchors: patch.anchors ? mergeCollection(base.anchors ?? [], patch.anchors) : base.anchors ?? [],
    visits: patch.visits ? mergeCollection(base.visits, patch.visits) : base.visits,
    activities: patch.activities ? mergeCollection(base.activities, patch.activities) : base.activities,
    milestones: patch.milestones ? mergeCollection(base.milestones, patch.milestones) : base.milestones,
    scheduleRules: patch.scheduleRules ? mergeCollection(base.scheduleRules, patch.scheduleRules) : base.scheduleRules,
    detectionSources: patch.detectionSources
      ? mergeDetectionSources(base.detectionSources, patch.detectionSources)
      : base.detectionSources,
    updatedAt: new Date().toISOString(),
  });
  const saved = setStudyDesign(next);
  applyStudyDesignKnowledgeGraphPatchSafely(saved);
  return saved;
}

export function clearStudyDesign(): void {
  studyDesign = null;
  persistModel(null);
  notify();
}

export function resetStudyDesignForTests(): void {
  clearStudyDesign();
}

function collectionForKind(model: StudyDesign, kind: StudyDesignEntityKind): Array<{ id: string; name: string }> {
  switch (kind) {
    case 'arm':
      return model.arms;
    case 'epoch':
      return model.epochs;
    case 'visit':
      return model.visits;
    case 'activity':
      return model.activities;
    case 'milestone':
      return model.milestones;
    case 'anchor':
      return model.anchors ?? [];
    default:
      return [];
  }
}

function patchCollectionReplace<T extends { id: string; name: string }>(
  kind: StudyDesignEntityKind,
  entity: T,
  model: StudyDesign,
): StudyDesignPatch {
  switch (kind) {
    case 'arm':
      return { arms: [entity as never] };
    case 'epoch':
      return { epochs: [entity as never] };
    case 'visit':
      return { visits: [entity as never] };
    case 'activity':
      return { activities: [entity as never] };
    case 'milestone':
      return { milestones: [entity as never] };
    case 'anchor':
      return { anchors: [entity as never] };
    default:
      return {};
  }
}

export function addManualStudyDesignEntity(
  kind: StudyDesignEntityKind,
  values: StudyDesignEntityFormValues,
): { success: boolean; entityId?: string; error?: string } {
  if (!values.name?.trim()) {
    return { success: false, error: 'Name is required.' };
  }
  if (kind === 'visit' && !values.epochId) {
    return { success: false, error: 'Epoch is required for visits.' };
  }

  const provenance = manualProvenance();
  const entityId = slugId(kind, values.name);

  switch (kind) {
    case 'arm':
      patchStudyDesign({
        arms: [{ id: entityId, name: values.name.trim(), type: values.type?.trim() || 'treatment', provenance }],
        detectionSources: ['manualEntry'],
      });
      break;
    case 'epoch':
      patchStudyDesign({
        epochs: [{ id: entityId, name: values.name.trim(), provenance }],
        detectionSources: ['manualEntry'],
      });
      emitNarrativeImpact('epoch', entityId, values.name.trim(), 'added');
      break;
    case 'anchor':
      patchStudyDesign({
        anchors: [
          {
            id: entityId,
            name: values.name.trim(),
            anchorType: values.type?.trim() || 'custom',
            description: values.description?.trim(),
            provenance,
          },
        ],
        detectionSources: ['manualEntry'],
      });
      break;
    case 'visit':
      patchStudyDesign({
        visits: [
          {
            id: entityId,
            name: values.name.trim(),
            visitClass: values.visitClass?.trim() || 'scheduled',
            epochId: values.epochId?.trim(),
            scheduleAnchorId: values.scheduleAnchorId?.trim(),
            offsetDays: values.offsetDays,
            offsetUnit: values.offsetUnit ?? 'days',
            nominalDay: values.nominalDay,
            nominalWeek: values.nominalWeek,
            windowBefore: values.windowBefore,
            windowAfter: values.windowAfter,
            windowUnit: values.windowUnit ?? 'days',
            provenance,
          },
        ],
        detectionSources: ['manualEntry'],
      });
      emitNarrativeImpact('visit', entityId, values.name.trim(), 'added');
      break;
    case 'activity':
      patchStudyDesign({
        activities: [
          {
            id: entityId,
            name: values.name.trim(),
            activityType: values.activityType?.trim() || 'assessment',
            description: values.description?.trim(),
            provenance,
          },
        ],
        detectionSources: ['manualEntry'],
      });
      emitNarrativeImpact('activity', entityId, values.name.trim(), 'added');
      break;
    case 'milestone':
      patchStudyDesign({
        milestones: [
          {
            id: entityId,
            name: values.name.trim(),
            description: values.description?.trim(),
            milestoneType: values.milestoneType?.trim() || 'custom',
            anchorVisitId: values.anchorVisitId?.trim(),
            offsetDays: values.offsetDays,
            offsetUnit: values.offsetUnit ?? 'days',
            provenance,
          },
        ],
        detectionSources: ['manualEntry'],
      });
      emitNarrativeImpact('milestone', entityId, values.name.trim(), 'added');
      break;
    default:
      return { success: false, error: `Unsupported entity kind: ${kind}` };
  }

  return { success: true, entityId };
}

export function updateManualStudyDesignEntity(
  kind: StudyDesignEntityKind,
  entityId: string,
  values: StudyDesignEntityFormValues,
): { success: boolean; error?: string } {
  const model = getStudyDesign();
  if (!model) return { success: false, error: 'No Study Design loaded.' };
  const collection = collectionForKind(model, kind);
  const existing = collection.find((item) => item.id === entityId);
  if (!existing) return { success: false, error: 'Entity not found.' };

  const provenance = touchProvenance((existing as { provenance?: StudyDesignProvenance }).provenance);
  const updated = {
    ...existing,
    name: values.name?.trim() || existing.name,
    provenance,
  } as never;

  if (kind === 'visit') {
    Object.assign(updated, {
      visitClass: values.visitClass ?? (existing as never).visitClass,
      epochId: values.epochId ?? (existing as never).epochId,
      scheduleAnchorId: values.scheduleAnchorId ?? (existing as never).scheduleAnchorId,
      offsetDays: values.offsetDays ?? (existing as never).offsetDays,
      offsetUnit: values.offsetUnit ?? (existing as never).offsetUnit,
      nominalDay: values.nominalDay ?? (existing as never).nominalDay,
      nominalWeek: values.nominalWeek ?? (existing as never).nominalWeek,
      windowBefore: values.windowBefore ?? (existing as never).windowBefore,
      windowAfter: values.windowAfter ?? (existing as never).windowAfter,
      windowUnit: values.windowUnit ?? (existing as never).windowUnit,
    });
  }
  if (kind === 'milestone') {
    Object.assign(updated, {
      description: values.description ?? (existing as never).description,
      milestoneType: values.milestoneType ?? (existing as never).milestoneType,
      anchorVisitId: values.anchorVisitId ?? (existing as never).anchorVisitId,
      offsetDays: values.offsetDays ?? (existing as never).offsetDays,
      offsetUnit: values.offsetUnit ?? (existing as never).offsetUnit,
    });
  }
  if (kind === 'activity') {
    Object.assign(updated, {
      activityType: values.activityType ?? (existing as never).activityType,
      description: values.description ?? (existing as never).description,
    });
  }

  patchStudyDesign(patchCollectionReplace(kind, updated, model));
  emitNarrativeImpact(kind, entityId, updated.name, 'modified');
  return { success: true };
}

export function deleteManualStudyDesignEntity(
  kind: StudyDesignEntityKind,
  entityId: string,
): { success: boolean; error?: string } {
  const model = getStudyDesign();
  if (!model) return { success: false, error: 'No Study Design loaded.' };
  const collection = collectionForKind(model, kind);
  const existing = collection.find((item) => item.id === entityId);
  if (!existing) return { success: false, error: 'Entity not found.' };

  const next = normalizeStudyDesign({
    ...model,
    arms: kind === 'arm' ? model.arms.filter((item) => item.id !== entityId) : model.arms,
    epochs: kind === 'epoch' ? model.epochs.filter((item) => item.id !== entityId) : model.epochs,
    visits: kind === 'visit' ? model.visits.filter((item) => item.id !== entityId) : model.visits,
    activities: kind === 'activity' ? model.activities.filter((item) => item.id !== entityId) : model.activities,
    milestones: kind === 'milestone' ? model.milestones.filter((item) => item.id !== entityId) : model.milestones,
    anchors: kind === 'anchor' ? (model.anchors ?? []).filter((item) => item.id !== entityId) : model.anchors ?? [],
  });

  setStudyDesign(next);
  applyStudyDesignKnowledgeGraphPatchSafely(next);
  emitNarrativeImpact(kind, entityId, existing.name, 'removed');
  return { success: true };
}

export function replaceStudyDesignFromSync(model: StudyDesign): StudyDesign {
  const saved = setStudyDesign(model);
  applyStudyDesignKnowledgeGraphPatchSafely(saved);
  return saved;
}

export function listScheduleAnchors() {
  return getStudyDesign()?.anchors ?? [];
}

export function listStudyDesignEpochs() {
  return getStudyDesign()?.epochs ?? [];
}

export function listStudyDesignVisits() {
  return getStudyDesign()?.visits ?? [];
}

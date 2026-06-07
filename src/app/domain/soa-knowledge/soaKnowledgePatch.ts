import type {
  SoAArm,
  SoAAssessment,
  SoACondition,
  SoAElement,
  SoAEpoch,
  SoAFootnote,
  SoAActivity,
  SoAKnowledgeModel,
  SoAKnowledgePatch,
  SoAProcedure,
  SoAScheduleRule,
  SoATimingWindow,
  SoAVisit,
} from './soaKnowledgeTypes';

export function normalizeSoAName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function createEmptySoAKnowledgeModel(protocolId?: string): SoAKnowledgeModel {
  const now = new Date().toISOString();
  return {
    id: `soa-knowledge-${protocolId ?? 'local'}`,
    protocolId,
    arms: [],
    epochs: [],
    elements: [],
    visits: [],
    activities: [],
    assessments: [],
    procedures: [],
    timingWindows: [],
    scheduleRules: [],
    conditions: [],
    footnotes: [],
    sourceSectionIds: [],
    extractionNotes: [],
    unmappedTimingReferences: [],
    ambiguousScheduleStatements: [],
    updatedAt: now,
    version: 1,
  };
}

function mergeStringArrays(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming].filter(Boolean))];
}

function mergeArm(existing: SoAArm, incoming: SoAArm): SoAArm {
  return {
    ...existing,
    name: incoming.name.trim() || existing.name,
    description: incoming.description?.trim() || existing.description,
    sourceSectionIds: mergeStringArrays(existing.sourceSectionIds, incoming.sourceSectionIds),
  };
}

function mergeAssessment(existing: SoAAssessment, incoming: SoAAssessment): SoAAssessment {
  return {
    ...existing,
    name: incoming.name.trim() || existing.name,
    category: incoming.category ?? existing.category,
    description: incoming.description?.trim() || existing.description,
    sourceSectionIds: mergeStringArrays(existing.sourceSectionIds, incoming.sourceSectionIds),
    inferenceSource: incoming.inferenceSource ?? existing.inferenceSource,
    evidence: incoming.evidence?.length ? incoming.evidence : existing.evidence,
    rationale: incoming.rationale ?? existing.rationale,
  };
}

function mergeVisit(existing: SoAVisit, incoming: SoAVisit): SoAVisit {
  return {
    ...existing,
    name: incoming.name.trim() || existing.name,
    epochId: incoming.epochId ?? existing.epochId,
    elementId: incoming.elementId ?? existing.elementId,
    nominalDay: incoming.nominalDay ?? existing.nominalDay,
    nominalWeek: incoming.nominalWeek ?? existing.nominalWeek,
    window: incoming.window ?? existing.window,
    order: incoming.order ?? existing.order,
    sourceSectionIds: mergeStringArrays(existing.sourceSectionIds, incoming.sourceSectionIds),
    inferenceSource: incoming.inferenceSource ?? existing.inferenceSource,
    evidence: incoming.evidence?.length ? incoming.evidence : existing.evidence,
    rationale: incoming.rationale ?? existing.rationale,
  };
}

function mergeById<T extends { id: string }>(
  existingItems: T[],
  incomingItems: T[] | undefined,
  mergeFn?: (existing: T, incoming: T) => T,
): T[] {
  if (!incomingItems?.length) {
    return existingItems;
  }
  const map = new Map(existingItems.map((item) => [item.id, item]));
  for (const incoming of incomingItems) {
    const current = map.get(incoming.id);
    map.set(incoming.id, current && mergeFn ? mergeFn(current, incoming) : incoming);
  }
  return [...map.values()];
}

function mergeAssessmentsByName(existing: SoAAssessment[], incoming: SoAAssessment[]): SoAAssessment[] {
  const byName = new Map(existing.map((item) => [normalizeSoAName(item.name), item]));
  for (const assessment of incoming) {
    const key = normalizeSoAName(assessment.name);
    const current = byName.get(key);
    if (current) {
      byName.set(key, mergeAssessment(current, assessment));
    } else {
      byName.set(key, assessment);
    }
  }
  return [...byName.values()];
}

function mergeScheduleRules(existing: SoAScheduleRule[], incoming: SoAScheduleRule[]): SoAScheduleRule[] {
  const map = new Map(existing.map((rule) => [rule.id, rule]));
  for (const rule of incoming) {
    const duplicate = [...map.values()].find(
      (candidate) =>
        candidate.assessmentId === rule.assessmentId &&
        candidate.visitId === rule.visitId &&
        candidate.procedureId === rule.procedureId &&
        candidate.activityId === rule.activityId,
    );
    if (duplicate) {
      map.set(duplicate.id, {
        ...duplicate,
        required: rule.required,
        notes: rule.notes ?? duplicate.notes,
        sourceSectionIds: mergeStringArrays(duplicate.sourceSectionIds, rule.sourceSectionIds),
      });
    } else {
      map.set(rule.id, rule);
    }
  }
  return [...map.values()];
}

export function applySoAKnowledgePatch(
  base: SoAKnowledgeModel,
  patch: SoAKnowledgePatch,
): SoAKnowledgeModel {
  const now = new Date().toISOString();
  const mergedAssessments = patch.assessments
    ? mergeAssessmentsByName(base.assessments, patch.assessments)
    : base.assessments;

  return {
    ...base,
    protocolId: patch.protocolId ?? base.protocolId,
    arms: mergeById(base.arms, patch.arms, mergeArm),
    epochs: mergeById(base.epochs, patch.epochs),
    elements: mergeById(base.elements, patch.elements),
    visits: mergeById(base.visits, patch.visits, mergeVisit),
    activities: mergeById(base.activities, patch.activities),
    assessments: mergedAssessments,
    procedures: mergeById(base.procedures, patch.procedures),
    timingWindows: mergeById(base.timingWindows, patch.timingWindows),
    scheduleRules: patch.scheduleRules
      ? mergeScheduleRules(base.scheduleRules, patch.scheduleRules)
      : base.scheduleRules,
    conditions: mergeById(base.conditions, patch.conditions),
    footnotes: mergeById(base.footnotes, patch.footnotes),
    sourceSectionIds: mergeStringArrays(base.sourceSectionIds, patch.sourceSectionIds ?? []),
    extractionNotes: mergeStringArrays(base.extractionNotes, patch.extractionNotes ?? []),
    unmappedTimingReferences: mergeStringArrays(
      base.unmappedTimingReferences,
      patch.unmappedTimingReferences ?? [],
    ),
    ambiguousScheduleStatements: mergeStringArrays(
      base.ambiguousScheduleStatements,
      patch.ambiguousScheduleStatements ?? [],
    ),
    updatedAt: now,
    version: base.version + 1,
  };
}

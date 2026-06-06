import type { StudyMetadata, StudyModel, StudyModelCollectionKey, StudyModelItem } from './studyModelTypes';

export interface StudyModelPatch {
  studyMetadata?: Partial<StudyMetadata>;
  collections?: Partial<Record<StudyModelCollectionKey, StudyModelItem[]>>;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function mergeSourceSections(existing: string[], sectionId: string): string[] {
  return [...new Set([...existing, sectionId].filter(Boolean))];
}

function mergeStudyModelItems(
  existing: StudyModelItem[],
  incoming: StudyModelItem[],
  sectionId: string,
): StudyModelItem[] {
  const next = [...existing];
  const now = new Date().toISOString();

  for (const item of incoming) {
    if (!item.name.trim()) {
      continue;
    }
    const normalized = normalizeName(item.name);
    const matchIndex = next.findIndex((entry) => normalizeName(entry.name) === normalized);
    if (matchIndex >= 0) {
      const current = next[matchIndex];
      next[matchIndex] = {
        ...current,
        name: item.name.trim(),
        description: item.description?.trim() || current.description,
        sourceSections: mergeSourceSections(current.sourceSections, sectionId),
        lastUpdated: now,
      };
      continue;
    }
    next.push({
      ...item,
      name: item.name.trim(),
      description: item.description?.trim() || item.name.trim(),
      sourceSections: mergeSourceSections(item.sourceSections, sectionId),
      lastUpdated: now,
    });
  }

  return next;
}

function mergeStudyMetadata(
  existing: StudyMetadata,
  patch: Partial<StudyMetadata> | undefined,
): StudyMetadata {
  if (!patch) {
    return existing;
  }
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch) as Array<[keyof StudyMetadata, string | undefined]>) {
    if (typeof value === 'string' && value.trim().length > 0) {
      next[key] = value.trim();
    }
  }
  return next;
}

/** Applies a partial patch without replacing unrelated structured data. */
export function applyStudyModelPatch(
  model: StudyModel,
  patch: StudyModelPatch,
  sectionId: string,
): StudyModel {
  const next: StudyModel = {
    ...model,
    builtAt: new Date().toISOString(),
    studyMetadata: mergeStudyMetadata(model.studyMetadata, patch.studyMetadata),
  };

  if (!patch.collections) {
    return next;
  }

  for (const [collectionKey, items] of Object.entries(patch.collections) as Array<
    [StudyModelCollectionKey, StudyModelItem[] | undefined]
  >) {
    if (!items || items.length === 0) {
      continue;
    }
    next[collectionKey] = mergeStudyModelItems(model[collectionKey], items, sectionId);
  }

  return next;
}

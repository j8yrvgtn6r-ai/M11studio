import type { StudyModel, StudyModelCollectionKey, StudyModelItem } from './studyModelTypes';

const COLLECTION_LABELS: Record<StudyModelCollectionKey, string> = {
  population: 'Population',
  arms: 'Arms',
  epochs: 'Epochs',
  elements: 'Elements',
  visits: 'Visits',
  activities: 'Activities',
  assessments: 'Assessments',
  objectives: 'Objectives',
  estimands: 'Estimands',
  endpoints: 'Endpoints',
  interventions: 'Interventions',
  eligibility: 'Eligibility',
  randomization: 'Randomization',
  blinding: 'Blinding',
  procedures: 'Procedures',
  safetyMonitoring: 'Safety Monitoring',
  statisticalMethods: 'Statistical Methods',
  references: 'References',
};

export function getStudyModelCollectionLabel(key: StudyModelCollectionKey): string {
  return COLLECTION_LABELS[key];
}

export function getStudyModelCollectionsForSection(
  model: StudyModel | null,
  sectionId: string | null,
): Array<{ key: StudyModelCollectionKey; label: string; items: StudyModelItem[] }> {
  if (!model || !sectionId) {
    return [];
  }

  const keys = Object.keys(COLLECTION_LABELS) as StudyModelCollectionKey[];
  return keys
    .map((key) => ({
      key,
      label: COLLECTION_LABELS[key],
      items: model[key].filter((item) => item.sourceSections.includes(sectionId)),
    }))
    .filter((entry) => entry.items.length > 0);
}

export function getStudyModelOverview(model: StudyModel | null): Array<{ label: string; value: string }> {
  if (!model) {
    return [];
  }

  return [
    { label: 'Visits', value: String(model.visits.length > 0 ? model.visits[0]?.name.match(/\d+/)?.[0] ?? model.visits.length : 0) },
    { label: 'Activities', value: String(model.activities.length > 0 ? model.activities[0]?.name.match(/\d+/)?.[0] ?? model.activities.length : 0) },
    { label: 'Assessments', value: String(model.assessments.length > 0 ? model.assessments[0]?.name.match(/\d+/)?.[0] ?? model.assessments.length : 0) },
    { label: 'Objectives', value: String(model.objectives.length) },
    { label: 'Arms', value: String(model.arms.length) },
  ];
}

export function matchStudyModelSectionFocus(
  model: StudyModel | null,
  sectionId: string | null,
  sectionTitle: string | null,
): StudyModelCollectionKey | 'overview' | null {
  if (!model || !sectionId) {
    return null;
  }

  const title = (sectionTitle ?? '').toLowerCase();
  if (title.includes('objective') || title.includes('endpoint') || title.includes('estimand')) {
    return 'objectives';
  }
  if (title.includes('population') || title.includes('eligibility')) {
    return 'population';
  }
  if (title.includes('assessment') || title.includes('schedule of activities') || title.includes('soa')) {
    return 'assessments';
  }
  if (title.includes('design') || title.includes('arm') || title.includes('intervention')) {
    return 'arms';
  }
  if (title.includes('statistical')) {
    return 'statisticalMethods';
  }

  const matched = getStudyModelCollectionsForSection(model, sectionId);
  return matched[0]?.key ?? 'overview';
}

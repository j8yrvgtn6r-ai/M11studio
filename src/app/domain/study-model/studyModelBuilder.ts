import type { ProtocolKnowledgeModel } from '../protocol/import/protocolKnowledgeTypes';
import type { ProtocolDocument } from '../protocol/types';
import type { StudyModel, StudyModelItem } from './studyModelTypes';

function slug(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base ? `${base}-${index}` : `item-${index}`;
}

function itemsFromStrings(
  values: string[] | undefined,
  prefix: string,
  defaultSectionId?: string,
  timestamp?: string,
): StudyModelItem[] {
  const now = timestamp ?? new Date().toISOString();
  return (values ?? [])
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value, index) => ({
      id: `${prefix}-${slug(value, index)}`,
      name: value.trim(),
      description: value.trim(),
      sourceSections: defaultSectionId ? [defaultSectionId] : [],
      lastUpdated: now,
    }));
}

function inferSectionForCollection(collection: string, sectionId: string | null): string[] {
  return sectionId ? [sectionId] : [];
}

export function buildStudyModelFromSources(input: {
  sourceUploadId: string;
  knowledge?: ProtocolKnowledgeModel | null;
  document?: ProtocolDocument | null;
}): StudyModel {
  const now = new Date().toISOString();
  const knowledge = input.knowledge;
  const document = input.document;
  const id = knowledge?.id ? `study-model-${knowledge.id}` : `study-model-${input.sourceUploadId}`;

  const objectivesSection = document?.sections.find((section) => section.title.toLowerCase().includes('objective'))?.id ?? '3';
  const populationSection = document?.sections.find((section) => section.title.toLowerCase().includes('population'))?.id ?? '5';
  const designSection = document?.sections.find((section) => section.title.toLowerCase().includes('trial design'))?.id ?? '4';
  const assessmentSection = document?.sections.find((section) => section.title.toLowerCase().includes('assessment'))?.id ?? '8';
  const statsSection = document?.sections.find((section) => section.title.toLowerCase().includes('statistical'))?.id ?? '10';

  const visitCount = document?.visitSchedule?.visitDefinitions?.length ?? knowledge?.visits?.length ?? 0;
  const activityCount = document?.soaAssessmentDefinitions?.length ?? knowledge?.assessments?.length ?? 0;
  const assessmentCount = document?.assessmentScheduleRules?.length ?? activityCount;

  return {
    id,
    sourceUploadId: input.sourceUploadId,
    builtAt: now,
    studyMetadata: {
      title: knowledge?.studyTitle,
      shortTitle: knowledge?.shortTitle,
      sponsor: knowledge?.sponsor,
      protocolIdentifier: knowledge?.protocolIdentifier,
      version: knowledge?.version,
      phase: knowledge?.phase,
      indication: knowledge?.indication,
    },
    population: [
      {
        id: 'population-primary',
        name: knowledge?.targetPopulation ?? knowledge?.population ?? 'Study population',
        description: knowledge?.inclusionCriteriaSummary ?? knowledge?.eligibilitySummary,
        sourceSections: inferSectionForCollection('population', populationSection),
        lastUpdated: now,
      },
    ],
    arms: itemsFromStrings(knowledge?.arms ?? knowledge?.armDefinitions, 'arm', designSection, now),
    epochs: [],
    elements: [],
    visits: visitCount
      ? [
          {
            id: 'visits-summary',
            name: `${visitCount} protocol visits`,
            description: (knowledge?.visits ?? []).slice(0, 5).join('; '),
            sourceSections: inferSectionForCollection('visits', assessmentSection),
            lastUpdated: now,
          },
        ]
      : itemsFromStrings(knowledge?.visits, 'visit', assessmentSection, now),
    activities: activityCount
      ? [
          {
            id: 'activities-summary',
            name: `${activityCount} schedule activities`,
            description: (knowledge?.assessments ?? []).slice(0, 5).join('; '),
            sourceSections: inferSectionForCollection('activities', assessmentSection),
            lastUpdated: now,
          },
        ]
      : itemsFromStrings(knowledge?.assessments, 'activity', assessmentSection, now),
    assessments: assessmentCount
      ? [
          {
            id: 'assessments-summary',
            name: `${assessmentCount} scheduled assessments`,
            description: (knowledge?.efficacyAssessments ?? knowledge?.safetyAssessments ?? []).slice(0, 5).join('; '),
            sourceSections: inferSectionForCollection('assessments', assessmentSection),
            lastUpdated: now,
          },
        ]
      : itemsFromStrings(knowledge?.efficacyAssessments ?? knowledge?.safetyAssessments, 'assessment', assessmentSection, now),
    objectives: itemsFromStrings(knowledge?.primaryObjectives ?? knowledge?.objectives, 'objective', objectivesSection, now),
    estimands: itemsFromStrings(knowledge?.estimands, 'estimand', objectivesSection, now),
    endpoints: itemsFromStrings(knowledge?.endpoints, 'endpoint', objectivesSection, now),
    interventions: itemsFromStrings(knowledge?.interventions, 'intervention', designSection, now),
    eligibility: itemsFromStrings(
      [knowledge?.inclusionCriteriaSummary, knowledge?.exclusionCriteriaSummary].filter(Boolean) as string[],
      'eligibility',
      populationSection,
      now,
    ),
    randomization: knowledge?.interventionModel
      ? [
          {
            id: 'randomization-model',
            name: knowledge.interventionModel,
            description: knowledge.controlType,
            sourceSections: inferSectionForCollection('randomization', designSection),
            lastUpdated: now,
          },
        ]
      : [],
    blinding: [],
    procedures: [],
    safetyMonitoring: itemsFromStrings(knowledge?.safetyMonitoring ?? knowledge?.safetyAssessments, 'safety', assessmentSection, now),
    statisticalMethods: knowledge?.statisticalSummary
      ? [
          {
            id: 'statistical-summary',
            name: 'Statistical methods summary',
            description: knowledge.statisticalSummary,
            sourceSections: inferSectionForCollection('statistics', statsSection),
            lastUpdated: now,
          },
        ]
      : [],
    references: (knowledge?.sourceReferences ?? []).map((reference, index) => ({
      id: `reference-${index}`,
      name: reference.label,
      description: reference.excerpt,
      sourceSections: reference.sourceSectionId ? [reference.sourceSectionId] : [],
      lastUpdated: now,
    })),
  };
}

export const STUDY_MODEL_BUILD_STEPS = [
  'Extracting Objectives...',
  'Extracting Population...',
  'Extracting Arms...',
  'Extracting Endpoints...',
  'Extracting Visits...',
  'Extracting Activities...',
] as const;

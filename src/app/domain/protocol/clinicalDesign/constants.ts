import type { ClinicalDesignEntities, DesignEntity } from '../types';

/** Keys of `ClinicalDesignEntities` searched by lookup and validation helpers. */
export const CLINICAL_DESIGN_COLLECTION_KEYS = [
  'objectives',
  'endpoints',
  'estimands',
  'assessments',
  'visits',
  'studyArms',
  'populations',
  'eligibilityCriteria',
  'interventions',
  'statisticalAnalyses',
  'biomarkers',
  'safetyAssessments',
] as const satisfies readonly (keyof ClinicalDesignEntities)[];

export type ClinicalDesignCollectionKey = (typeof CLINICAL_DESIGN_COLLECTION_KEYS)[number];

/** Resolves the clinical design array key for a graph entity type. */
export function getDesignEntityCollectionKey(
  type: DesignEntity['type']
): ClinicalDesignCollectionKey | undefined {
  const typeToCollection: Partial<Record<DesignEntity['type'], ClinicalDesignCollectionKey>> = {
    objective: 'objectives',
    endpoint: 'endpoints',
    estimand: 'estimands',
    assessment: 'assessments',
    visit: 'visits',
    'study-arm': 'studyArms',
    population: 'populations',
    eligibility: 'eligibilityCriteria',
    intervention: 'interventions',
    'statistical-analysis': 'statisticalAnalyses',
    biomarker: 'biomarkers',
    'safety-assessment': 'safetyAssessments',
  };

  return typeToCollection[type];
}

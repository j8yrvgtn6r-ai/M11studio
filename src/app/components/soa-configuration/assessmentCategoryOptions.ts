import type { ProtocolDocument } from '../../domain/protocol/types';

/** Controlled vocabulary for assessment catalog categories (UI layer). */
export const CONTROLLED_ASSESSMENT_CATEGORIES = [
  'Administrative',
  'Baseline',
  'Safety',
  'Efficacy',
  'PK',
  'Intervention',
  'Imaging',
] as const;

/** Returns category options for dropdowns, merging controlled terms with in-document values. */
export function getAssessmentCategoryOptions(document: ProtocolDocument): string[] {
  const categories = new Set<string>(CONTROLLED_ASSESSMENT_CATEGORIES);

  for (const definition of document.soaAssessmentDefinitions ?? []) {
    if (definition.category?.trim()) {
      categories.add(definition.category.trim());
    }
  }

  return [...categories].sort((left, right) => left.localeCompare(right));
}

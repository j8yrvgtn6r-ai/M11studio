import type { SoAAssessmentDefinition } from '../../domain/protocol/types';

/** Generates the next sequential catalog id (e.g. a13) without changing domain models. */
export function generateNextAssessmentCatalogId(definitions: SoAAssessmentDefinition[]): string {
  let maxNumericSuffix = 0;

  for (const definition of definitions) {
    const match = /^a(\d+)$/.exec(definition.id);
    if (match) {
      maxNumericSuffix = Math.max(maxNumericSuffix, Number(match[1]));
    }
  }

  return `a${maxNumericSuffix + 1}`;
}

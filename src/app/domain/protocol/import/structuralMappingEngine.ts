import type { ImportedProtocolSource, StructuralMappingResult } from './types';
import {
  evaluateStructuralMapping,
  toStructuralMappingResult,
  type StructuralMappingRuleOptions,
} from '../../../agents/structuralMappingRules';

export type StructuralMappingOptions = StructuralMappingRuleOptions;

/** @deprecated Prefer runStructuralMappingAgent — delegates to Structural Mapping Agent rules. */
export function runStructuralMappingEngine(
  source: ImportedProtocolSource,
  options?: StructuralMappingOptions,
): StructuralMappingResult {
  const output = evaluateStructuralMapping(
    {
      sourceExtraction: source,
      trigger: 'import',
    },
    options,
  );
  return toStructuralMappingResult(output);
}

export {
  evaluateStructuralMapping,
  toStructuralMappingResult,
} from '../../../agents/structuralMappingRules';

import type { ProtocolDocument } from '../types';
import {
  findSoAAssessmentDefinitionInDocument,
  selectSoAAssessmentDefinitions,
  selectSoAAssessmentDefinitionsByCategory,
} from '../soaAssessmentDefinition/lookup';

export {
  findSoAAssessmentDefinitionInDocument,
  selectSoAAssessmentDefinitions,
  selectSoAAssessmentDefinitionsByCategory,
};

export function selectSoAAssessmentDefinition(
  document: ProtocolDocument,
  soaAssessmentDefinitionId: string
) {
  return findSoAAssessmentDefinitionInDocument(document, soaAssessmentDefinitionId)?.soaAssessmentDefinition ?? null;
}

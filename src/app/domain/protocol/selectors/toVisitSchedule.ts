import type { ProtocolDocument } from '../types';
import {
  findVisitDefinitionInDocument,
  selectScheduleAnchors,
  selectVisitDefinitions,
  findVisitDefinitionBySoAColumnIdInDocument,
} from '../visitSchedule/lookup';

export { selectScheduleAnchors, selectVisitDefinitions, findVisitDefinitionBySoAColumnIdInDocument };

export function selectVisitDefinition(document: ProtocolDocument, visitDefinitionId: string) {
  return findVisitDefinitionInDocument(document, visitDefinitionId)?.visitDefinition ?? null;
}

export function selectVisitDefinitionBySoAColumnId(document: ProtocolDocument, soaColumnId: string) {
  return findVisitDefinitionBySoAColumnIdInDocument(document, soaColumnId)?.visitDefinition ?? null;
}

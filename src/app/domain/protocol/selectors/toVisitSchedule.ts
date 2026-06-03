import type { ProtocolDocument } from '../types';
import { selectScheduleAnchors, selectVisitDefinitions } from '../visitSchedule/lookup';

export { selectScheduleAnchors, selectVisitDefinitions };

export function selectVisitDefinition(document: ProtocolDocument, visitDefinitionId: string) {
  return document.visitSchedule?.visitDefinitions.find((visitDefinition) => visitDefinition.id === visitDefinitionId) ?? null;
}

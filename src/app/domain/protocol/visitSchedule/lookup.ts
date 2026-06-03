import type { ProtocolDocument, ScheduleAnchor, VisitDefinition } from '../types';
import { getProtocolDocument } from '../store/protocolStore';

export interface ScheduleAnchorLocation {
  anchor: ScheduleAnchor;
  index: number;
}

export interface VisitDefinitionLocation {
  visitDefinition: VisitDefinition;
  index: number;
}

/** Returns schedule anchors from a protocol document. */
export function selectScheduleAnchors(document: ProtocolDocument): ScheduleAnchor[] {
  return document.visitSchedule?.anchors ?? [];
}

/** Returns visit definitions from a protocol document. */
export function selectVisitDefinitions(document: ProtocolDocument): VisitDefinition[] {
  return document.visitSchedule?.visitDefinitions ?? [];
}

/** Finds a schedule anchor by id within a protocol document. */
export function findScheduleAnchorInDocument(
  document: ProtocolDocument,
  anchorId: string
): ScheduleAnchorLocation | null {
  const anchors = document.visitSchedule?.anchors;
  if (!anchors?.length) {
    return null;
  }

  const index = anchors.findIndex((anchor) => anchor.id === anchorId);
  if (index < 0) {
    return null;
  }

  return {
    anchor: anchors[index],
    index,
  };
}

/** Finds a schedule anchor by id in the authoritative protocol store document. */
export function findScheduleAnchor(anchorId: string): ScheduleAnchorLocation | null {
  return findScheduleAnchorInDocument(getProtocolDocument(), anchorId);
}

/** Finds a visit definition by id within a protocol document. */
export function findVisitDefinitionInDocument(
  document: ProtocolDocument,
  visitDefinitionId: string
): VisitDefinitionLocation | null {
  const visitDefinitions = document.visitSchedule?.visitDefinitions;
  if (!visitDefinitions?.length) {
    return null;
  }

  const index = visitDefinitions.findIndex((visitDefinition) => visitDefinition.id === visitDefinitionId);
  if (index < 0) {
    return null;
  }

  return {
    visitDefinition: visitDefinitions[index],
    index,
  };
}

/** Finds a visit definition by id in the authoritative protocol store document. */
export function findVisitDefinition(visitDefinitionId: string): VisitDefinitionLocation | null {
  return findVisitDefinitionInDocument(getProtocolDocument(), visitDefinitionId);
}

/** Returns whether a schedule anchor id exists in a protocol document. */
export function scheduleAnchorExistsInDocument(document: ProtocolDocument, anchorId: string): boolean {
  return findScheduleAnchorInDocument(document, anchorId) !== null;
}

/** Returns whether a visit definition id exists in a protocol document. */
export function visitDefinitionExistsInDocument(document: ProtocolDocument, visitDefinitionId: string): boolean {
  return findVisitDefinitionInDocument(document, visitDefinitionId) !== null;
}

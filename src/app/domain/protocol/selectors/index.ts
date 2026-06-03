import { getProtocolDocument } from '../loadProtocol';
import type { ProtocolDocument } from '../types';
import { selectAuditEvents, selectComments } from './toCollaboration';
import { selectDependencyEdges, selectDependencyNodes } from './toDependencyGraph';
import { selectFieldDefinitions } from './toFieldDefinitions';
import { selectAssessments, selectSoACells, selectVisits } from './toSchedule';
import { selectProtocolSections } from './toProtocolSections';
import { selectValidationIssues } from './toValidationIssues';

export { selectProtocolSections } from './toProtocolSections';
export { selectFieldDefinitions } from './toFieldDefinitions';
export { selectVisits, selectAssessments, selectSoACells } from './toSchedule';
export { selectDependencyNodes, selectDependencyEdges } from './toDependencyGraph';
export { selectValidationIssues } from './toValidationIssues';
export { selectComments, selectAuditEvents, toLegacyDate } from './toCollaboration';

export function getProtocolSections(document: ProtocolDocument = getProtocolDocument()) {
  return selectProtocolSections(document);
}

export function getFieldDefinitions(document: ProtocolDocument = getProtocolDocument()) {
  return selectFieldDefinitions(document);
}

export function getVisits(document: ProtocolDocument = getProtocolDocument()) {
  return selectVisits(document);
}

export function getAssessments(document: ProtocolDocument = getProtocolDocument()) {
  return selectAssessments(document);
}

export function getSoACells(document: ProtocolDocument = getProtocolDocument()) {
  return selectSoACells(document);
}

export function getDependencyNodes(document: ProtocolDocument = getProtocolDocument()) {
  return selectDependencyNodes(document);
}

export function getDependencyEdges(document: ProtocolDocument = getProtocolDocument()) {
  return selectDependencyEdges(document);
}

export function getValidationIssues(document: ProtocolDocument = getProtocolDocument()) {
  return selectValidationIssues(document);
}

export function getComments(document: ProtocolDocument = getProtocolDocument()) {
  return selectComments(document);
}

export function getAuditEvents(document: ProtocolDocument = getProtocolDocument()) {
  return selectAuditEvents(document);
}

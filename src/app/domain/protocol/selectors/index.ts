import { getProtocolDocument } from '../store';

import type { ProtocolDocument } from '../types';

import type { ScheduleView } from '../scheduleGeneration/generateScheduleFromRules';

import { selectAuditEvents, selectComments } from './toCollaboration';

import { selectDependencyEdges, selectDependencyNodes } from './toDependencyGraph';

import { selectFieldDefinitions } from './toFieldDefinitions';

import { selectAssessments, selectSoACells, selectVisits } from './toSchedule';

import {
  selectScheduleAnchors,
  selectVisitDefinitions,
  selectVisitDefinition,
  selectVisitDefinitionBySoAColumnId,
} from './toVisitSchedule';

import {
  selectSoAAssessmentDefinition,
  selectSoAAssessmentDefinitions,
  selectSoAAssessmentDefinitionsByCategory,
} from './toSoAAssessmentDefinitions';

import {

  selectAssessmentScheduleRule,

  selectAssessmentScheduleRules,

  selectAssessmentScheduleRulesForAssessment,

  selectAssessmentScheduleRulesForVisit,

} from './toAssessmentScheduleRules';

import {

  selectGeneratedAssessments,

  selectGeneratedSchedule,

  selectGeneratedScheduleView,

  selectGeneratedSoACells,

  selectGeneratedVisits,

} from './toGeneratedSchedule';

import { selectProtocolSections } from './toProtocolSections';

import { selectValidationIssues } from './toValidationIssues';

import {

  getUseGeneratedSchedule,

  resetUseGeneratedSchedule,

  setUseGeneratedSchedule,

} from './scheduleSelectorConfig';

import { shouldUseGeneratedSchedule, type ScheduleSelectorOptions } from './scheduleSelectorOptions';



export { selectProtocolSections } from './toProtocolSections';

export { selectFieldDefinitions } from './toFieldDefinitions';

export { selectVisits, selectAssessments, selectSoACells } from './toSchedule';

export { selectScheduleAnchors, selectVisitDefinitions, selectVisitDefinition, selectVisitDefinitionBySoAColumnId } from './toVisitSchedule';

export {
  selectSoAAssessmentDefinition,
  selectSoAAssessmentDefinitions,
  selectSoAAssessmentDefinitionsByCategory,
} from './toSoAAssessmentDefinitions';

export {

  selectAssessmentScheduleRule,

  selectAssessmentScheduleRules,

  selectAssessmentScheduleRulesForAssessment,

  selectAssessmentScheduleRulesForVisit,

} from './toAssessmentScheduleRules';

export {

  selectGeneratedAssessments,

  selectGeneratedSchedule,

  selectGeneratedScheduleView,

  selectGeneratedSoACells,

  selectGeneratedVisits,

} from './toGeneratedSchedule';

export { selectDependencyNodes, selectDependencyEdges } from './toDependencyGraph';

export { selectValidationIssues } from './toValidationIssues';

export { selectComments, selectAuditEvents, toLegacyDate } from './toCollaboration';

export {

  getUseGeneratedSchedule,

  resetUseGeneratedSchedule,

  setUseGeneratedSchedule,

} from './scheduleSelectorConfig';

export type { ScheduleSelectorOptions } from './scheduleSelectorOptions';



export function getProtocolSections(document: ProtocolDocument = getProtocolDocument()) {

  return selectProtocolSections(document);

}



export function getFieldDefinitions(document: ProtocolDocument = getProtocolDocument()) {

  return selectFieldDefinitions(document);

}



export function getSchedule(

  document: ProtocolDocument = getProtocolDocument(),

  options?: ScheduleSelectorOptions

): ScheduleView {

  if (shouldUseGeneratedSchedule(options)) {

    return selectGeneratedScheduleView(document);

  }



  return document.schedule;

}



export function getVisits(

  document: ProtocolDocument = getProtocolDocument(),

  options?: ScheduleSelectorOptions

) {

  if (shouldUseGeneratedSchedule(options)) {

    return selectGeneratedVisits(document);

  }



  return selectVisits(document);

}



export function getAssessments(

  document: ProtocolDocument = getProtocolDocument(),

  options?: ScheduleSelectorOptions

) {

  if (shouldUseGeneratedSchedule(options)) {

    return selectGeneratedAssessments(document);

  }



  return selectAssessments(document);

}



export function getSoACells(

  document: ProtocolDocument = getProtocolDocument(),

  options?: ScheduleSelectorOptions

) {

  if (shouldUseGeneratedSchedule(options)) {

    return selectGeneratedSoACells(document);

  }



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



export function getScheduleAnchors(document: ProtocolDocument = getProtocolDocument()) {

  return selectScheduleAnchors(document);

}



export function getVisitDefinitions(document: ProtocolDocument = getProtocolDocument()) {

  return selectVisitDefinitions(document);

}



export function getVisitDefinition(visitDefinitionId: string, document: ProtocolDocument = getProtocolDocument()) {

  return selectVisitDefinition(document, visitDefinitionId);

}



export function getVisitDefinitionBySoAColumnId(

  soaColumnId: string,

  document: ProtocolDocument = getProtocolDocument()

) {

  return selectVisitDefinitionBySoAColumnId(document, soaColumnId);

}



export function getSoAAssessmentDefinitions(document: ProtocolDocument = getProtocolDocument()) {

  return selectSoAAssessmentDefinitions(document);

}



export function getSoAAssessmentDefinition(

  soaAssessmentDefinitionId: string,

  document: ProtocolDocument = getProtocolDocument()

) {

  return selectSoAAssessmentDefinition(document, soaAssessmentDefinitionId);

}



export function getSoAAssessmentDefinitionsByCategory(

  category: string,

  document: ProtocolDocument = getProtocolDocument()

) {

  return selectSoAAssessmentDefinitionsByCategory(document, category);

}



export function getAssessmentScheduleRules(document: ProtocolDocument = getProtocolDocument()) {

  return selectAssessmentScheduleRules(document);

}



export function getAssessmentScheduleRulesForAssessment(

  assessmentId: string,

  document: ProtocolDocument = getProtocolDocument()

) {

  return selectAssessmentScheduleRulesForAssessment(document, assessmentId);

}



export function getAssessmentScheduleRulesForVisit(

  visitDefinitionId: string,

  document: ProtocolDocument = getProtocolDocument()

) {

  return selectAssessmentScheduleRulesForVisit(document, visitDefinitionId);

}



export function getAssessmentScheduleRule(ruleId: string, document: ProtocolDocument = getProtocolDocument()) {

  return selectAssessmentScheduleRule(document, ruleId);

}



/** @deprecated Prefer getSchedule(document, { generated: true }). */

export function getGeneratedSchedule(document: ProtocolDocument = getProtocolDocument()) {

  return selectGeneratedSchedule(document);

}



/** @deprecated Prefer getVisits(document, { generated: true }). */

export function getGeneratedVisits(document: ProtocolDocument = getProtocolDocument()) {

  return selectGeneratedVisits(document);

}



/** @deprecated Prefer getAssessments(document, { generated: true }). */

export function getGeneratedAssessments(document: ProtocolDocument = getProtocolDocument()) {

  return selectGeneratedAssessments(document);

}



/** @deprecated Prefer getSoACells(document, { generated: true }). */

export function getGeneratedSoACells(document: ProtocolDocument = getProtocolDocument()) {

  return selectGeneratedSoACells(document);

}



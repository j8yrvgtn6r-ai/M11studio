import type { Assessment, SoACell, Visit } from '../../../types/protocol';
import type { ProtocolDocument } from '../types';
import {
  generateScheduleFromRules,
  type GeneratedSchedule,
  type ScheduleView,
} from '../scheduleGeneration/generateScheduleFromRules';

export { generateScheduleFromRules };

export function selectGeneratedSchedule(document: ProtocolDocument): GeneratedSchedule {
  return generateScheduleFromRules(document);
}

export function selectGeneratedScheduleView(document: ProtocolDocument): ScheduleView {
  return generateScheduleFromRules(document);
}

function mapGeneratedVisits(schedule: GeneratedSchedule): Visit[] {
  return schedule.visits.map(({ id, label, order, timepoint }) => ({
    id,
    label,
    order,
    ...(timepoint !== undefined ? { timepoint } : {}),
  }));
}

function mapGeneratedAssessments(schedule: GeneratedSchedule): Assessment[] {
  return schedule.assessments.map(({ id, label, category, linkedSectionId }) => ({
    id,
    label,
    category,
    ...(linkedSectionId !== undefined ? { linkedSectionId } : {}),
  }));
}

function mapGeneratedSoACells(schedule: GeneratedSchedule): SoACell[] {
  return schedule.cells.map(({ visitId, assessmentId, required, notes }) => ({
    visitId,
    assessmentId,
    required,
    ...(notes !== undefined ? { notes } : {}),
  }));
}

export function selectGeneratedVisits(document: ProtocolDocument): Visit[] {
  return mapGeneratedVisits(selectGeneratedSchedule(document));
}

export function selectGeneratedAssessments(document: ProtocolDocument): Assessment[] {
  return mapGeneratedAssessments(selectGeneratedSchedule(document));
}

export function selectGeneratedSoACells(document: ProtocolDocument): SoACell[] {
  return mapGeneratedSoACells(selectGeneratedSchedule(document));
}

export {
  mapGeneratedAssessments,
  mapGeneratedSoACells,
  mapGeneratedVisits,
};

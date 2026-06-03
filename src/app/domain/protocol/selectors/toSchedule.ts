import type { Assessment, SoACell, Visit } from '../../../types/protocol';
import type { ProtocolDocument } from '../types';

export function selectVisits(document: ProtocolDocument): Visit[] {
  return document.schedule.visits.map(({ id, label, order, timepoint }) => ({
    id,
    label,
    order,
    ...(timepoint !== undefined ? { timepoint } : {}),
  }));
}

export function selectAssessments(document: ProtocolDocument): Assessment[] {
  return document.schedule.assessments.map(({ id, label, category, linkedSectionId }) => ({
    id,
    label,
    category,
    ...(linkedSectionId !== undefined ? { linkedSectionId } : {}),
  }));
}

export function selectSoACells(document: ProtocolDocument): SoACell[] {
  return document.schedule.cells.map(({ visitId, assessmentId, required, notes }) => ({
    visitId,
    assessmentId,
    required,
    ...(notes !== undefined ? { notes } : {}),
  }));
}

import type { SoAKnowledgeModel } from './soaKnowledgeTypes';

export function getSoAKnowledgeSummary(model: SoAKnowledgeModel | null | undefined) {
  if (!model) {
    return {
      armCount: 0,
      epochCount: 0,
      elementCount: 0,
      visitCount: 0,
      activityCount: 0,
      assessmentCount: 0,
      procedureCount: 0,
      scheduleRuleCount: 0,
      conditionCount: 0,
      footnoteCount: 0,
      timingWindowCount: 0,
      extractionNoteCount: 0,
      updatedAt: null,
      version: 0,
    };
  }

  return {
    armCount: model.arms.length,
    epochCount: model.epochs.length,
    elementCount: model.elements.length,
    visitCount: model.visits.length,
    activityCount: model.activities.length,
    assessmentCount: model.assessments.length,
    procedureCount: model.procedures.length,
    scheduleRuleCount: model.scheduleRules.length,
    conditionCount: model.conditions.length,
    footnoteCount: model.footnotes.length,
    timingWindowCount: model.timingWindows.length,
    extractionNoteCount: model.extractionNotes.length,
    updatedAt: model.updatedAt,
    version: model.version,
  };
}

export function selectAssessmentsByCategory(
  model: SoAKnowledgeModel,
  category: SoAKnowledgeModel['assessments'][number]['category'],
) {
  return model.assessments.filter((assessment) => assessment.category === category);
}

export function selectScheduleRulesForAssessment(model: SoAKnowledgeModel, assessmentId: string) {
  return model.scheduleRules.filter((rule) => rule.assessmentId === assessmentId);
}

export function selectScheduleRulesForVisit(model: SoAKnowledgeModel, visitId: string) {
  return model.scheduleRules.filter((rule) => rule.visitId === visitId);
}

export function selectVisitsForEpoch(model: SoAKnowledgeModel, epochId: string) {
  return model.visits.filter((visit) => visit.epochId === epochId);
}

export function findSoAAssessmentByName(model: SoAKnowledgeModel, name: string) {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  return model.assessments.find(
    (assessment) => assessment.name.toLowerCase().replace(/\s+/g, ' ').trim() === normalized,
  );
}

export function findSoAVisitByName(model: SoAKnowledgeModel, name: string) {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  return model.visits.find((visit) => visit.name.toLowerCase().replace(/\s+/g, ' ').trim() === normalized);
}

export function getSoAKnowledgeDiagnostics(model: SoAKnowledgeModel | null | undefined) {
  if (!model) {
    return {
      extractionNotes: [] as string[],
      unmappedTimingReferences: [] as string[],
      ambiguousScheduleStatements: [] as string[],
    };
  }
  return {
    extractionNotes: model.extractionNotes,
    unmappedTimingReferences: model.unmappedTimingReferences,
    ambiguousScheduleStatements: model.ambiguousScheduleStatements,
  };
}

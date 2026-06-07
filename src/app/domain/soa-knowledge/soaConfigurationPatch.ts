import type {
  AssessmentScheduleRule,
  ProtocolDocument,
  SoAAssessmentDefinition,
  VisitDefinition,
} from '../protocol/types';
import { createAssessmentScheduleRule } from '../protocol/store/assessmentScheduleRuleMutations';
import { createSoAAssessmentDefinition } from '../protocol/store/soaAssessmentDefinitionMutations';
import { getProtocolDocument, mutateProtocolDocument } from '../protocol/store/protocolStore';
import { normalizeSoAName } from './soaKnowledgePatch';
import type { SoAKnowledgeModel, SoAKnowledgePatch } from './soaKnowledgeTypes';

export interface SoAConfigurationPatch {
  visitDefinitions?: VisitDefinition[];
  soaAssessmentDefinitions?: SoAAssessmentDefinition[];
  assessmentScheduleRules?: AssessmentScheduleRule[];
  notes?: string[];
}

export interface SoAConfigurationPatchResult {
  applied: boolean;
  deferred: string[];
  addedVisits: number;
  addedAssessments: number;
  addedRules: number;
}

function nextVisitId(document: ProtocolDocument): string {
  let max = 0;
  for (const visit of document.visitSchedule.visitDefinitions ?? []) {
    const match = /^v(\d+)$/.exec(visit.id);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `v${max + 1}`;
}

function nextAssessmentId(document: ProtocolDocument): string {
  let max = 0;
  for (const assessment of document.soaAssessmentDefinitions ?? []) {
    const match = /^a(\d+)$/.exec(assessment.id);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `a${max + 1}`;
}

function nextRuleId(document: ProtocolDocument): string {
  let max = 0;
  for (const rule of document.assessmentScheduleRules ?? []) {
    const match = /^r(\d+)$/.exec(rule.id);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `r${max + 1}`;
}

function inferVisitType(name: string): VisitDefinition['visitType'] {
  const normalized = name.toLowerCase();
  if (normalized.includes('screen')) return 'screening';
  if (normalized.includes('baseline')) return 'baseline';
  if (normalized.includes('follow')) return 'follow-up';
  if (normalized.includes('end of') || normalized.includes('early')) return 'early-termination';
  return 'treatment';
}
function mapAssessmentCategory(category?: string): string {
  switch (category) {
    case 'safety':
    case 'adverseEvents':
      return 'Safety';
    case 'efficacy':
      return 'Efficacy';
    case 'laboratory':
      return 'Laboratory';
    case 'vitalSigns':
      return 'Vital Signs';
    case 'imaging':
      return 'Imaging';
    case 'pk':
      return 'Pharmacokinetics';
    case 'pro':
      return 'Patient-Reported Outcomes';
    case 'physicalExam':
      return 'Physical Examination';
    case 'concomitantMedication':
      return 'Concomitant Medications';
    default:
      return 'Other';
  }
}

export function buildProposedConfigurationPatch(
  knowledge: SoAKnowledgeModel | SoAKnowledgePatch,
  document: ProtocolDocument = getProtocolDocument(),
): SoAConfigurationPatch {
  const notes: string[] = [];
  const existingVisitNames = new Set(
    (document.visitSchedule.visitDefinitions ?? []).map((visit) => normalizeSoAName(visit.name)),
  );
  const existingAssessmentNames = new Set(
    (document.soaAssessmentDefinitions ?? []).map((item) => normalizeSoAName(item.label)),
  );

  const visitDefinitions: VisitDefinition[] = [];
  const assessmentIdByKnowledgeId = new Map<string, string>();
  const visitIdByKnowledgeId = new Map<string, string>();
  const defaultAnchor = document.visitSchedule.anchors?.[0];

  for (const visit of knowledge.visits ?? []) {
    if (existingVisitNames.has(normalizeSoAName(visit.name))) {
      const existing = document.visitSchedule.visitDefinitions?.find(
        (entry) => normalizeSoAName(entry.name) === normalizeSoAName(visit.name),
      );
      if (existing) {
        visitIdByKnowledgeId.set(visit.id, existing.id);
      }
      continue;
    }
    if (!defaultAnchor) {
      notes.push(`Deferred visit "${visit.name}" — no schedule anchor available.`);
      continue;
    }
    const visitId = nextVisitId({ ...document, visitSchedule: { ...document.visitSchedule, visitDefinitions: [...(document.visitSchedule.visitDefinitions ?? []), ...visitDefinitions] } });
    visitIdByKnowledgeId.set(visit.id, visitId);
    visitDefinitions.push({
      id: visitId,
      name: visit.name,
      visitType: inferVisitType(visit.name),
      epoch: visit.epochId,
      anchorId: defaultAnchor.id,
      nominalDay: visit.nominalDay,
      nominalWeek: visit.nominalWeek,
      windowBeforeDays: undefined,
      windowAfterDays: undefined,
      required: true,
      order: visit.order ?? visitDefinitions.length,
      metadata: { soaKnowledgeVisitId: visit.id, sourceSectionIds: visit.sourceSectionIds },
    });
  }

  const soaAssessmentDefinitions: SoAAssessmentDefinition[] = [];
  for (const assessment of knowledge.assessments ?? []) {
    if (existingAssessmentNames.has(normalizeSoAName(assessment.name))) {
      const existing = document.soaAssessmentDefinitions?.find(
        (entry) => normalizeSoAName(entry.label) === normalizeSoAName(assessment.name),
      );
      if (existing) {
        assessmentIdByKnowledgeId.set(assessment.id, existing.id);
      }
      continue;
    }
    const assessmentId = nextAssessmentId({
      ...document,
      soaAssessmentDefinitions: [...(document.soaAssessmentDefinitions ?? []), ...soaAssessmentDefinitions],
    });
    assessmentIdByKnowledgeId.set(assessment.id, assessmentId);
    soaAssessmentDefinitions.push({
      id: assessmentId,
      label: assessment.name,
      category: mapAssessmentCategory(assessment.category),
      order: soaAssessmentDefinitions.length + (document.soaAssessmentDefinitions?.length ?? 0),
      linkedSectionId: assessment.sourceSectionIds[0],
      metadata: { soaKnowledgeAssessmentId: assessment.id },
    });
  }

  const assessmentScheduleRules: AssessmentScheduleRule[] = [];
  for (const rule of knowledge.scheduleRules ?? []) {
    const assessmentId = rule.assessmentId ? assessmentIdByKnowledgeId.get(rule.assessmentId) ?? rule.assessmentId : undefined;
    const visitDefinitionId = rule.visitId ? visitIdByKnowledgeId.get(rule.visitId) ?? rule.visitId : undefined;
    if (!assessmentId || !visitDefinitionId) {
      notes.push(`Deferred schedule rule — unresolved assessment/visit linkage.`);
      continue;
    }
    if (
      (document.assessmentScheduleRules ?? []).some(
        (existing) =>
          existing.assessmentId === assessmentId && existing.visitDefinitionId === visitDefinitionId,
      )
    ) {
      continue;
    }
    assessmentScheduleRules.push({
      id: nextRuleId(document),
      assessmentId,
      visitDefinitionId,
      required: rule.required,
      timingNote: rule.notes,
      sourceSectionId: rule.sourceSectionIds[0],
      metadata: { soaKnowledgeRuleId: rule.id },
    });
  }

  return {
    visitDefinitions: visitDefinitions.length > 0 ? visitDefinitions : undefined,
    soaAssessmentDefinitions: soaAssessmentDefinitions.length > 0 ? soaAssessmentDefinitions : undefined,
    assessmentScheduleRules: assessmentScheduleRules.length > 0 ? assessmentScheduleRules : undefined,
    notes: notes.length > 0 ? notes : undefined,
  };
}

export function applySoAConfigurationPatchSafely(
  patch: SoAConfigurationPatch | undefined,
): SoAConfigurationPatchResult {
  const deferred = [...(patch?.notes ?? [])];
  if (!patch) {
    return { applied: false, deferred: ['No configuration patch supplied.'], addedVisits: 0, addedAssessments: 0, addedRules: 0 };
  }

  let addedVisits = 0;
  let addedAssessments = 0;
  let addedRules = 0;

  if (patch.visitDefinitions?.length) {
    mutateProtocolDocument((document) => {
      for (const visit of patch.visitDefinitions ?? []) {
        if (document.visitSchedule.visitDefinitions.some((entry) => entry.id === visit.id)) {
          continue;
        }
        document.visitSchedule.visitDefinitions.push(visit);
        addedVisits += 1;
      }
    });
  }

  for (const assessment of patch.soaAssessmentDefinitions ?? []) {
    if (createSoAAssessmentDefinition(assessment)) {
      addedAssessments += 1;
    } else {
      deferred.push(`Skipped assessment "${assessment.label}" — create failed or duplicate.`);
    }
  }

  for (const rule of patch.assessmentScheduleRules ?? []) {
    if (createAssessmentScheduleRule(rule)) {
      addedRules += 1;
    } else {
      deferred.push(`Skipped schedule rule for ${rule.assessmentId} × ${rule.visitDefinitionId}.`);
    }
  }

  return {
    applied: addedVisits + addedAssessments + addedRules > 0,
    deferred,
    addedVisits,
    addedAssessments,
    addedRules,
  };
}

/** Legacy guarded entry point — delegates to safe patch apply. */
export function applySoAKnowledgeToExistingConfiguration(
  patch?: SoAConfigurationPatch,
): SoAConfigurationPatchResult & { reason?: string } {
  const result = applySoAConfigurationPatchSafely(patch);
  if (!result.applied) {
    return { ...result, reason: result.deferred[0] ?? 'No safe configuration changes to apply.' };
  }
  return result;
}

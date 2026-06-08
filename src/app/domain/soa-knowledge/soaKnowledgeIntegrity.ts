import { getProtocolDocument } from '../protocol/store/protocolStore';
import type { ProtocolDocument } from '../protocol/types';
import { getSoAKnowledge } from './soaKnowledgeStore';
import type { SoAKnowledgeModel } from './soaKnowledgeTypes';
import type { SoAEntityValidationIssue } from './soaEntityValidation';

function issue(
  entityKind: string,
  entityId: string,
  message: string,
  severity: 'error' | 'warning' = 'warning',
): SoAEntityValidationIssue {
  return { field: `${entityKind}:${entityId}`, message, severity };
}

export function validateSoAKnowledgeIntegrity(
  model: SoAKnowledgeModel | null = getSoAKnowledge(),
  document: ProtocolDocument = getProtocolDocument(),
): SoAEntityValidationIssue[] {
  if (!model) {
    return [];
  }

  const issues: SoAEntityValidationIssue[] = [];
  const epochIds = new Set(model.epochs.map((item) => item.id));
  const visitIds = new Set(model.visits.map((item) => item.id));
  const assessmentIds = new Set(model.assessments.map((item) => item.id));
  const activityIds = new Set(model.activities.map((item) => item.id));
  const milestoneIds = new Set((model.milestones ?? []).map((item) => item.id));
  const configVisitIds = new Set((document.visitSchedule?.visitDefinitions ?? []).map((item) => item.id));
  const configAssessmentIds = new Set((document.soaAssessmentDefinitions ?? []).map((item) => item.id));

  for (const visit of model.visits) {
    if (visit.epochId && !epochIds.has(visit.epochId)) {
      issues.push(issue('visit', visit.id, `Visit "${visit.name}" references missing epoch ${visit.epochId}.`));
    }
    if (visit.anchorId && !milestoneIds.has(visit.anchorId)) {
      const anchorExists = (document.visitSchedule?.anchors ?? []).some((anchor) => anchor.id === visit.anchorId);
      if (!anchorExists) {
        issues.push(
          issue('visit', visit.id, `Visit "${visit.name}" references missing milestone/anchor ${visit.anchorId}.`, 'error'),
        );
      }
    }
    if (!configVisitIds.has(visit.id)) {
      issues.push(
        issue('visit', visit.id, `Visit "${visit.name}" exists in SoA Knowledge but not in SoA Configuration.`, 'warning'),
      );
    }
  }

  for (const element of model.elements) {
    if (element.epochId && !epochIds.has(element.epochId)) {
      issues.push(issue('element', element.id, `Element "${element.name}" references missing epoch.`));
    }
    if (element.armId && !model.arms.some((arm) => arm.id === element.armId)) {
      issues.push(issue('element', element.id, `Element "${element.name}" references missing arm.`));
    }
  }

  for (const activity of model.activities) {
    if (activity.visitId && !visitIds.has(activity.visitId)) {
      issues.push(issue('activity', activity.id, `Activity "${activity.name}" references missing visit.`));
    }
    if (activity.elementId && !model.elements.some((element) => element.id === activity.elementId)) {
      issues.push(issue('activity', activity.id, `Activity "${activity.name}" references missing element.`));
    }
  }

  for (const rule of model.scheduleRules) {
    if (rule.visitId && !visitIds.has(rule.visitId) && !configVisitIds.has(rule.visitId)) {
      issues.push(issue('scheduleRule', rule.id, `Schedule rule references missing visit.`, 'error'));
    }
    if (rule.assessmentId && !assessmentIds.has(rule.assessmentId) && !configAssessmentIds.has(rule.assessmentId)) {
      issues.push(issue('scheduleRule', rule.id, `Schedule rule references missing assessment.`, 'error'));
    }
    if (!rule.visitId || (!rule.assessmentId && !rule.activityId)) {
      issues.push(issue('scheduleRule', rule.id, `Schedule rule must link visit and assessment/activity.`, 'error'));
    }
  }

  for (const assessment of model.assessments) {
    const hasRule = model.scheduleRules.some((rule) => rule.assessmentId === assessment.id);
    const hasLinkedVisit = (assessment.linkedVisitIds ?? []).length > 0;
    if (!hasRule && !hasLinkedVisit) {
      issues.push(issue('assessment', assessment.id, `Assessment "${assessment.name}" is not scheduled at any visit (orphan).`));
    }
    if (!configAssessmentIds.has(assessment.id)) {
      issues.push(
        issue('assessment', assessment.id, `Assessment "${assessment.name}" is not in SoA Configuration catalog.`, 'warning'),
      );
    }
  }

  for (const condition of model.conditions) {
    if (condition.appliesToEntityId && !model.scheduleRules.some((rule) => rule.conditionId === condition.id)) {
      issues.push(issue('condition', condition.id, `Condition "${condition.label}" is not linked to a schedule rule.`));
    }
  }

  for (const epoch of model.epochs) {
    if (epoch.startMilestoneId && !milestoneIds.has(epoch.startMilestoneId)) {
      issues.push(issue('epoch', epoch.id, `Epoch "${epoch.name}" references missing start milestone.`));
    }
    if (epoch.endMilestoneId && !milestoneIds.has(epoch.endMilestoneId)) {
      issues.push(issue('epoch', epoch.id, `Epoch "${epoch.name}" references missing end milestone.`));
    }
  }

  return issues;
}

export function validateScheduledAssessmentNarrativeCoverage(
  model: SoAKnowledgeModel | null = getSoAKnowledge(),
  document: ProtocolDocument = getProtocolDocument(),
): SoAEntityValidationIssue[] {
  if (!model) {
    return [];
  }
  const issues: SoAEntityValidationIssue[] = [];
  const section8Text = (document.elements ?? [])
    .filter((element) => element.sectionId === '8' || element.sectionId?.startsWith('8.'))
    .map((element) => String(element.value ?? ''))
    .join(' ')
    .toLowerCase();

  for (const assessment of model.assessments) {
    const scheduled = model.scheduleRules.some((rule) => rule.assessmentId === assessment.id);
    if (!scheduled) {
      continue;
    }
    if (section8Text && !section8Text.includes(assessment.name.toLowerCase())) {
      issues.push(
        issue(
          'assessment',
          assessment.id,
          `Scheduled assessment "${assessment.name}" is not described in Section 8 narrative.`,
        ),
      );
    }
  }
  return issues;
}

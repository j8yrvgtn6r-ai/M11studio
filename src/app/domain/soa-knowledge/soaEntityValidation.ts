import type { ProtocolDocument } from '../protocol/types';
import { getSoAKnowledge } from './soaKnowledgeStore';
import type {
  SoAActivity,
  SoAArm,
  SoAAssessment,
  SoACondition,
  SoAElement,
  SoAEpoch,
  SoAScheduleRule,
  SoAVisit,
} from './soaKnowledgeTypes';
import { normalizeSoAName } from './soaKnowledgePatch';

export type SoAEntityEditorKind =
  | 'epoch'
  | 'arm'
  | 'visit'
  | 'activity'
  | 'element'
  | 'assessment'
  | 'condition'
  | 'scheduleRule'
  | 'milestone';

export interface SoAEntityValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SoAEntityFormValues {
  name: string;
  description?: string;
  code?: string;
  notes?: string;
  epochType?: string;
  order?: number;
  startAnchor?: string;
  endAnchor?: string;
  armType?: string;
  intervention?: string;
  visitType?: string;
  epochId?: string;
  anchorId?: string;
  offset?: string;
  window?: string;
  nominalDay?: number;
  nominalWeek?: number;
  required?: boolean;
  category?: string;
  procedureName?: string;
  armId?: string;
  visitId?: string;
  elementId?: string;
  activityId?: string;
  assessmentId?: string;
  conditionText?: string;
  appliesTo?: string;
  triggerLogic?: string;
  visitDefinitionId?: string;
  footnote?: string;
  milestoneType?: string;
  anchorDateOrEvent?: string;
  plannedDuration?: string;
  linkedVisitIds?: string[];
  linkedActivityIds?: string[];
  appliesToEntityId?: string;
  appliesToEntityKind?: string;
}

function duplicateNameWarning(
  names: string[],
  candidate: string,
  field: string,
): SoAEntityValidationIssue | null {
  const normalized = normalizeSoAName(candidate);
  if (!normalized) {
    return null;
  }
  const matches = names.filter((name) => normalizeSoAName(name) === normalized);
  if (matches.length > 1) {
    return {
      field,
      message: `Duplicate name "${candidate.trim()}" — review for clarity.`,
      severity: 'warning',
    };
  }
  return null;
}

function invalidTimingWarning(values: SoAEntityFormValues): SoAEntityValidationIssue[] {
  const issues: SoAEntityValidationIssue[] = [];
  if (values.window && !/^±?\s*\d+/.test(values.window.trim())) {
    issues.push({
      field: 'window',
      message: 'Visit window should use a recognizable timing format (e.g. ±3 days).',
      severity: 'warning',
    });
  }
  if (values.offset && !/^[-+]?\d+/.test(values.offset.trim())) {
    issues.push({
      field: 'offset',
      message: 'Offset should specify a numeric day/week/cycle offset.',
      severity: 'warning',
    });
  }
  return issues;
}

export function validateSoAEntityForm(
  kind: SoAEntityEditorKind,
  values: SoAEntityFormValues,
  document: ProtocolDocument,
): SoAEntityValidationIssue[] {
  const issues: SoAEntityValidationIssue[] = [];

  if (!values.name?.trim()) {
    issues.push({ field: 'name', message: 'Name is required.', severity: 'error' });
  }

  const knowledge = getSoAKnowledge();

  switch (kind) {
    case 'epoch': {
      const names = (knowledge?.epochs ?? []).map((item) => item.name);
      const duplicate = duplicateNameWarning(names, values.name, 'name');
      if (duplicate) {
        issues.push(duplicate);
      }
      break;
    }
    case 'arm': {
      const names = (knowledge?.arms ?? []).map((item) => item.name);
      const duplicate = duplicateNameWarning(names, values.name, 'name');
      if (duplicate) {
        issues.push(duplicate);
      }
      break;
    }
    case 'visit': {
      if (!values.epochId?.trim()) {
        issues.push({ field: 'epochId', message: 'Visit should link to an epoch when possible.', severity: 'warning' });
      } else if (!(knowledge?.epochs ?? []).some((epoch) => epoch.id === values.epochId)) {
        issues.push({ field: 'epochId', message: 'Selected epoch was not found.', severity: 'warning' });
      }
      if (!values.anchorId?.trim()) {
        issues.push({ field: 'anchorId', message: 'Visit must link to an anchor/milestone.', severity: 'error' });
      } else {
        const anchorExists =
          (document.visitSchedule?.anchors ?? []).some((anchor) => anchor.id === values.anchorId) ||
          (knowledge?.milestones ?? []).some((milestone) => milestone.id === values.anchorId);
        if (!anchorExists) {
          issues.push({ field: 'anchorId', message: 'Selected anchor/milestone was not found.', severity: 'error' });
        }
      }
      issues.push(...invalidTimingWarning(values));
      break;
    }
    case 'milestone': {
      const names = (knowledge?.milestones ?? []).map((item) => item.name);
      const duplicate = duplicateNameWarning(names, values.name, 'name');
      if (duplicate) {
        issues.push(duplicate);
      }
      break;
    }
    case 'element': {
      if (values.epochId && !(knowledge?.epochs ?? []).some((epoch) => epoch.id === values.epochId)) {
        issues.push({ field: 'epochId', message: 'Element references missing epoch.', severity: 'warning' });
      }
      if (values.armId && !(knowledge?.arms ?? []).some((arm) => arm.id === values.armId)) {
        issues.push({ field: 'armId', message: 'Element references missing arm.', severity: 'warning' });
      }
      const names = (knowledge?.elements ?? []).map((item) => item.name);
      const duplicate = duplicateNameWarning(names, values.name, 'name');
      if (duplicate) {
        issues.push(duplicate);
      }
      break;
    }
    case 'activity': {
      if (values.visitId && !(knowledge?.visits ?? []).some((visit) => visit.id === values.visitId)) {
        issues.push({ field: 'visitId', message: 'Activity references missing visit.', severity: 'warning' });
      }
      const names = (knowledge?.activities ?? []).map((item) => item.name);
      const duplicate = duplicateNameWarning(names, values.name, 'name');
      if (duplicate) {
        issues.push(duplicate);
      }
      break;
    }
    case 'assessment':
    case 'condition': {
      if (kind === 'assessment') {
        const names = (knowledge?.assessments ?? []).map((item) => item.name);
        const duplicate = duplicateNameWarning(names, values.name, 'name');
        if (duplicate) {
          issues.push(duplicate);
        }
      } else {
        const names = (knowledge?.conditions ?? []).map((item) => item.label);
        const duplicate = duplicateNameWarning(names, values.name, 'name');
        if (duplicate) {
          issues.push(duplicate);
        }
      }
      break;
    }
    case 'scheduleRule': {
      if (!values.assessmentId?.trim() && !values.activityId?.trim()) {
        issues.push({
          field: 'assessmentId',
          message: 'Schedule rule must reference an assessment or activity.',
          severity: 'error',
        });
      }
      if (!values.visitDefinitionId?.trim()) {
        issues.push({
          field: 'visitDefinitionId',
          message: 'Schedule rule must reference a visit.',
          severity: 'error',
        });
      } else {
        const visitExists = (document.visitSchedule?.visitDefinitions ?? []).some(
          (visit) => visit.id === values.visitDefinitionId,
        );
        if (!visitExists) {
          issues.push({
            field: 'visitDefinitionId',
            message: 'Selected visit definition was not found.',
            severity: 'error',
          });
        }
      }
      break;
    }
  }

  return issues;
}

export function hasBlockingValidationIssues(issues: SoAEntityValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function describeEntityForImpact(
  kind: SoAEntityEditorKind,
  entity: SoAArm | SoAEpoch | SoAElement | SoAVisit | SoAActivity | SoAAssessment | SoACondition | SoAScheduleRule,
): { changeKind: 'assessmentAdded' | 'visitAdded' | 'scheduleRuleChanged' | 'interventionActivity' | 'other'; entityKind: string; entityName: string } {
  switch (kind) {
    case 'assessment':
      return { changeKind: 'assessmentAdded', entityKind: 'assessment', entityName: entity.name };
    case 'visit':
      return { changeKind: 'visitAdded', entityKind: 'visit', entityName: entity.name };
    case 'scheduleRule':
      return { changeKind: 'scheduleRuleChanged', entityKind: 'scheduleRule', entityName: 'name' in entity ? String(entity.name) : 'Schedule rule' };
    case 'activity':
      return { changeKind: 'interventionActivity', entityKind: 'activity', entityName: entity.name };
    default:
      return { changeKind: 'other', entityKind: kind, entityName: entity.name };
  }
}

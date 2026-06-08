import type {
  StudyDesign,
  StudyDesignValidationIssue,
  StudyDesignValidationResult,
} from './StudyDesignTypes';
import { getStudyDesign } from './StudyDesignStore';

function issue(
  field: string,
  message: string,
  severity: 'error' | 'warning',
  entityKind?: string,
  entityId?: string,
): StudyDesignValidationIssue {
  return { field, message, severity, entityKind, entityId };
}

function duplicateNameIssues(
  items: Array<{ id: string; name: string }>,
  entityKind: string,
): StudyDesignValidationIssue[] {
  const seen = new Map<string, string>();
  const issues: StudyDesignValidationIssue[] = [];
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key) {
      continue;
    }
    const existingId = seen.get(key);
    if (existingId) {
      issues.push(
        issue(
          `${entityKind}:${item.id}:name`,
          `Duplicate ${entityKind} name "${item.name}".`,
          'error',
          entityKind,
          item.id,
        ),
      );
    } else {
      seen.set(key, item.id);
    }
  }
  return issues;
}

export function validateStudyDesign(model: StudyDesign | null = getStudyDesign()): StudyDesignValidationResult {
  if (!model) {
    return {
      issues: [],
      summary: { errorCount: 0, warningCount: 0, status: 'healthy' },
    };
  }

  const issues: StudyDesignValidationIssue[] = [];
  const epochIds = new Set(model.epochs.map((item) => item.id));
  const visitIds = new Set(model.visits.map((item) => item.id));
  const activityIds = new Set(model.activities.map((item) => item.id));
  const milestoneIds = new Set(model.milestones.map((item) => item.id));
  const visitsByEpoch = new Map<string, number>();

  issues.push(...duplicateNameIssues(model.visits, 'visit'));
  issues.push(...duplicateNameIssues(model.activities, 'activity'));

  for (const visit of model.visits) {
    if ((visit.windowBefore ?? 0) < 0 || (visit.windowAfter ?? 0) < 0) {
      issues.push(
        issue(
          'visit:window',
          `Visit "${visit.name}" has negative window values.`,
          'error',
          'visit',
          visit.id,
        ),
      );
    }
    if (
      visit.windowBefore != null &&
      visit.windowAfter != null &&
      visit.windowBefore === 0 &&
      visit.windowAfter === 0 &&
      visit.nominalDay == null &&
      visit.nominalWeek == null
    ) {
      issues.push(
        issue(
          'visit:window',
          `Visit "${visit.name}" has zero-width window without nominal timing.`,
          'warning',
          'visit',
          visit.id,
        ),
      );
    }
    if (visit.scheduleAnchorId && !(model.anchors ?? []).some((anchor) => anchor.id === visit.scheduleAnchorId)) {
      issues.push(
        issue(
          'visit:scheduleAnchorId',
          `Visit "${visit.name}" references missing schedule anchor.`,
          'error',
          'visit',
          visit.id,
        ),
      );
    }

    if (!visit.epochId) {
      issues.push(
        issue('visit:epochId', `Visit "${visit.name}" has no epoch.`, 'error', 'visit', visit.id),
      );
    } else if (!epochIds.has(visit.epochId)) {
      issues.push(
        issue(
          'visit:epochId',
          `Visit "${visit.name}" references missing epoch.`,
          'error',
          'visit',
          visit.id,
        ),
      );
    } else {
      visitsByEpoch.set(visit.epochId, (visitsByEpoch.get(visit.epochId) ?? 0) + 1);
    }
  }

  for (const epoch of model.epochs) {
    if (!visitsByEpoch.has(epoch.id)) {
      issues.push(
        issue(
          'epoch:visits',
          `Epoch "${epoch.name}" has no visits assigned.`,
          'warning',
          'epoch',
          epoch.id,
        ),
      );
    }
  }

  for (const rule of model.scheduleRules) {
    if (!rule.visitId) {
      issues.push(
        issue(
          'scheduleRule:visitId',
          'Schedule rule is missing a visit.',
          'error',
          'scheduleRule',
          rule.id,
        ),
      );
    } else if (!visitIds.has(rule.visitId)) {
      issues.push(
        issue(
          'scheduleRule:visitId',
          'Schedule rule references missing visit.',
          'error',
          'scheduleRule',
          rule.id,
        ),
      );
    }
    if (!rule.activityId) {
      issues.push(
        issue(
          'scheduleRule:activityId',
          'Schedule rule is missing an activity.',
          'error',
          'scheduleRule',
          rule.id,
        ),
      );
    } else if (!activityIds.has(rule.activityId)) {
      issues.push(
        issue(
          'scheduleRule:activityId',
          'Schedule rule references missing activity.',
          'error',
          'scheduleRule',
          rule.id,
        ),
      );
    }
  }

  const scheduledActivityIds = new Set(model.scheduleRules.map((rule) => rule.activityId));
  for (const activity of model.activities) {
    if (!scheduledActivityIds.has(activity.id)) {
      issues.push(
        issue(
          'activity:schedule',
          `Activity "${activity.name}" is not scheduled at any visit.`,
          'warning',
          'activity',
          activity.id,
        ),
      );
    }
  }

  const timingKeys = new Map<string, string[]>();
  for (const visit of model.visits) {
    const key =
      visit.nominalDay != null
        ? `day:${visit.nominalDay}`
        : visit.nominalWeek != null
          ? `week:${visit.nominalWeek}`
          : null;
    if (key) {
      timingKeys.set(key, [...(timingKeys.get(key) ?? []), visit.id]);
    }
  }
  for (const [key, ids] of timingKeys.entries()) {
    if (ids.length > 1) {
      issues.push(
        issue(
          'visit:timing',
          `Duplicate visit timing "${key}" (${ids.length} visits).`,
          'warning',
          'visit',
          ids[0],
        ),
      );
    }
  }

  const linkedMilestoneIds = new Set<string>();
  for (const visit of model.visits) {
    if (visit.anchorVisit && milestoneIds.has(visit.anchorVisit)) {
      linkedMilestoneIds.add(visit.anchorVisit);
    }
  }
  for (const milestone of model.milestones) {
    const linked =
      linkedMilestoneIds.has(milestone.id) ||
      (milestone.anchorVisitId && visitIds.has(milestone.anchorVisitId));
    if (!linked) {
      issues.push(
        issue(
          'milestone:link',
          `Milestone "${milestone.name}" is not linked to a visit anchor.`,
          'warning',
          'milestone',
          milestone.id,
        ),
      );
    }
  }

  const errorCount = issues.filter((entry) => entry.severity === 'error').length;
  const warningCount = issues.filter((entry) => entry.severity === 'warning').length;
  const status = errorCount > 0 ? 'errors' : warningCount > 0 ? 'warnings' : 'healthy';

  return {
    issues,
    summary: { errorCount, warningCount, status },
  };
}

export function hasBlockingStudyDesignValidationIssues(result: StudyDesignValidationResult): boolean {
  return result.summary.errorCount > 0;
}

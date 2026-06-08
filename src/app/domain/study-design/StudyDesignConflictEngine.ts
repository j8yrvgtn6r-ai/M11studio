import { getStudyDesign } from './StudyDesignStore';
import type { StudyDesign, StudyDesignConflict } from './StudyDesignTypes';

function conflict(
  kind: string,
  message: string,
  severity: StudyDesignConflict['severity'],
  options: { entityId?: string; entityName?: string; resolutionSuggestion?: string } = {},
): StudyDesignConflict {
  return {
    id: `conflict-${kind}-${options.entityId ?? Date.now()}`,
    kind,
    message,
    severity,
    entityId: options.entityId,
    entityName: options.entityName,
    resolutionSuggestion: options.resolutionSuggestion,
  };
}

function visitTimingKey(visit: StudyDesign['visits'][number]): string | null {
  if (visit.nominalDay != null) return `day:${visit.nominalDay}`;
  if (visit.nominalWeek != null) return `week:${visit.nominalWeek}`;
  if (visit.scheduleAnchorId && visit.offsetDays != null) {
    return `anchor:${visit.scheduleAnchorId}:${visit.offsetDays}`;
  }
  return null;
}

function visitWindowRange(visit: StudyDesign['visits'][number]): { start: number; end: number } | null {
  const center = visit.nominalDay ?? (visit.nominalWeek != null ? visit.nominalWeek * 7 : null);
  if (center == null) return null;
  const before = visit.windowBefore ?? 0;
  const after = visit.windowAfter ?? 0;
  return { start: center - before, end: center + after };
}

export function detectStudyDesignConflicts(model: StudyDesign | null = getStudyDesign()): StudyDesignConflict[] {
  if (!model) return [];

  const conflicts: StudyDesignConflict[] = [];
  const epochIds = new Set(model.epochs.map((item) => item.id));
  const anchorIds = new Set((model.anchors ?? []).map((item) => item.id));
  const visitIds = new Set(model.visits.map((item) => item.id));
  const milestoneNames = new Map<string, string[]>();

  for (const milestone of model.milestones) {
    const key = milestone.name.trim().toLowerCase();
    milestoneNames.set(key, [...(milestoneNames.get(key) ?? []), milestone.id]);
  }

  for (const [name, ids] of milestoneNames.entries()) {
    if (ids.length > 1) {
      conflicts.push(
        conflict('duplicateMilestone', `Duplicate milestone name "${name}".`, 'error', {
          resolutionSuggestion: 'Merge or rename duplicate milestones.',
        }),
      );
    }
  }

  const timingBuckets = new Map<string, string[]>();
  for (const visit of model.visits) {
    if (visit.epochId && !epochIds.has(visit.epochId)) {
      conflicts.push(
        conflict('visitOutsideEpoch', `Visit "${visit.name}" references missing epoch.`, 'error', {
          entityId: visit.id,
          entityName: visit.name,
          resolutionSuggestion: 'Assign visit to a valid epoch.',
        }),
      );
    }

    if (visit.scheduleAnchorId && !anchorIds.has(visit.scheduleAnchorId)) {
      conflicts.push(
        conflict('orphanAnchorReference', `Visit "${visit.name}" references missing schedule anchor.`, 'error', {
          entityId: visit.id,
          entityName: visit.name,
          resolutionSuggestion: 'Create the anchor or update the visit reference.',
        }),
      );
    }

    const key = visitTimingKey(visit);
    if (key) {
      timingBuckets.set(key, [...(timingBuckets.get(key) ?? []), visit.id]);
    }
  }

  for (const [key, visitIdList] of timingBuckets.entries()) {
    if (visitIdList.length > 1) {
      conflicts.push(
        conflict('duplicateVisitTiming', `Duplicate visit timing "${key}" (${visitIdList.length} visits).`, 'warning', {
          resolutionSuggestion: 'Review visit timing or merge duplicate visits.',
        }),
      );
    }
  }

  const ranges: Array<{ visit: StudyDesign['visits'][number]; range: { start: number; end: number } }> = [];
  for (const visit of model.visits) {
    const range = visitWindowRange(visit);
    if (range) ranges.push({ visit, range });
  }
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      if (a.range.start <= b.range.end && b.range.start <= a.range.end) {
        conflicts.push(
          conflict(
            'visitOverlap',
            `Visit windows overlap: "${a.visit.name}" and "${b.visit.name}".`,
            'warning',
            {
              entityId: a.visit.id,
              entityName: a.visit.name,
              resolutionSuggestion: 'Adjust visit windows or nominal timing.',
            },
          ),
        );
      }
    }
  }

  const scheduledActivityIds = new Set(model.scheduleRules.map((rule) => rule.activityId));
  for (const activity of model.activities) {
    if (!scheduledActivityIds.has(activity.id)) {
      conflicts.push(
        conflict('unscheduledActivity', `Activity "${activity.name}" is not scheduled at any visit.`, 'warning', {
          entityId: activity.id,
          entityName: activity.name,
          resolutionSuggestion: 'Add a schedule rule linking the activity to a visit.',
        }),
      );
    }
  }

  const linkedMilestoneIds = new Set<string>();
  for (const visit of model.visits) {
    if (visit.anchorVisit && visitIds.has(visit.anchorVisit)) {
      linkedMilestoneIds.add(visit.anchorVisit);
    }
    if (visit.scheduleAnchorId) {
      const anchor = (model.anchors ?? []).find((item) => item.id === visit.scheduleAnchorId);
      if (anchor && visit.offsetDays != null && visit.offsetDays < 0) {
        conflicts.push(
          conflict(
            'activityBeforeAnchor',
            `Visit "${visit.name}" is scheduled before its anchor (${anchor.name}).`,
            'warning',
            {
              entityId: visit.id,
              entityName: visit.name,
              resolutionSuggestion: 'Use a non-negative offset from the anchor.',
            },
          ),
        );
      }
    }
  }
  for (const milestone of model.milestones) {
    const linked =
      linkedMilestoneIds.has(milestone.id) ||
      (milestone.anchorVisitId && visitIds.has(milestone.anchorVisitId));
    if (!linked) {
      conflicts.push(
        conflict('orphanMilestone', `Milestone "${milestone.name}" is not linked to visits or anchors.`, 'warning', {
          entityId: milestone.id,
          entityName: milestone.name,
          resolutionSuggestion: 'Link milestone to a visit or schedule anchor.',
        }),
      );
    }
  }

  return conflicts;
}

export function hasBlockingStudyDesignConflicts(conflicts: StudyDesignConflict[] = detectStudyDesignConflicts()): boolean {
  return conflicts.some((item) => item.severity === 'error');
}

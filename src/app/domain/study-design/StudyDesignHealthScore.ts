import { getCurrentNarrativeImpactProposal } from './studyDesignProposalStore';
import { getStudyDesign } from './StudyDesignStore';
import { detectStudyDesignConflicts } from './StudyDesignConflictEngine';
import { validateStudyDesign } from './StudyDesignValidation';
import type { StudyDesignHealthScore } from './StudyDesignTypes';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function gradeFromScore(score: number): StudyDesignHealthScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export function calculateStudyDesignHealthScore(
  model = getStudyDesign(),
): StudyDesignHealthScore {
  if (!model) {
    return {
      score: 0,
      grade: 'D',
      dimensions: {
        structureCompleteness: 0,
        visitCompleteness: 0,
        activityCoverage: 0,
        milestoneCoverage: 0,
        scheduleCoverage: 0,
        narrativeSyncStatus: 0,
      },
      summary: 'No Study Design model exists.',
    };
  }

  const structureParts = [
    model.epochs.length > 0,
    model.arms.length > 0,
    model.visits.length > 0,
    model.activities.length > 0,
  ];
  const structureCompleteness = clamp((structureParts.filter(Boolean).length / structureParts.length) * 100);

  const visitsWithEpoch = model.visits.filter((visit) => visit.epochId).length;
  const visitsWithTiming = model.visits.filter(
    (visit) =>
      visit.nominalDay != null ||
      visit.nominalWeek != null ||
      (visit.scheduleAnchorId && visit.offsetDays != null),
  ).length;
  const visitCompleteness =
    model.visits.length === 0
      ? 0
      : clamp(((visitsWithEpoch / model.visits.length) * 50 + (visitsWithTiming / model.visits.length) * 50));

  const scheduledIds = new Set(model.scheduleRules.map((rule) => rule.activityId));
  const activityCoverage =
    model.activities.length === 0
      ? 0
      : clamp((model.activities.filter((activity) => scheduledIds.has(activity.id)).length / model.activities.length) * 100);

  const linkedMilestones = model.milestones.filter(
    (milestone) =>
      milestone.anchorVisitId ||
      model.visits.some((visit) => visit.scheduleAnchorId || visit.anchorVisit === milestone.id),
  ).length;
  const milestoneCoverage =
    model.milestones.length === 0
      ? model.visits.length > 0
        ? 40
        : 0
      : clamp((linkedMilestones / model.milestones.length) * 100);

  const scheduleCoverage =
    model.visits.length === 0 || model.activities.length === 0
      ? 0
      : clamp((model.scheduleRules.length / Math.max(model.visits.length, 1)) * 25 + (model.scheduleRules.length > 0 ? 75 : 0));

  const validation = validateStudyDesign(model);
  const conflicts = detectStudyDesignConflicts(model);
  const pendingNarrative = getCurrentNarrativeImpactProposal()?.status === 'proposed';
  let narrativeSyncStatus = 100;
  if (pendingNarrative) narrativeSyncStatus -= 30;
  if (validation.summary.errorCount > 0) narrativeSyncStatus -= 40;
  if (conflicts.some((item) => item.severity === 'error')) narrativeSyncStatus -= 20;
  narrativeSyncStatus = clamp(narrativeSyncStatus);

  const score = clamp(
    structureCompleteness * 0.2 +
      visitCompleteness * 0.2 +
      activityCoverage * 0.15 +
      milestoneCoverage * 0.15 +
      scheduleCoverage * 0.15 +
      narrativeSyncStatus * 0.15,
  );

  return {
    score,
    grade: gradeFromScore(score),
    dimensions: {
      structureCompleteness,
      visitCompleteness,
      activityCoverage,
      milestoneCoverage,
      scheduleCoverage,
      narrativeSyncStatus,
    },
    summary: `Study Design health ${score}/100 (Grade ${gradeFromScore(score)}).`,
  };
}

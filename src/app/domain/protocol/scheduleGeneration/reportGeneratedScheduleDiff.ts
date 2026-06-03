import type { ProtocolDocument, ScheduleDefinition } from '../types';
import {
  compareGeneratedScheduleToAuthoritative,
  formatGeneratedScheduleComparisonReport,
  type GeneratedScheduleComparisonReport,
} from './compareGeneratedSchedule';

export interface GeneratedScheduleDiffReport extends GeneratedScheduleComparisonReport {
  structurallyEquivalent: boolean;
  knownContentDiffs: string[];
  message: string;
}

function areCellNotesOnlyDiffs(report: GeneratedScheduleComparisonReport): boolean {
  const cellSection = report.sections.find((section) => section.name === 'cells');
  if (!cellSection || cellSection.passed) {
    return true;
  }

  return cellSection.differences.every((difference) => difference.path.endsWith('.notes'));
}

function collectKnownContentDiffs(report: GeneratedScheduleComparisonReport): string[] {
  const known: string[] = [];

  const visitSection = report.sections.find((section) => section.name === 'visits');
  const assessmentSection = report.sections.find((section) => section.name === 'assessments');
  const cellSection = report.sections.find((section) => section.name === 'cells');

  if (visitSection && !visitSection.passed) {
    known.push('Visit label/timepoint differences between legacy schedule and generated preview.');
  }

  if (assessmentSection && !assessmentSection.passed) {
    known.push('Assessment row metadata differences between legacy schedule and generated preview.');
  }

  if (cellSection && !cellSection.passed && areCellNotesOnlyDiffs(report)) {
    known.push(
      'Cell notes: generated schedule maps AssessmentScheduleRule.timingNote to ScheduleCell.notes; legacy schedule.cells omit notes for some intersections (e.g. tumor imaging at v6/a8 and v8/a8).'
    );
  } else if (cellSection && !cellSection.passed) {
    known.push('Cell content differences beyond known timingNote/notes mapping.');
  }

  if (known.length === 0 && report.sections.every((section) => section.passed)) {
    known.push('No content differences detected.');
  }

  return known;
}

/** Reports structural equivalence and known content diffs between legacy and generated schedules. */
export function reportGeneratedScheduleDiff(
  document: ProtocolDocument
): GeneratedScheduleDiffReport {
  const comparison = compareGeneratedScheduleToAuthoritative(document);
  const structurallyEquivalent = comparison.structuralIssues.length === 0;
  const knownContentDiffs = collectKnownContentDiffs(comparison);
  const contentDiffSections = comparison.sections.filter((section) => !section.passed);
  const onlyKnownContentDiffs =
    structurallyEquivalent &&
    (contentDiffSections.length === 0 ||
      (contentDiffSections.length === 1 &&
        contentDiffSections[0].name === 'cells' &&
        areCellNotesOnlyDiffs(comparison)));

  const message = !structurallyEquivalent
    ? 'Generated and legacy schedules are not structurally equivalent.'
    : onlyKnownContentDiffs
      ? 'Generated and legacy schedules are structurally equivalent. Remaining diffs are known content differences only.'
      : 'Generated and legacy schedules are structurally equivalent but include unexpected content diffs.';

  return {
    ...comparison,
    structurallyEquivalent,
    knownContentDiffs,
    message,
  };
}

export function formatGeneratedScheduleDiffReport(report: GeneratedScheduleDiffReport): string {
  const lines = [formatGeneratedScheduleComparisonReport(report), '', report.message, ''];

  lines.push('Known content diff notes:');
  for (const note of report.knownContentDiffs) {
    lines.push(`  - ${note}`);
  }

  return lines.join('\n');
}

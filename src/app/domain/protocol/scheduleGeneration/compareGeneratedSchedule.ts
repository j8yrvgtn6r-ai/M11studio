import type { ProtocolDocument, ScheduleCell, ScheduleDefinition } from '../types';
import { deepEqual, formatDifferences } from '../parity/deepEqual';
import { generateScheduleFromRules } from './generateScheduleFromRules';

export interface ScheduleComparisonDifference {
  path: string;
  expected: unknown;
  actual: unknown;
}

export interface ScheduleComparisonSection {
  name: 'visits' | 'assessments' | 'cells';
  passed: boolean;
  differences: ScheduleComparisonDifference[];
}

export interface GeneratedScheduleComparisonReport {
  passed: boolean;
  structuralIssues: string[];
  sections: ScheduleComparisonSection[];
  summary: {
    authoritativeVisitCount: number;
    generatedVisitCount: number;
    authoritativeAssessmentCount: number;
    generatedAssessmentCount: number;
    authoritativeCellCount: number;
    generatedCellCount: number;
  };
}

function sortCells(cells: ScheduleCell[]): ScheduleCell[] {
  return [...cells].sort((left, right) => {
    const visitCompare = left.visitId.localeCompare(right.visitId);
    if (visitCompare !== 0) {
      return visitCompare;
    }
    return left.assessmentId.localeCompare(right.assessmentId);
  });
}

function collectStructuralIssues(
  authoritative: ScheduleDefinition,
  generated: ScheduleDefinition
): string[] {
  const issues: string[] = [];

  if (generated.visits.length === 0) {
    issues.push('generated schedule has no visits');
  }

  if (generated.assessments.length === 0) {
    issues.push('generated schedule has no assessments');
  }

  if (generated.cells.length === 0) {
    issues.push('generated schedule has no cells');
  }

  if (generated.visits.length !== authoritative.visits.length) {
    issues.push(
      `visit count mismatch: authoritative=${authoritative.visits.length}, generated=${generated.visits.length}`
    );
  }

  if (generated.cells.length !== authoritative.cells.length) {
    issues.push(
      `cell count mismatch: authoritative=${authoritative.cells.length}, generated=${generated.cells.length}`
    );
  }

  const generatedVisitIds = new Set(generated.visits.map((visit) => visit.id));
  const generatedAssessmentIds = new Set(generated.assessments.map((assessment) => assessment.id));

  for (const cell of generated.cells) {
    if (!generatedVisitIds.has(cell.visitId)) {
      issues.push(`generated cell references unknown visitId "${cell.visitId}"`);
    }
    if (!generatedAssessmentIds.has(cell.assessmentId)) {
      issues.push(`generated cell references unknown assessmentId "${cell.assessmentId}"`);
    }
  }

  return issues;
}

/** Compares generated schedule output against the current authoritative schedule block. */
export function compareGeneratedScheduleToAuthoritative(
  document: ProtocolDocument
): GeneratedScheduleComparisonReport {
  const authoritative = document.schedule;
  const generatedSchedule = generateScheduleFromRules(document);
  const generated: ScheduleDefinition = {
    visits: generatedSchedule.visits,
    assessments: generatedSchedule.assessments,
    cells: generatedSchedule.cells,
  };
  const structuralIssues = collectStructuralIssues(authoritative, generated);

  const sections: ScheduleComparisonSection[] = [
    {
      name: 'visits',
      passed: deepEqual(authoritative.visits, generated.visits, 'visits').length === 0,
      differences: deepEqual(authoritative.visits, generated.visits, 'visits'),
    },
    {
      name: 'assessments',
      passed: deepEqual(authoritative.assessments, generated.assessments, 'assessments').length === 0,
      differences: deepEqual(authoritative.assessments, generated.assessments, 'assessments'),
    },
    {
      name: 'cells',
      passed:
        deepEqual(sortCells(authoritative.cells), sortCells(generated.cells), 'cells').length === 0,
      differences: deepEqual(sortCells(authoritative.cells), sortCells(generated.cells), 'cells'),
    },
  ];

  return {
    passed: structuralIssues.length === 0,
    structuralIssues,
    sections,
    summary: {
      authoritativeVisitCount: authoritative.visits.length,
      generatedVisitCount: generated.visits.length,
      authoritativeAssessmentCount: authoritative.assessments.length,
      generatedAssessmentCount: generated.assessments.length,
      authoritativeCellCount: authoritative.cells.length,
      generatedCellCount: generated.cells.length,
    },
  };
}

export function formatGeneratedScheduleComparisonReport(
  report: GeneratedScheduleComparisonReport
): string {
  const lines = ['Generated schedule comparison report', ''];

  lines.push(`Structural check: ${report.structuralIssues.length === 0 ? 'PASS' : 'FAIL'}`);
  lines.push(
    `Visits: authoritative=${report.summary.authoritativeVisitCount}, generated=${report.summary.generatedVisitCount}`
  );
  lines.push(
    `Assessments: authoritative=${report.summary.authoritativeAssessmentCount}, generated=${report.summary.generatedAssessmentCount}`
  );
  lines.push(
    `Cells: authoritative=${report.summary.authoritativeCellCount}, generated=${report.summary.generatedCellCount}`
  );
  lines.push('');

  if (report.structuralIssues.length > 0) {
    lines.push('Structural issues:');
    for (const issue of report.structuralIssues) {
      lines.push(`  - ${issue}`);
    }
    lines.push('');
  }

  for (const section of report.sections) {
    lines.push(`${section.passed ? 'MATCH' : 'DIFF'} ${section.name}`);
    if (!section.passed && section.differences.length > 0) {
      lines.push(formatDifferences(section.differences.slice(0, 20)));
      if (section.differences.length > 20) {
        lines.push(`  ... ${section.differences.length - 20} more difference(s)`);
      }
    }
    lines.push('');
  }

  lines.push(
    report.structuralIssues.length === 0
      ? 'Generated schedule is structurally valid for preview.'
      : 'Generated schedule has structural issues.'
  );

  return lines.join('\n');
}

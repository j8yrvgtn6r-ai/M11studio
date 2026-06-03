import type { ProtocolDocument, ScheduleCell, ScheduleDefinition } from '../types';
import { deepEqual, type DeepEqualDifference } from '../parity/deepEqual';
import { generatedScheduleFixtures } from '../parity/loadGeneratedScheduleFixtures';
import { generateScheduleFromRules } from './generateScheduleFromRules';

export type ScheduleParitySectionName = 'visits' | 'assessments' | 'cells' | 'metadata';

export type ScheduleDifferenceKind = 'structural' | 'content' | 'accepted';

export interface AcceptedScheduleContentDiff {
  id: string;
  section: 'cells';
  visitId: string;
  assessmentId: string;
  field: 'notes';
  value: string;
  reason: string;
}

/** Known accepted legacy-vs-generated content differences for PROTO-XYZ-301. */
export const ACCEPTED_LEGACY_SCHEDULE_CONTENT_DIFFS: AcceptedScheduleContentDiff[] = [
  {
    id: 'tumor-imaging-v6-a8-notes',
    section: 'cells',
    visitId: 'v6',
    assessmentId: 'a8',
    field: 'notes',
    value: 'Every 8 weeks from first dose, independent of dose delays',
    reason:
      'Generated schedule maps AssessmentScheduleRule.timingNote to ScheduleCell.notes; legacy schedule.cells omit notes at v6/a8.',
  },
  {
    id: 'tumor-imaging-v8-a8-notes',
    section: 'cells',
    visitId: 'v8',
    assessmentId: 'a8',
    field: 'notes',
    value: 'Every 8 weeks from first dose, independent of dose delays',
    reason:
      'Generated schedule maps AssessmentScheduleRule.timingNote to ScheduleCell.notes; legacy schedule.cells omit notes at v8/a8.',
  },
];

export interface ClassifiedScheduleDifference {
  kind: ScheduleDifferenceKind;
  section: ScheduleParitySectionName;
  path: string;
  expected: unknown;
  actual: unknown;
  acceptedDiffId?: string;
  message?: string;
}

export interface ScheduleSectionParityResult {
  name: ScheduleParitySectionName;
  fixtureParityPassed: boolean;
  legacyParityPassed: boolean;
  differences: ClassifiedScheduleDifference[];
}

export interface ScheduleParityReport {
  passed: boolean;
  fixtureParityPassed: boolean;
  legacyReplacementCandidate: boolean;
  structuralDifferences: ClassifiedScheduleDifference[];
  contentDifferences: ClassifiedScheduleDifference[];
  acceptedDifferences: ClassifiedScheduleDifference[];
  sections: ScheduleSectionParityResult[];
  summary: {
    protocolId: string;
    fixtureVisitCount: number;
    fixtureAssessmentCount: number;
    fixtureCellCount: number;
    legacyVisitCount: number;
    legacyAssessmentCount: number;
    legacyCellCount: number;
    generatedVisitCount: number;
    generatedAssessmentCount: number;
    generatedCellCount: number;
  };
  message: string;
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

function classifyDifference(
  section: ScheduleParitySectionName,
  difference: DeepEqualDifference
): ClassifiedScheduleDifference {
  return {
    kind: 'content',
    section,
    path: difference.path,
    expected: difference.expected,
    actual: difference.actual,
  };
}

function compareSectionParity(
  section: Exclude<ScheduleParitySectionName, 'metadata'>,
  expected: ScheduleDefinition[typeof section],
  actual: ScheduleDefinition[typeof section]
): ScheduleSectionParityResult {
  const left = section === 'cells' ? sortCells(expected as ScheduleCell[]) : expected;
  const right = section === 'cells' ? sortCells(actual as ScheduleCell[]) : actual;
  const rawDifferences = deepEqual(left, right, section);
  const differences = rawDifferences.map((difference) => classifyDifference(section, difference));

  return {
    name: section,
    fixtureParityPassed: differences.length === 0,
    legacyParityPassed: true,
    differences,
  };
}

function buildStableGeneratedMetadata(document: ProtocolDocument) {
  const generated = generateScheduleFromRules(document);

  return {
    generatedFromRules: generated.metadata.generatedFromRules,
    sourceRuleCount: generated.metadata.sourceRuleCount,
    sourceVisitDefinitionCount: generated.metadata.sourceVisitDefinitionCount,
    sourceSoAAssessmentDefinitionCount: document.soaAssessmentDefinitions?.length ?? 0,
  };
}

function compareMetadataFixtureParity(document: ProtocolDocument): ScheduleSectionParityResult {
  const actual = buildStableGeneratedMetadata(document);
  const rawDifferences = deepEqual(generatedScheduleFixtures.metadata, actual, 'metadata');
  const differences = rawDifferences.map((difference) => classifyDifference('metadata', difference));

  return {
    name: 'metadata',
    fixtureParityPassed: differences.length === 0,
    legacyParityPassed: true,
    differences,
  };
}

function compareMetadataLegacyParity(document: ProtocolDocument): ScheduleSectionParityResult {
  const generatedMetadata = buildStableGeneratedMetadata(document);
  const legacyMetadata = document.schedule.metadata;
  const differences: ClassifiedScheduleDifference[] = [];

  if (legacyMetadata?.generatedFromRules === true) {
    const rawDifferences = deepEqual(
      {
        generatedFromRules: legacyMetadata.generatedFromRules,
        sourceRuleCount: legacyMetadata.sourceRuleCount,
        sourceVisitDefinitionCount: legacyMetadata.sourceVisitDefinitionCount,
        sourceSoAAssessmentDefinitionCount: legacyMetadata.sourceSoAAssessmentDefinitionCount,
      },
      generatedMetadata,
      'metadata'
    );

    for (const difference of rawDifferences) {
      differences.push(classifyDifference('metadata', difference));
    }
  }

  return {
    name: 'metadata',
    fixtureParityPassed: true,
    legacyParityPassed: differences.filter((difference) => difference.kind !== 'accepted').length === 0,
    differences,
  };
}

function collectStructuralDifferences(
  legacy: ScheduleDefinition,
  generated: Pick<ScheduleDefinition, 'visits' | 'assessments' | 'cells'>
): ClassifiedScheduleDifference[] {
  const differences: ClassifiedScheduleDifference[] = [];

  const checks: Array<[string, number, number]> = [
    ['visits', legacy.visits.length, generated.visits.length],
    ['assessments', legacy.assessments.length, generated.assessments.length],
    ['cells', legacy.cells.length, generated.cells.length],
  ];

  for (const [section, legacyCount, generatedCount] of checks) {
    if (legacyCount !== generatedCount) {
      differences.push({
        kind: 'structural',
        section: section as ScheduleParitySectionName,
        path: `${section}.length`,
        expected: legacyCount,
        actual: generatedCount,
        message: `${section} count mismatch between legacy schedule and generated schedule`,
      });
    }
  }

  if (generated.visits.length === 0 || generated.assessments.length === 0 || generated.cells.length === 0) {
    differences.push({
      kind: 'structural',
      section: 'cells',
      path: 'generatedSchedule',
      expected: 'non-empty generated schedule',
      actual: {
        visits: generated.visits.length,
        assessments: generated.assessments.length,
        cells: generated.cells.length,
      },
      message: 'Generated schedule must contain visits, assessments, and cells',
    });
  }

  const generatedVisitIds = new Set(generated.visits.map((visit) => visit.id));
  const generatedAssessmentIds = new Set(generated.assessments.map((assessment) => assessment.id));

  for (const cell of generated.cells) {
    if (!generatedVisitIds.has(cell.visitId)) {
      differences.push({
        kind: 'structural',
        section: 'cells',
        path: `cells.visitId`,
        expected: 'known generated visit id',
        actual: cell.visitId,
        message: `Generated cell references unknown visitId "${cell.visitId}"`,
      });
    }

    if (!generatedAssessmentIds.has(cell.assessmentId)) {
      differences.push({
        kind: 'structural',
        section: 'cells',
        path: `cells.assessmentId`,
        expected: 'known generated assessment id',
        actual: cell.assessmentId,
        message: `Generated cell references unknown assessmentId "${cell.assessmentId}"`,
      });
    }
  }

  return differences;
}

function classifyLegacyCellDifference(
  difference: DeepEqualDifference,
  generatedCells: ScheduleCell[]
): ClassifiedScheduleDifference {
  if (!difference.path.endsWith('.notes')) {
    return {
      kind: 'content',
      section: 'cells',
      path: difference.path,
      expected: difference.expected,
      actual: difference.actual,
    };
  }

  const cellIndexMatch = /^cells\[(\d+)\]\.notes$/.exec(difference.path);
  if (!cellIndexMatch) {
    return {
      kind: 'content',
      section: 'cells',
      path: difference.path,
      expected: difference.expected,
      actual: difference.actual,
    };
  }

  const cellIndex = Number(cellIndexMatch[1]);
  const generatedCell = generatedCells[cellIndex];

  const accepted = ACCEPTED_LEGACY_SCHEDULE_CONTENT_DIFFS.find(
    (candidate) =>
      candidate.visitId === generatedCell?.visitId &&
      candidate.assessmentId === generatedCell?.assessmentId &&
      candidate.value === difference.actual &&
      typeof difference.expected === 'undefined'
  );

  if (accepted) {
    return {
      kind: 'accepted',
      section: 'cells',
      path: difference.path,
      expected: difference.expected,
      actual: difference.actual,
      acceptedDiffId: accepted.id,
      message: accepted.reason,
    };
  }

  return {
    kind: 'content',
    section: 'cells',
    path: difference.path,
    expected: difference.expected,
    actual: difference.actual,
  };
}

function compareLegacySectionParity(
  section: Exclude<ScheduleParitySectionName, 'metadata'>,
  legacy: ScheduleDefinition[typeof section],
  generated: ScheduleDefinition[typeof section]
): ScheduleSectionParityResult {
  const left = section === 'cells' ? sortCells(legacy as ScheduleCell[]) : legacy;
  const right = section === 'cells' ? sortCells(generated as ScheduleCell[]) : generated;
  const rawDifferences = deepEqual(left, right, section);
  const differences =
    section === 'cells'
      ? rawDifferences.map((difference) =>
          classifyLegacyCellDifference(difference, right as ScheduleCell[])
        )
      : rawDifferences.map((difference) => classifyDifference(section, difference));

  const unexpected = differences.filter((difference) => difference.kind !== 'accepted');

  return {
    name: section,
    fixtureParityPassed: true,
    legacyParityPassed: unexpected.length === 0,
    differences,
  };
}

/** Compares generated schedule output against PROTO-XYZ-301 parity fixtures. */
export function compareGeneratedScheduleFixtureParity(document: ProtocolDocument): ScheduleSectionParityResult[] {
  const generated = generateScheduleFromRules(document);

  return [
    compareSectionParity('visits', generatedScheduleFixtures.visits, generated.visits),
    compareSectionParity(
      'assessments',
      generatedScheduleFixtures.assessments,
      generated.assessments
    ),
    compareSectionParity('cells', generatedScheduleFixtures.cells, generated.cells),
    compareMetadataFixtureParity(document),
  ];
}

/** Compares legacy schedule against generated output with accepted-difference policy. */
export function compareLegacyToGeneratedScheduleParity(document: ProtocolDocument): {
  structuralDifferences: ClassifiedScheduleDifference[];
  sections: ScheduleSectionParityResult[];
} {
  const legacy = document.schedule;
  const generated = generateScheduleFromRules(document);
  const structuralDifferences = collectStructuralDifferences(legacy, generated);

  const sections = [
    compareLegacySectionParity('visits', legacy.visits, generated.visits),
    compareLegacySectionParity('assessments', legacy.assessments, generated.assessments),
    compareLegacySectionParity('cells', legacy.cells, generated.cells),
    compareMetadataLegacyParity(document),
  ];

  return { structuralDifferences, sections };
}

/** Runs fixture parity and legacy replacement-candidate checks for generated schedule. */
export function runScheduleParityCheck(document: ProtocolDocument): ScheduleParityReport {
  const generated = generateScheduleFromRules(document);
  const fixtureSections = compareGeneratedScheduleFixtureParity(document);
  const legacyComparison = compareLegacyToGeneratedScheduleParity(document);

  const fixtureParityPassed = fixtureSections.every((section) => section.fixtureParityPassed);
  const structuralDifferences = legacyComparison.structuralDifferences;
  const sectionDifferences = legacyComparison.sections.flatMap((section) => section.differences);
  const acceptedDifferences = sectionDifferences.filter((difference) => difference.kind === 'accepted');
  const contentDifferences = sectionDifferences.filter((difference) => difference.kind === 'content');
  const legacyReplacementCandidate =
    structuralDifferences.length === 0 &&
    contentDifferences.length === 0 &&
    legacyComparison.sections.every((section) => section.legacyParityPassed);

  const passed = fixtureParityPassed && legacyReplacementCandidate;

  const message = !fixtureParityPassed
    ? 'Generated schedule output does not match PROTO-XYZ-301 parity fixtures.'
    : structuralDifferences.length > 0
      ? 'Legacy and generated schedules are not structurally equivalent.'
      : contentDifferences.length > 0
        ? 'Legacy and generated schedules differ beyond accepted content differences.'
        : acceptedDifferences.length > 0
          ? 'Generated schedule is a verified replacement candidate; only accepted legacy content differences remain.'
          : 'Generated schedule fully matches legacy schedule and parity fixtures.';

  return {
    passed,
    fixtureParityPassed,
    legacyReplacementCandidate,
    structuralDifferences,
    contentDifferences,
    acceptedDifferences,
    sections: fixtureSections.map((fixtureSection, index) => {
      const legacySection = legacyComparison.sections[index];
      return {
        name: fixtureSection.name,
        fixtureParityPassed: fixtureSection.fixtureParityPassed,
        legacyParityPassed: legacySection.legacyParityPassed,
        differences: [...fixtureSection.differences, ...legacySection.differences],
      };
    }),
    summary: {
      protocolId: document.id,
      fixtureVisitCount: generatedScheduleFixtures.visits.length,
      fixtureAssessmentCount: generatedScheduleFixtures.assessments.length,
      fixtureCellCount: generatedScheduleFixtures.cells.length,
      legacyVisitCount: document.schedule.visits.length,
      legacyAssessmentCount: document.schedule.assessments.length,
      legacyCellCount: document.schedule.cells.length,
      generatedVisitCount: generated.visits.length,
      generatedAssessmentCount: generated.assessments.length,
      generatedCellCount: generated.cells.length,
    },
    message,
  };
}

export function formatScheduleParityReport(report: ScheduleParityReport): string {
  const lines = ['Generated schedule parity report', ''];

  lines.push(`Protocol: ${report.summary.protocolId}`);
  lines.push(`Fixture parity: ${report.fixtureParityPassed ? 'PASS' : 'FAIL'}`);
  lines.push(`Legacy replacement candidate: ${report.legacyReplacementCandidate ? 'PASS' : 'FAIL'}`);
  lines.push(`Overall: ${report.passed ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push(
    `Counts visits=${report.summary.generatedVisitCount}, assessments=${report.summary.generatedAssessmentCount}, cells=${report.summary.generatedCellCount}`
  );
  lines.push('');

  for (const section of report.sections) {
    lines.push(
      `${section.fixtureParityPassed ? 'PASS' : 'FAIL'} fixture ${section.name} | ${
        section.legacyParityPassed ? 'PASS' : 'FAIL'
      } legacy ${section.name}`
    );
  }

  lines.push('');

  if (report.structuralDifferences.length > 0) {
    lines.push('Structural differences:');
    for (const difference of report.structuralDifferences) {
      lines.push(`  - [${difference.section}] ${difference.path}: ${difference.message ?? ''}`.trim());
    }
    lines.push('');
  }

  if (report.contentDifferences.length > 0) {
    lines.push('Unexpected content differences:');
    for (const difference of report.contentDifferences.slice(0, 20)) {
      lines.push(`  - [${difference.section}] ${difference.path}`);
    }
    if (report.contentDifferences.length > 20) {
      lines.push(`  ... ${report.contentDifferences.length - 20} more difference(s)`);
    }
    lines.push('');
  }

  if (report.acceptedDifferences.length > 0) {
    lines.push('Accepted content differences:');
    for (const difference of report.acceptedDifferences) {
      lines.push(
        `  - [${difference.acceptedDiffId}] ${difference.path}: ${difference.message ?? difference.actual}`
      );
    }
    lines.push('');
  }

  lines.push(report.message);

  return lines.join('\n');
}

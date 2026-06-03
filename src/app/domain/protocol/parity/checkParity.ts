import {
  getAssessments,
  getAuditEvents,
  getComments,
  getDependencyEdges,
  getDependencyNodes,
  getFieldDefinitions,
  getProtocolSections,
  getSoACells,
  getValidationIssues,
  getVisits,
} from '../selectors';
import { deepEqual, formatDifferences } from './deepEqual';
import { parityFixtures } from './loadFixtures';

export interface ParityCheckResult {
  name: string;
  passed: boolean;
  differences: ReturnType<typeof deepEqual>;
}

export interface ParityReport {
  passed: boolean;
  results: ParityCheckResult[];
}

const PARITY_TARGETS = [
  { name: 'protocolSections', expected: parityFixtures.protocolSections, actual: getProtocolSections },
  { name: 'fieldDefinitions', expected: parityFixtures.fieldDefinitions, actual: getFieldDefinitions },
  { name: 'visits', expected: parityFixtures.visits, actual: getVisits },
  { name: 'assessments', expected: parityFixtures.assessments, actual: getAssessments },
  { name: 'soaCells', expected: parityFixtures.soaCells, actual: getSoACells },
  { name: 'dependencyNodes', expected: parityFixtures.dependencyNodes, actual: getDependencyNodes },
  { name: 'dependencyEdges', expected: parityFixtures.dependencyEdges, actual: getDependencyEdges },
  { name: 'validationIssues', expected: parityFixtures.validationIssues, actual: getValidationIssues },
  { name: 'comments', expected: parityFixtures.comments, actual: getComments },
  { name: 'auditEvents', expected: parityFixtures.auditEvents, actual: getAuditEvents },
] as const;

export function runParityCheck(): ParityReport {
  const results = PARITY_TARGETS.map(({ name, expected, actual }) => {
    const differences = deepEqual(expected, actual(), name);
    return {
      name,
      passed: differences.length === 0,
      differences,
    };
  });

  return {
    passed: results.every((result) => result.passed),
    results,
  };
}

export function formatParityReport(report: ParityReport): string {
  const lines = ['Protocol selector parity report', ''];

  for (const result of report.results) {
    lines.push(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}`);

    if (!result.passed) {
      lines.push(formatDifferences(result.differences));
    }

    lines.push('');
  }

  lines.push(report.passed ? 'All selector outputs match parity fixtures.' : 'Parity check failed.');
  return lines.join('\n');
}

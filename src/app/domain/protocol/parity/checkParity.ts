import {
  assessments as legacyAssessments,
  auditEvents as legacyAuditEvents,
  comments as legacyComments,
  fieldDefinitions as legacyFieldDefinitions,
  protocolSections as legacyProtocolSections,
  soaCells as legacySoaCells,
  validationIssues as legacyValidationIssues,
  visits as legacyVisits,
} from '../../../data/mockData';
import {
  dependencyEdges as legacyDependencyEdges,
  dependencyNodes as legacyDependencyNodes,
} from '../../../data/dependencyGraphData';
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
  { name: 'protocolSections', legacy: legacyProtocolSections, actual: getProtocolSections },
  { name: 'fieldDefinitions', legacy: legacyFieldDefinitions, actual: getFieldDefinitions },
  { name: 'visits', legacy: legacyVisits, actual: getVisits },
  { name: 'assessments', legacy: legacyAssessments, actual: getAssessments },
  { name: 'soaCells', legacy: legacySoaCells, actual: getSoACells },
  { name: 'dependencyNodes', legacy: legacyDependencyNodes, actual: getDependencyNodes },
  { name: 'dependencyEdges', legacy: legacyDependencyEdges, actual: getDependencyEdges },
  { name: 'validationIssues', legacy: legacyValidationIssues, actual: getValidationIssues },
  { name: 'comments', legacy: legacyComments, actual: getComments },
  { name: 'auditEvents', legacy: legacyAuditEvents, actual: getAuditEvents },
] as const;

export function runParityCheck(): ParityReport {
  const results = PARITY_TARGETS.map(({ name, legacy, actual }) => {
    const differences = deepEqual(legacy, actual(), name);
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

  lines.push(report.passed ? 'All selector outputs match legacy mock exports.' : 'Parity check failed.');
  return lines.join('\n');
}

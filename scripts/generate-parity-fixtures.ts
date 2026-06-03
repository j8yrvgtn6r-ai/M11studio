import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
} from '../src/app/domain/protocol/selectors';
import { resetProtocolStore } from '../src/app/domain/protocol/store';
import { stringifyParityFixture } from '../src/app/domain/protocol/parity/fixtureTimestamps';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../src/app/domain/protocol/parity/fixtures');

const PARITY_TARGETS = [
  { name: 'protocolSections', getValue: getProtocolSections },
  { name: 'fieldDefinitions', getValue: getFieldDefinitions },
  { name: 'visits', getValue: getVisits },
  { name: 'assessments', getValue: getAssessments },
  { name: 'soaCells', getValue: getSoACells },
  { name: 'dependencyNodes', getValue: getDependencyNodes },
  { name: 'dependencyEdges', getValue: getDependencyEdges },
  { name: 'validationIssues', getValue: getValidationIssues },
  { name: 'comments', getValue: getComments },
  { name: 'auditEvents', getValue: getAuditEvents },
] as const;

resetProtocolStore();
mkdirSync(fixturesDir, { recursive: true });

for (const { name, getValue } of PARITY_TARGETS) {
  const value = getValue();
  const filePath = join(fixturesDir, `${name}.json`);
  writeFileSync(filePath, stringifyParityFixture(value), 'utf8');
  console.log(`Wrote ${filePath}`);
}

console.log('Parity fixtures generated from selector outputs.');

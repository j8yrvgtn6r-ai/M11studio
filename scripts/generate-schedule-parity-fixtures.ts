import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateScheduleFromRules } from '../src/app/domain/protocol/scheduleGeneration/generateScheduleFromRules';
import { stringifyParityFixture } from '../src/app/domain/protocol/parity/fixtureTimestamps';
import { getProtocolDocument, resetProtocolStore } from '../src/app/domain/protocol/store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../src/app/domain/protocol/parity/fixtures/generatedSchedule');

function sortCells<T extends { visitId: string; assessmentId: string }>(cells: T[]): T[] {
  return [...cells].sort((left, right) => {
    const visitCompare = left.visitId.localeCompare(right.visitId);
    if (visitCompare !== 0) {
      return visitCompare;
    }
    return left.assessmentId.localeCompare(right.assessmentId);
  });
}

resetProtocolStore();
const document = getProtocolDocument();
const generated = generateScheduleFromRules(document);

mkdirSync(fixturesDir, { recursive: true });

const targets = [
  { name: 'visits', value: generated.visits },
  { name: 'assessments', value: generated.assessments },
  { name: 'cells', value: sortCells(generated.cells) },
  {
    name: 'metadata',
    value: {
      generatedFromRules: generated.metadata.generatedFromRules,
      sourceRuleCount: generated.metadata.sourceRuleCount,
      sourceVisitDefinitionCount: generated.metadata.sourceVisitDefinitionCount,
      sourceSoAAssessmentDefinitionCount: document.soaAssessmentDefinitions?.length ?? 0,
    },
  },
] as const;

for (const { name, value } of targets) {
  const filePath = join(fixturesDir, `${name}.json`);
  writeFileSync(filePath, stringifyParityFixture(value), 'utf8');
  console.log(`Wrote ${filePath}`);
}

console.log('Generated schedule parity fixtures written for PROTO-XYZ-301.');

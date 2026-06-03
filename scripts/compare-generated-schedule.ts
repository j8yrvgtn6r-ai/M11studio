import {
  formatGeneratedScheduleDiffReport,
  reportGeneratedScheduleDiff,
} from '../src/app/domain/protocol/scheduleGeneration';
import { getProtocolDocument, resetProtocolStore } from '../src/app/domain/protocol/store';

resetProtocolStore();

const report = reportGeneratedScheduleDiff(getProtocolDocument());

console.log(formatGeneratedScheduleDiffReport(report));

if (report.structuralIssues.length > 0) {
  console.error('Generated schedule comparison failed structural checks.');
  process.exitCode = 1;
  process.exit(1);
}

console.log('Generated schedule comparison completed (informational diffs may remain).');

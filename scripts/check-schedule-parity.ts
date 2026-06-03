import { formatScheduleParityReport, runScheduleParityCheck } from '../src/app/domain/protocol/parity/checkScheduleParity';
import { getProtocolDocument, resetProtocolStore } from '../src/app/domain/protocol/store';

resetProtocolStore();

const report = runScheduleParityCheck(getProtocolDocument());

console.log(formatScheduleParityReport(report));

if (!report.passed) {
  process.exitCode = 1;
  process.exit(1);
}

console.log('Generated schedule parity check passed.');

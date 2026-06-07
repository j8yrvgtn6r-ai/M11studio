import { formatParityReport, runParityCheck } from '../src/app/domain/protocol/parity/checkParity';
import { resetProtocolStore } from '../src/app/domain/protocol/store/protocolStore';

resetProtocolStore();
const report = runParityCheck();
console.log(formatParityReport(report));

if (!report.passed) {
  process.exitCode = 1;
}

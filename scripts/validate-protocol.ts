import {
  formatProtocolValidationResult,
  validateProtocol,
} from '../src/app/domain/protocol/validateProtocol';
import { getProtocolDocument, resetProtocolStore } from '../src/app/domain/protocol/store';

resetProtocolStore();
const result = validateProtocol(getProtocolDocument());

console.log(formatProtocolValidationResult(result));

if (!result.valid) {
  process.exitCode = 1;
}

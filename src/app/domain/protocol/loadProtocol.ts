import type { ProtocolDocument } from './types';
import { getProtocolDocument } from './store';

/** Returns the canonical protocol document from the protocol store. */
export function loadProtocol(): ProtocolDocument {
  return getProtocolDocument();
}

/** Singleton accessor for the default protocol document. */
export { getProtocolDocument } from './store';

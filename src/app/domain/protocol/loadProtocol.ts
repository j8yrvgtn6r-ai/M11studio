import type { ProtocolDocument } from './types';
import seedProtocol from './seed/PROTO-XYZ-301.json';

const protocolDocument = seedProtocol as ProtocolDocument;

/** Returns the canonical seed protocol document. */
export function loadProtocol(): ProtocolDocument {
  return protocolDocument;
}

/** Singleton accessor for the default seed protocol. */
export function getProtocolDocument(): ProtocolDocument {
  return protocolDocument;
}

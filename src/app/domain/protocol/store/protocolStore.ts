import type { ProtocolDocument } from '../types';
import { mergeProtocolSectionsWithIchM11 } from '../ichM11';
import seedProtocol from '../seed/PROTO-XYZ-301.json';
import { logDevProtocolValidation } from '../validateProtocol';

type ProtocolStoreListener = () => void;

const listeners = new Set<ProtocolStoreListener>();

function loadSeedDocument(): ProtocolDocument {
  const document = structuredClone(seedProtocol as ProtocolDocument);
  document.sections = mergeProtocolSectionsWithIchM11(document.sections, document);
  return document;
}

/** Authoritative in-memory protocol loaded once at module initialization. */
let protocolDocument: ProtocolDocument = loadSeedDocument();
logDevProtocolValidation(protocolDocument);

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Applies an in-place mutation and notifies subscribers. */
export function mutateProtocolDocument(mutator: (document: ProtocolDocument) => void): void {
  mutator(protocolDocument);
  notifyListeners();
  void import('../../study-model/refreshStudyModelFromContext').then(({ refreshStudyModelFromContext }) => {
    refreshStudyModelFromContext();
  });
}

/** Returns the authoritative in-memory protocol document. */
export function getProtocolDocument(): ProtocolDocument {
  return protocolDocument;
}

/** Returns a deep copy of the current protocol document for read-only inspection. */
export function getProtocolSnapshot(): ProtocolDocument {
  return structuredClone(protocolDocument);
}

/** Resets the store to the seed protocol document. */
export function resetProtocolStore(): void {
  protocolDocument = loadSeedDocument();
  logDevProtocolValidation(protocolDocument);
  notifyListeners();
}

/** Subscribe to store changes. Returns an unsubscribe function. */
export function subscribe(listener: ProtocolStoreListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

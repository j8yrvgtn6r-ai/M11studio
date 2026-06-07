import type { ProtocolDocument } from '../types';
import { createBlankProtocolDocument } from '../blankProtocolDocument';
import { migrateTitlePageElements } from '../authoring/titlePageMigration';
import { mergeProtocolSectionsWithIchM11 } from '../ichM11';
import seedProtocol from '../seed/PROTO-XYZ-301.json';
import { logDevProtocolValidation } from '../validateProtocol';

type ProtocolStoreListener = () => void;
type ProtocolPersistListener = (timestamp: string) => void;

const listeners = new Set<ProtocolStoreListener>();
const persistListeners = new Set<ProtocolPersistListener>();
let lastDocumentPersistedAt: string | null = null;
let blankProjectMode = true;

function loadSeedDocument(): ProtocolDocument {
  const document = structuredClone(seedProtocol as ProtocolDocument);
  document.sections = mergeProtocolSectionsWithIchM11(document.sections, document);
  migrateTitlePageElements(document);
  return document;
}

function notifyDocumentPersisted(): void {
  lastDocumentPersistedAt = new Date().toISOString();
  for (const listener of persistListeners) {
    listener(lastDocumentPersistedAt);
  }
}

/** Authoritative in-memory protocol loaded once at module initialization. */
let protocolDocument: ProtocolDocument = createBlankProtocolDocument();
logDevProtocolValidation(protocolDocument);

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Applies an in-place mutation and notifies subscribers. */
export function mutateProtocolDocument(mutator: (document: ProtocolDocument) => void): void {
  mutator(protocolDocument);
  notifyDocumentPersisted();
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
  blankProjectMode = false;
  protocolDocument = loadSeedDocument();
  logDevProtocolValidation(protocolDocument);
  notifyListeners();
}

/** Resets the store to a blank ICH M11 workspace with no demo values. */
export function resetProtocolStoreToBlank(): void {
  blankProjectMode = true;
  protocolDocument = createBlankProtocolDocument();
  logDevProtocolValidation(protocolDocument);
  notifyDocumentPersisted();
  notifyListeners();
}

/** True when the workspace was created as a blank project (not demo seed). */
export function isBlankProjectMode(): boolean {
  return blankProjectMode;
}

/** Clears blank-project mode after import or demo seed load. */
export function clearBlankProjectMode(): void {
  blankProjectMode = false;
}

export function subscribeProtocolDocumentPersist(listener: ProtocolPersistListener): () => void {
  persistListeners.add(listener);
  if (lastDocumentPersistedAt) {
    listener(lastDocumentPersistedAt);
  }
  return () => {
    persistListeners.delete(listener);
  };
}

export function getProtocolDocumentLastPersistedAt(): string | null {
  return lastDocumentPersistedAt;
}

/** Subscribe to store changes. Returns an unsubscribe function. */
export function subscribe(listener: ProtocolStoreListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

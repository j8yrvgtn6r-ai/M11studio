import { getProtocolImportState, updateSectionImportDraft } from '../import/protocolImportStore';
import type {
  EntityInsertionRecord,
  ProtocolEntityReference,
  ProtocolEntityType,
} from './protocolEntityTypes';

const REFERENCE_STORAGE_KEY = 'm11-protocol-entity-references-v1';
const INSERTION_STORAGE_KEY = 'm11-protocol-entity-insertions-v1';

let entityReferences: ProtocolEntityReference[] = loadReferences();
let entityInsertions: EntityInsertionRecord[] = loadInsertions();
const referenceListeners = new Set<(records: ProtocolEntityReference[]) => void>();
const insertionListeners = new Set<(records: EntityInsertionRecord[]) => void>();

function loadReferences(): ProtocolEntityReference[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(REFERENCE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ProtocolEntityReference[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadInsertions(): EntityInsertionRecord[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(INSERTION_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as EntityInsertionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistReferences(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(REFERENCE_STORAGE_KEY, JSON.stringify(entityReferences.slice(-500)));
  }
  for (const listener of referenceListeners) {
    listener([...entityReferences]);
  }
}

function persistInsertions(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(INSERTION_STORAGE_KEY, JSON.stringify(entityInsertions.slice(-500)));
  }
  for (const listener of insertionListeners) {
    listener([...entityInsertions]);
  }
}

export function listProtocolEntityReferences(sectionId?: string): ProtocolEntityReference[] {
  if (!sectionId) {
    return [...entityReferences];
  }
  return entityReferences.filter((entry) => entry.sectionId === sectionId);
}

export function listEntityInsertionRecords(sectionId?: string): EntityInsertionRecord[] {
  if (!sectionId) {
    return [...entityInsertions];
  }
  return entityInsertions.filter((entry) => entry.sectionId === sectionId);
}

export function recordProtocolEntityReference(
  input: Omit<ProtocolEntityReference, 'createdAt'>,
): ProtocolEntityReference {
  const entry: ProtocolEntityReference = {
    ...input,
    createdAt: new Date().toISOString(),
  };
  entityReferences = [...entityReferences.filter((existing) => {
    if (existing.sectionId !== entry.sectionId) {
      return true;
    }
    return !(existing.offset === entry.offset && existing.entityId === entry.entityId);
  }), entry];
  persistReferences();

  const draft = getProtocolImportState().sectionDrafts[input.sectionId];
  if (draft) {
    updateSectionImportDraft(input.sectionId, {
      entityReferences: [...(draft.entityReferences ?? []), entry],
    });
  }

  return entry;
}

export function recordEntityInsertion(
  input: Omit<EntityInsertionRecord, 'id' | 'timestamp'>,
): EntityInsertionRecord {
  const entry: EntityInsertionRecord = {
    ...input,
    id: `entity.insert.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  entityInsertions = [...entityInsertions, entry];
  persistInsertions();

  const draft = getProtocolImportState().sectionDrafts[input.sectionId];
  if (draft) {
    updateSectionImportDraft(input.sectionId, {
      entityInsertionLog: [...(draft.entityInsertionLog ?? []), entry],
    });
  }

  return entry;
}

export function recordEntityAcceptance(input: {
  sectionId: string;
  entityId: string;
  entityType: ProtocolEntityType;
  displayText: string;
  offset: number;
  endOffset: number;
}): { reference: ProtocolEntityReference; insertion: EntityInsertionRecord } {
  const reference = recordProtocolEntityReference({
    entityId: input.entityId,
    entityType: input.entityType,
    displayText: input.displayText,
    sectionId: input.sectionId,
    offset: input.offset,
    endOffset: input.endOffset,
  });
  const insertion = recordEntityInsertion({
    entityId: input.entityId,
    entityType: input.entityType,
    sectionId: input.sectionId,
    insertedText: input.displayText,
  });
  return { reference, insertion };
}

export function clearProtocolEntityReferences(): void {
  entityReferences = [];
  entityInsertions = [];
  persistReferences();
  persistInsertions();
}

export function reloadProtocolEntityReferencesFromStorage(): void {
  entityReferences = loadReferences();
  entityInsertions = loadInsertions();
}

export function subscribeProtocolEntityReferences(
  listener: (records: ProtocolEntityReference[]) => void,
): () => void {
  referenceListeners.add(listener);
  listener([...entityReferences]);
  return () => referenceListeners.delete(listener);
}

export function subscribeEntityInsertionRecords(
  listener: (records: EntityInsertionRecord[]) => void,
): () => void {
  insertionListeners.add(listener);
  listener([...entityInsertions]);
  return () => insertionListeners.delete(listener);
}

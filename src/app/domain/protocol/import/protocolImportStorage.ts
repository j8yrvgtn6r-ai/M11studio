import type { ImportedProtocolSource } from './types';

const DB_NAME = 'm11-studio-protocol-import';
const DB_VERSION = 2;
const DOC_STORE = 'source-documents';
const EXTRACTION_STORE = 'extractions';

export function isProtocolImportStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open protocol import IndexedDB'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOC_STORE)) {
        database.createObjectStore(DOC_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(EXTRACTION_STORE)) {
        database.createObjectStore(EXTRACTION_STORE, { keyPath: 'uploadId' });
      }
    };
  });
}

export interface StoredProtocolSourceDocument {
  id: string;
  storagePath: string;
  filename: string;
  uploadedAt: string;
  fileSize: number;
  mimeType: string;
  blob: Blob;
}

export async function saveProtocolSourceDocument(
  record: StoredProtocolSourceDocument,
): Promise<void> {
  if (!isProtocolImportStorageAvailable()) {
    throw new Error('IndexedDB is not available.');
  }

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOC_STORE, 'readwrite');
    const store = transaction.objectStore(DOC_STORE);
    const request = store.put(record);
    request.onerror = () => reject(request.error ?? new Error('Failed to save protocol source document'));
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('IndexedDB write failed'));
    };
  });
}

export async function loadProtocolSourceDocument(
  id: string,
): Promise<StoredProtocolSourceDocument | null> {
  if (!isProtocolImportStorageAvailable()) {
    return null;
  }

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOC_STORE, 'readonly');
    const store = transaction.objectStore(DOC_STORE);
    const request = store.get(id);
    request.onerror = () => reject(request.error ?? new Error('Failed to load protocol source document'));
    request.onsuccess = () => {
      resolve((request.result as StoredProtocolSourceDocument | undefined) ?? null);
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('IndexedDB read failed'));
    };
  });
}

export async function saveImportedProtocolSource(
  source: ImportedProtocolSource,
): Promise<void> {
  if (!isProtocolImportStorageAvailable()) {
    throw new Error('IndexedDB is not available.');
  }

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXTRACTION_STORE, 'readwrite');
    const store = transaction.objectStore(EXTRACTION_STORE);
    const request = store.put(source);
    request.onerror = () => reject(request.error ?? new Error('Failed to save extraction'));
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('IndexedDB extraction write failed'));
    };
  });
}

/** Removes all persisted import blobs and extractions from IndexedDB. */
export async function clearAllProtocolImportStorage(): Promise<void> {
  if (!isProtocolImportStorageAvailable()) {
    return;
  }

  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([DOC_STORE, EXTRACTION_STORE], 'readwrite');
    transaction.objectStore(DOC_STORE).clear();
    transaction.objectStore(EXTRACTION_STORE).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Failed to clear protocol import storage'));
    };
  });
}

export async function loadImportedProtocolSource(
  uploadId: string,
): Promise<ImportedProtocolSource | null> {
  if (!isProtocolImportStorageAvailable()) {
    return null;
  }

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXTRACTION_STORE, 'readonly');
    const store = transaction.objectStore(EXTRACTION_STORE);
    const request = store.get(uploadId);
    request.onerror = () => reject(request.error ?? new Error('Failed to load extraction'));
    request.onsuccess = () => {
      resolve((request.result as ImportedProtocolSource | undefined) ?? null);
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('IndexedDB extraction read failed'));
    };
  });
}

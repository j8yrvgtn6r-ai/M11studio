import type { ReferenceDocumentId, StoredReferenceDocumentBlob } from './types';

const DB_NAME = 'm11-studio-reference-documents';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export function isReferenceDocumentStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function loadStoredReferenceDocument(
  id: ReferenceDocumentId,
): Promise<StoredReferenceDocumentBlob | null> {
  if (!isReferenceDocumentStorageAvailable()) {
    return null;
  }

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error ?? new Error('Failed to read document'));
    request.onsuccess = () => {
      const record = request.result as StoredReferenceDocumentBlob | undefined;
      resolve(record ?? null);
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('IndexedDB read transaction failed'));
    };
  });
}

export async function saveStoredReferenceDocument(
  record: StoredReferenceDocumentBlob,
): Promise<void> {
  if (!isReferenceDocumentStorageAvailable()) {
    throw new Error('IndexedDB is not available in this environment.');
  }

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);
    request.onerror = () => reject(request.error ?? new Error('Failed to save document'));
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('IndexedDB write transaction failed'));
    };
  });
}

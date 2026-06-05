const DB_NAME = 'm11-studio-protocol-import';
const DB_VERSION = 1;
const STORE_NAME = 'source-documents';

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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
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
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
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

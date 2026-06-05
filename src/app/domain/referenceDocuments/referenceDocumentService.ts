import {
  ICH_M11_PDF_REFERENCE_DOCUMENT_IDS,
  getReferenceDocumentDefinition,
} from './registry';
import { isReferenceDocumentStorageAvailable, loadStoredReferenceDocument, saveStoredReferenceDocument } from './storage';
import type { ReferenceDocument, ReferenceDocumentId, StoredReferenceDocumentBlob } from './types';

const blobUrlCache = new Map<ReferenceDocumentId, string>();
const documents = new Map<ReferenceDocumentId, ReferenceDocument>();
const listeners = new Set<() => void>();

let initPromise: Promise<void> | null = null;

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function createMissingDocument(id: ReferenceDocumentId): ReferenceDocument {
  const definition = getReferenceDocumentDefinition(id);
  return {
    id,
    name: definition.name,
    version: definition.version,
    uploadedAt: null,
    filename: null,
    storagePath: definition.storagePath,
    fileSize: null,
    status: 'missing',
  };
}

function revokeBlobUrl(id: ReferenceDocumentId): void {
  const existing = blobUrlCache.get(id);
  if (existing) {
    URL.revokeObjectURL(existing);
    blobUrlCache.delete(id);
  }
}

function applyStoredRecord(record: StoredReferenceDocumentBlob): void {
  const definition = getReferenceDocumentDefinition(record.id);
  revokeBlobUrl(record.id);
  const blobUrl = URL.createObjectURL(record.blob);
  blobUrlCache.set(record.id, blobUrl);
  documents.set(record.id, {
    id: record.id,
    name: definition.name,
    version: definition.version,
    uploadedAt: record.uploadedAt,
    filename: record.filename,
    storagePath: record.storagePath,
    fileSize: record.fileSize,
    status: 'uploaded',
    mimeType: record.mimeType,
  });
}

export function subscribeReferenceDocuments(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReferenceDocument(id: ReferenceDocumentId): ReferenceDocument {
  return documents.get(id) ?? createMissingDocument(id);
}

export function getReferenceDocumentBlobUrl(id: ReferenceDocumentId): string | null {
  return blobUrlCache.get(id) ?? null;
}

export function hasUploadedReferenceDocument(id: ReferenceDocumentId): boolean {
  return getReferenceDocument(id).status === 'uploaded' && blobUrlCache.has(id);
}

export async function initReferenceDocumentService(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    for (const id of ICH_M11_PDF_REFERENCE_DOCUMENT_IDS) {
      documents.set(id, createMissingDocument(id));
    }

    if (!isReferenceDocumentStorageAvailable()) {
      notify();
      return;
    }

    await Promise.all(
      ICH_M11_PDF_REFERENCE_DOCUMENT_IDS.map(async (id) => {
        const stored = await loadStoredReferenceDocument(id);
        if (stored?.blob) {
          applyStoredRecord(stored);
        }
      }),
    );
    notify();
  })();

  return initPromise;
}

function setDocumentState(id: ReferenceDocumentId, patch: Partial<ReferenceDocument>): void {
  const current = getReferenceDocument(id);
  documents.set(id, { ...current, ...patch });
  notify();
}

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}

export async function uploadReferenceDocumentPdf(
  id: ReferenceDocumentId,
  file: File,
): Promise<void> {
  const definition = getReferenceDocumentDefinition(id);
  if (definition.mediaKind !== 'pdf') {
    throw new Error('This reference slot only accepts PDF uploads.');
  }
  if (!isPdfFile(file)) {
    throw new Error('Only PDF files are accepted.');
  }

  setDocumentState(id, {
    status: 'uploading',
    errorMessage: undefined,
  });

  try {
    const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
    const record: StoredReferenceDocumentBlob = {
      id,
      storagePath: definition.storagePath,
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      fileSize: file.size,
      mimeType: 'application/pdf',
      blob,
    };

    await saveStoredReferenceDocument(record);
    applyStoredRecord(record);
    notify();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    setDocumentState(id, { status: 'error', errorMessage: message });
    throw error;
  }
}

export function viewReferenceDocument(id: ReferenceDocumentId): void {
  const url = getReferenceDocumentBlobUrl(id);
  if (!url) {
    throw new Error('No document uploaded.');
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function downloadReferenceDocument(id: ReferenceDocumentId): void {
  const document = getReferenceDocument(id);
  const url = getReferenceDocumentBlobUrl(id);
  if (!url || !document.filename) {
    throw new Error('No document uploaded.');
  }

  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = document.filename;
  anchor.rel = 'noopener';
  window.document.body.appendChild(anchor);
  anchor.click();
  window.document.body.removeChild(anchor);
}

export function formatReferenceDocumentFileSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatReferenceDocumentUploadedAt(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

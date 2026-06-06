import type { CanonicalDocument } from './canonicalDocumentTypes';

const documentCache = new Map<string, CanonicalDocument>();

export function saveCanonicalDocument(document: CanonicalDocument): void {
  documentCache.set(document.id, document);
}

export function getCanonicalDocument(documentId: string | null | undefined): CanonicalDocument | null {
  if (!documentId) {
    return null;
  }
  return documentCache.get(documentId) ?? null;
}

export function getCanonicalDocumentByUploadId(uploadId: string | null | undefined): CanonicalDocument | null {
  if (!uploadId) {
    return null;
  }
  return documentCache.get(`canonical-${uploadId}`) ?? null;
}

export function clearCanonicalDocuments(): void {
  documentCache.clear();
}

export function listCachedCanonicalDocumentIds(): string[] {
  return [...documentCache.keys()];
}

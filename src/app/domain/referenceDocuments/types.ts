/**
 * Generic reference document registry — extensible beyond ICH M11 PDFs.
 */

export type ReferenceDocumentStatus =
  | 'missing'
  | 'uploading'
  | 'uploaded'
  | 'error';

export type ReferenceDocumentId =
  | 'ich-m11-technical-specification'
  | 'ich-m11-template'
  | 'ich-m11-controlled-terminology-package'
  | 'usdm-specification'
  | 'cdisc-sdtmig'
  | 'cdash'
  | 'define-xml'
  | 'sponsor-sop';

export type ReferenceDocumentMediaKind = 'pdf' | 'json' | 'zip' | 'other';

export interface ReferenceDocument {
  id: ReferenceDocumentId;
  name: string;
  version: string;
  uploadedAt: string | null;
  filename: string | null;
  storagePath: string;
  fileSize: number | null;
  status: ReferenceDocumentStatus;
  mimeType?: string;
  errorMessage?: string;
}

export interface ReferenceDocumentDefinition {
  id: ReferenceDocumentId;
  name: string;
  version: string;
  storagePath: string;
  mediaKind: ReferenceDocumentMediaKind;
  acceptMimeTypes: string[];
}

export interface StoredReferenceDocumentBlob {
  id: ReferenceDocumentId;
  storagePath: string;
  filename: string;
  uploadedAt: string;
  fileSize: number;
  mimeType: string;
  blob: Blob;
}

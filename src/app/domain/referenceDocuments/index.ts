export type {
  ReferenceDocument,
  ReferenceDocumentDefinition,
  ReferenceDocumentId,
  ReferenceDocumentMediaKind,
  ReferenceDocumentStatus,
} from './types';

export {
  REFERENCE_DOCUMENT_REGISTRY,
  ICH_M11_PDF_REFERENCE_DOCUMENT_IDS,
  getReferenceDocumentDefinition,
} from './registry';
export type { IchM11PdfReferenceDocumentId } from './registry';

export {
  initReferenceDocumentService,
  subscribeReferenceDocuments,
  getReferenceDocument,
  getReferenceDocumentBlobUrl,
  hasUploadedReferenceDocument,
  uploadReferenceDocumentPdf,
  viewReferenceDocument,
  downloadReferenceDocument,
  formatReferenceDocumentFileSize,
  formatReferenceDocumentUploadedAt,
} from './referenceDocumentService';

export {
  ichM11PdfKindToReferenceDocumentId,
  hasUploadedIchM11Pdf,
  viewIchM11UploadedPdf,
  downloadIchM11UploadedPdf,
  getIchM11TemplatePdfBlobUrl,
} from './ichM11ReferenceDocumentBridge';

export { ReferenceDocumentProvider, useReferenceDocument, useReferenceDocumentsReady } from './ReferenceDocumentContext';

import type { IchM11ReferenceDocumentKind } from '../protocol/ichM11/ichM11ReferenceDocuments';
import type { IchM11PdfReferenceDocumentId } from './registry';
import {
  downloadReferenceDocument,
  getReferenceDocumentBlobUrl,
  hasUploadedReferenceDocument,
  viewReferenceDocument,
} from './referenceDocumentService';
import type { ReferenceDocumentId } from './types';

const KIND_TO_ID: Record<
  Extract<IchM11ReferenceDocumentKind, 'technical-specification' | 'template'>,
  IchM11PdfReferenceDocumentId
> = {
  'technical-specification': 'ich-m11-technical-specification',
  template: 'ich-m11-template',
};

export function ichM11PdfKindToReferenceDocumentId(
  kind: Extract<IchM11ReferenceDocumentKind, 'technical-specification' | 'template'>,
): ReferenceDocumentId {
  return KIND_TO_ID[kind];
}

export function hasUploadedIchM11Pdf(kind: 'technical-specification' | 'template'): boolean {
  return hasUploadedReferenceDocument(ichM11PdfKindToReferenceDocumentId(kind));
}

export function viewIchM11UploadedPdf(
  kind: Extract<IchM11ReferenceDocumentKind, 'technical-specification' | 'template'>,
): void {
  viewReferenceDocument(ichM11PdfKindToReferenceDocumentId(kind));
}

export function downloadIchM11UploadedPdf(
  kind: Extract<IchM11ReferenceDocumentKind, 'technical-specification' | 'template'>,
): void {
  downloadReferenceDocument(ichM11PdfKindToReferenceDocumentId(kind));
}

export function getIchM11TemplatePdfBlobUrl(): string | null {
  return getReferenceDocumentBlobUrl('ich-m11-template');
}

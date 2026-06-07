import { ICH_M11_TECHNICAL_SPEC_META } from './ichM11TechnicalSpecification';

import { ICH_M11_TEMPLATE_META } from './ichM11Template';

import { ICH_M11_TERMINOLOGY_META } from './ichM11ControlledTerminology';

import {

  downloadIchM11UploadedPdf,

  getIchM11TemplatePdfBlobUrl,

  hasUploadedIchM11Pdf,

  viewIchM11UploadedPdf,

} from '../../referenceDocuments/ichM11ReferenceDocumentBridge';

import type { IchM11SourceDocumentMeta } from './types';



export type IchM11ReferenceDocumentKind =

  | 'technical-specification'

  | 'template'

  | 'controlled-terminology';



export type IchM11PdfReferenceDocumentKind = Extract<

  IchM11ReferenceDocumentKind,

  'technical-specification' | 'template'

>;



export interface IchM11ReferenceDocumentAsset {

  kind: IchM11ReferenceDocumentKind;

  meta: IchM11SourceDocumentMeta;

}



export const ICH_M11_REFERENCE_DOCUMENTS: Record<IchM11ReferenceDocumentKind, IchM11ReferenceDocumentAsset> = {

  'technical-specification': {

    kind: 'technical-specification',

    meta: ICH_M11_TECHNICAL_SPEC_META,

  },

  template: {

    kind: 'template',

    meta: ICH_M11_TEMPLATE_META,

  },

  'controlled-terminology': {

    kind: 'controlled-terminology',

    meta: {

      documentKind: 'controlled-terminology',

      title: ICH_M11_TERMINOLOGY_META.title,

      version: ICH_M11_TERMINOLOGY_META.version,

      status: 'static-local',

      sourceFilename: ICH_M11_TERMINOLOGY_META.sourceFilename,

      loadedAt: ICH_M11_TERMINOLOGY_META.loadedAt,

      description: ICH_M11_TERMINOLOGY_META.description,

      incompleteAreas: ICH_M11_TERMINOLOGY_META.incompleteAreas,

      adoptedDate: ICH_M11_TERMINOLOGY_META.terminologyDate,

    },

  },

};



export function getIchM11ReferenceDocument(kind: IchM11ReferenceDocumentKind): IchM11ReferenceDocumentAsset {

  return ICH_M11_REFERENCE_DOCUMENTS[kind];

}



function resolvePublicAssetUrl(publicUrl: string): string {

  if (typeof window === 'undefined') {

    return publicUrl;

  }

  return new URL(publicUrl, window.location.origin).href;

}



const CONTROLLED_TERMINOLOGY_PUBLIC_URL = '/reference/ichM11ControlledTerminology.json';

const CONTROLLED_TERMINOLOGY_FILENAME = 'ichM11ControlledTerminology.json';



/** Opens the uploaded ICH M11 PDF in a new tab, or the static terminology JSON. */

export function viewIchM11ReferenceDocument(kind: IchM11ReferenceDocumentKind): void {

  if (kind === 'controlled-terminology') {

    window.open(resolvePublicAssetUrl(CONTROLLED_TERMINOLOGY_PUBLIC_URL), '_blank', 'noopener,noreferrer');

    return;

  }

  viewIchM11UploadedPdf(kind);

}



/** Downloads the active uploaded PDF, or the bundled terminology JSON. */

export function downloadIchM11ReferenceDocument(kind: IchM11ReferenceDocumentKind): void {

  if (kind === 'controlled-terminology') {

    const anchor = document.createElement('a');

    anchor.href = resolvePublicAssetUrl(CONTROLLED_TERMINOLOGY_PUBLIC_URL);

    anchor.download = CONTROLLED_TERMINOLOGY_FILENAME;

    anchor.rel = 'noopener';

    document.body.appendChild(anchor);

    anchor.click();

    document.body.removeChild(anchor);

    return;

  }

  downloadIchM11UploadedPdf(kind);

}



export function hasIchM11PdfUploaded(kind: IchM11PdfReferenceDocumentKind): boolean {

  return hasUploadedIchM11Pdf(kind);

}



/** Blob URL for the uploaded template PDF, or null if not uploaded. */

export function getTemplatePdfUrl(): string | null {

  return getIchM11TemplatePdfBlobUrl();

}



export function viewIchM11TerminologyJson(): void {

  viewIchM11ReferenceDocument('controlled-terminology');

}



import { ICH_M11_TECHNICAL_SPEC_META } from '../protocol/ichM11/ichM11TechnicalSpecification';
import { ICH_M11_TEMPLATE_META } from '../protocol/ichM11/ichM11Template';
import type { ReferenceDocumentDefinition, ReferenceDocumentId } from './types';

export const REFERENCE_DOCUMENT_REGISTRY: Record<
  ReferenceDocumentId,
  ReferenceDocumentDefinition
> = {
  'ich-m11-technical-specification': {
    id: 'ich-m11-technical-specification',
    name: 'ICH M11 Technical Specification',
    version: ICH_M11_TECHNICAL_SPEC_META.version,
    storagePath: 'reference/ich-m11/technical-specification.pdf',
    mediaKind: 'pdf',
    acceptMimeTypes: ['application/pdf'],
  },
  'ich-m11-template': {
    id: 'ich-m11-template',
    name: 'ICH M11 Template',
    version: ICH_M11_TEMPLATE_META.version,
    storagePath: 'reference/ich-m11/template.pdf',
    mediaKind: 'pdf',
    acceptMimeTypes: ['application/pdf'],
  },
  'ich-m11-controlled-terminology-package': {
    id: 'ich-m11-controlled-terminology-package',
    name: 'ICH M11 Controlled Terminology (source package)',
    version: 'NCI EVS',
    storagePath: 'reference/ich-m11/controlled-terminology-package.zip',
    mediaKind: 'zip',
    acceptMimeTypes: ['application/zip', 'application/json'],
  },
  'usdm-specification': {
    id: 'usdm-specification',
    name: 'USDM Specification',
    version: '—',
    storagePath: 'reference/usdm/specification.pdf',
    mediaKind: 'pdf',
    acceptMimeTypes: ['application/pdf'],
  },
  'cdisc-sdtmig': {
    id: 'cdisc-sdtmig',
    name: 'CDISC SDTMIG',
    version: '—',
    storagePath: 'reference/cdisc/sdtmig.pdf',
    mediaKind: 'pdf',
    acceptMimeTypes: ['application/pdf'],
  },
  cdash: {
    id: 'cdash',
    name: 'CDASH',
    version: '—',
    storagePath: 'reference/cdisc/cdash.pdf',
    mediaKind: 'pdf',
    acceptMimeTypes: ['application/pdf'],
  },
  'define-xml': {
    id: 'define-xml',
    name: 'Define-XML',
    version: '—',
    storagePath: 'reference/cdisc/define-xml.pdf',
    mediaKind: 'pdf',
    acceptMimeTypes: ['application/pdf'],
  },
  'sponsor-sop': {
    id: 'sponsor-sop',
    name: 'Sponsor SOPs',
    version: '—',
    storagePath: 'reference/sponsor/sops.pdf',
    mediaKind: 'pdf',
    acceptMimeTypes: ['application/pdf'],
  },
};

export const ICH_M11_PDF_REFERENCE_DOCUMENT_IDS = [
  'ich-m11-technical-specification',
  'ich-m11-template',
] as const satisfies readonly ReferenceDocumentId[];

export type IchM11PdfReferenceDocumentId = (typeof ICH_M11_PDF_REFERENCE_DOCUMENT_IDS)[number];

export function getReferenceDocumentDefinition(
  id: ReferenceDocumentId,
): ReferenceDocumentDefinition {
  return REFERENCE_DOCUMENT_REGISTRY[id];
}

export type {
  IchM11SectionSpec,
  IchM11SourceDocumentMeta,
  IchM11SectionType,
  IchM11Conformance,
  IchM11ProtocolRole,
  IchM11TemplateSectionReference,
  IchM11TemplateReferenceMappingQuality,
} from './types';

export {
  ICH_M11_TECHNICAL_SPEC_META,
  ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
  countIchM11TechnicalSpecSections,
} from './ichM11TechnicalSpecification';

export {
  ICH_M11_TEMPLATE_META,
  ICH_M11_TEMPLATE_SECTION_SPECS,
  ICH_M11_TEMPLATE_SECTION_13_GUIDANCE,
  countIchM11TemplateSections,
  getIchM11TemplateSpecById,
} from './ichM11Template';

export {
  ICH_M11_REFERENCE_DOCUMENTS,
  getIchM11ReferenceDocument,
  viewIchM11ReferenceDocument,
  downloadIchM11ReferenceDocument,
  getTemplatePdfUrl,
  hasIchM11PdfUploaded,
} from './ichM11ReferenceDocuments';
export type {
  IchM11ReferenceDocumentKind,
  IchM11ReferenceDocumentAsset,
  IchM11PdfReferenceDocumentKind,
} from './ichM11ReferenceDocuments';

export {
  getTemplateSectionReference,
  hasMappedTemplateReference,
  getTemplateReferenceCopyText,
  listUnmappedTemplateSectionIds,
  ICH_M11_TEMPLATE_SECTION_REFERENCE_COUNT,
} from './ichM11TemplateSectionReference';

/** @deprecated Use ICH_M11_TEMPLATE_SECTION_SPECS */
export { ICH_M11_SECTION_SPECS, countIchM11Sections, getIchM11SpecById, ICH_M11_SPECIFICATION_META } from './ichM11Specification';

export { mergeProtocolSectionsWithIchM11, LEGACY_PROTOCOL_SECTION_IDS } from './mergeProtocolSectionsWithIchM11';

export {
  getM11ControlledTerminologyDocument,
  getM11Codelists,
  getM11Codelist,
  getM11CodelistCount,
  getM11TermCount,
  findM11Term,
  validateM11ControlledTerm,
  searchM11Terminology,
  getM11CodelistDropdownValues,
  ICH_M11_TERMINOLOGY_META,
} from './ichM11ControlledTerminology';
export type {
  M11Codelist,
  M11ControlledTerm,
  M11ControlledTerminologyDocument,
  M11ControlledTermValidationResult,
  M11TermMatch,
} from './ichM11ControlledTerminology';

export { resolveM11ControlledTerminologyForField } from './m11FieldTerminology';
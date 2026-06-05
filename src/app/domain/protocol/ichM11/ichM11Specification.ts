/**
 * @deprecated Import from ichM11Template or ichM11TechnicalSpecification directly.
 * Re-exports for backward compatibility.
 */

export {
  ICH_M11_TEMPLATE_SECTION_SPECS as ICH_M11_SECTION_SPECS,
  ICH_M11_TEMPLATE_META as ICH_M11_SPECIFICATION_META,
  countIchM11TemplateSections as countIchM11Sections,
  getIchM11TemplateSpecById as getIchM11SpecById,
} from './ichM11Template';

export type {
  IchM11SectionSpec,
  IchM11SourceDocumentMeta as IchM11SpecificationMeta,
  IchM11SectionType,
  IchM11Conformance,
} from './types';

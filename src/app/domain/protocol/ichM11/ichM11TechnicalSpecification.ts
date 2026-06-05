/**
 * Static ICH M11 Technical Specification metadata and abbreviated section index.
 * Full element-level extraction from the specification PDF is not yet modeled.
 */

import type { IchM11SectionSpec, IchM11SourceDocumentMeta } from './types';

export const ICH_M11_TECHNICAL_SPEC_META: IchM11SourceDocumentMeta = {
  documentKind: 'technical-specification',
  title: 'ICH M11 Technical Specification',
  version: '1.0 (static scaffold)',
  status: 'static-local',
  sourceFilename: 'ICH_M11_Technical_Specification.pdf',
  loadedAt: '2026-06-04T12:00:00.000Z',
  description:
    'Reference model for M11 data elements, conformance rules, and value-level constraints. Protocol Explorer structure is driven by the ICH M11 Template.',
  incompleteAreas: [
    'Full specification PDF extract is not imported; section list is an abbreviated index only.',
    'Data element definitions, value lists, and business rules per element are not modeled.',
    'Conformance rule expressions from the specification are not imported.',
  ],
};

/** Abbreviated technical-spec section index (not used for Protocol Explorer tree). */
export const ICH_M11_TECHNICAL_SPEC_SECTION_SPECS: IchM11SectionSpec[] = [
  { id: 'title', number: 'title', title: 'Title Page', sectionType: 'front-matter', parentId: null, order: 0, conformance: 'required' },
  { id: '1.3', number: '1.3', title: '1.3 Schedule of Activities', sectionType: 'body', parentId: '1', order: 3, conformance: 'required' },
  { id: '8', number: '8', title: '8 Trial Assessments and Procedures', sectionType: 'body', parentId: null, order: 80, conformance: 'required' },
  { id: '10', number: '10', title: '10 Statistical Considerations', sectionType: 'body', parentId: null, order: 100, conformance: 'required' },
];

export function countIchM11TechnicalSpecSections(
  specs: IchM11SectionSpec[] = ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
): number {
  return specs.length;
}

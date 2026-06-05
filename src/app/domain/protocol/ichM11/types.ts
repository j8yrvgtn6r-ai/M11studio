/**
 * Shared types for static ICH M11 Technical Specification and Template sources.
 */

export type IchM11SectionType =
  | 'template-instruction'
  | 'front-matter'
  | 'body'
  | 'appendix';

export type IchM11Conformance = 'required' | 'optional' | 'conditional';

export type IchM11ProtocolRole = 'instruction' | 'body' | 'appendix';

export interface IchM11SectionSpec {
  id: string;
  /** Display number e.g. "1.3" or "title" for front matter */
  number: string;
  title: string;
  sectionType: IchM11SectionType;
  parentId: string | null;
  order: number;
  conformance: IchM11Conformance;
  /** Placeholder for future spec element bindings (data elements, value lists). */
  metadata?: Record<string, unknown>;
}

export interface IchM11SourceDocumentMeta {
  documentKind: 'technical-specification' | 'template' | 'controlled-terminology';
  title: string;
  version: string;
  status: 'static-local';
  sourceFilename: string;
  adoptedDate?: string;
  loadedAt: string;
  description: string;
  incompleteAreas: string[];
}

export type IchM11TemplateReferenceMappingQuality = 'explicit' | 'scaffold' | 'unmapped';

/** Per-section M11 Template reference text for authoring (read-only; not protocol content). */
export interface IchM11TemplateSectionReference {
  sectionId: string;
  sectionNumber: string;
  title: string;
  sourceDocument: 'ICH M11 Template';
  pageRange?: string;
  instructionalText?: string;
  placeholderPrompts?: string[];
  headingOnly?: boolean;
  instructionalOnly?: boolean;
  mappingQuality: IchM11TemplateReferenceMappingQuality;
}

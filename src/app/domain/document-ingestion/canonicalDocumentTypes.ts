export type CanonicalBlockType =
  | 'heading'
  | 'paragraph'
  | 'table'
  | 'listItem'
  | 'header'
  | 'footer'
  | 'toc'
  | 'pageBreak'
  | 'unknown';

export type CanonicalSourceFormat = 'docx';

export interface CanonicalBlock {
  id: string;
  type: CanonicalBlockType;
  text: string;
  normalizedText: string;
  styleName?: string;
  numbering?: string;
  headingLevel?: number;
  pageNumber?: number;
  sourceFormat: CanonicalSourceFormat;
  sourceIndex: number;
}

export interface CanonicalSourceSection {
  id: string;
  title: string;
  normalizedTitle: string;
  numbering?: string;
  headingLevel?: number;
  startBlockIndex: number;
  endBlockIndex: number;
  blockIds: string[];
  text: string;
  diagnostics: string[];
}

export interface CanonicalDocumentStatistics {
  blockCount: number;
  headingCount: number;
  sectionCount: number;
  tableCount: number;
}

export interface CanonicalDocument {
  id: string;
  blocks: CanonicalBlock[];
  sections: CanonicalSourceSection[];
  warnings: string[];
  statistics: CanonicalDocumentStatistics;
}

export interface CanonicalBuildProgressEvent {
  phase: 'building' | 'classifying' | 'sections' | 'complete';
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface BuildCanonicalDocumentInput {
  uploadId: string;
  filename: string;
  paragraphs: import('../protocol/import/types').ExtractedParagraph[];
  headings: import('../protocol/import/types').ExtractedHeading[];
  tables: import('../protocol/import/types').ExtractedTable[];
  fullText: string;
  warnings?: string[];
  onProgress?: (event: CanonicalBuildProgressEvent) => void;
}

export interface SectionSimilarityResult {
  score: number;
  reasons: string[];
}

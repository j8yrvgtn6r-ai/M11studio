import {
  buildCanonicalDocument,
  saveCanonicalDocument,
  type CanonicalBuildProgressEvent,
} from '../../document-ingestion';
import { canonicalSectionsToSourceCandidates } from '../../document-ingestion/canonicalDocumentSelectors';
import { mapSourceCandidatesToM11 } from './m11SourceSectionMapping';
import { buildFullTextFromParagraphs, buildSourcePreview } from './sourceSectionBodyExtractor';
import type {
  ExtractedHeading,
  ExtractedParagraph,
  ImportedProtocolSource,
  SourceSectionCandidate,
} from './types';

function createWholeDocumentSection(fullText: string): SourceSectionCandidate {
  return {
    id: 'source-section-whole-document',
    headingText: 'Full document',
    headingLevel: 1,
    startIndex: 0,
    endIndex: fullText.length,
    sourceStartParagraphIndex: 0,
    sourceEndParagraphIndex: Number.MAX_SAFE_INTEGER,
    text: fullText.trim(),
    bodyText: fullText.trim(),
    confidence: 0.35,
    detectionMethod: 'whole-document',
    sourcePreview: buildSourcePreview(fullText),
    importedTextLength: fullText.trim().length,
    isSuspiciousBody: false,
    canonicalSectionId: 'canonical-section-whole-document',
  };
}

export interface DetectSourceSectionsOptions {
  onCanonicalProgress?: (event: CanonicalBuildProgressEvent) => void;
}

export function detectSourceSections(
  uploadId: string,
  filename: string,
  fullText: string,
  paragraphs: ExtractedParagraph[],
  headings: ExtractedHeading[],
  tables: ImportedProtocolSource['tables'],
  extractionWarnings: string[],
  options?: DetectSourceSectionsOptions,
): ImportedProtocolSource {
  const warnings = [...extractionWarnings];
  const alignedFullText = paragraphs.length > 0 ? buildFullTextFromParagraphs(paragraphs) : fullText;

  const canonicalDocument = buildCanonicalDocument({
    uploadId,
    filename,
    paragraphs,
    headings,
    tables,
    fullText: alignedFullText,
    warnings,
    onProgress: options?.onCanonicalProgress,
  });
  saveCanonicalDocument(canonicalDocument);

  let sections = canonicalSectionsToSourceCandidates(canonicalDocument, paragraphs, tables);

  if (sections.length === 0 && alignedFullText.trim()) {
    sections = [createWholeDocumentSection(alignedFullText)];
    warnings.push('No structured headings detected; rewrite will rely on full document context.');
  }

  sections = mapSourceCandidatesToM11(sections);

  return {
    uploadId,
    filename,
    extractedAt: new Date().toISOString(),
    fullText: alignedFullText,
    paragraphs,
    headings,
    sections,
    tables,
    extractionWarnings: [...warnings, ...canonicalDocument.warnings],
    canonicalDocumentId: canonicalDocument.id,
  };
}

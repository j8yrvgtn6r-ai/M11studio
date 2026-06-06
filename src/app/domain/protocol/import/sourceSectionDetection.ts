import { mapSourceCandidatesToM11 } from './m11SourceSectionMapping';
import {
  buildFullTextFromParagraphs,
  buildParagraphCharStarts,
  buildSourcePreview,
  collectParagraphSectionBoundaries,
  extractBodyTextBetweenParagraphs,
  findNextPeerOrHigherBoundary,
  isSuspiciousImportedBody,
} from './sourceSectionBodyExtractor';
import type {
  ExtractedHeading,
  ExtractedParagraph,
  ImportedProtocolSource,
  SourceSectionCandidate,
} from './types';

function buildSectionsFromBoundaries(
  boundaries: ReturnType<typeof collectParagraphSectionBoundaries>,
  paragraphs: ExtractedParagraph[],
  fullText: string,
  tables: ImportedProtocolSource['tables'],
): SourceSectionCandidate[] {
  if (boundaries.length === 0) {
    return [];
  }

  return boundaries.map((boundary, index) => {
    const endParagraphIndex = findNextPeerOrHigherBoundary(boundaries, index, paragraphs.length);
    const bodyText = extractBodyTextBetweenParagraphs(
      paragraphs,
      boundary.paragraphIndex,
      endParagraphIndex,
      tables,
    );
    const charStarts = buildParagraphCharStarts(paragraphs);
    const charStart = boundary.charStart;
    const charEnd =
      endParagraphIndex < paragraphs.length
        ? charStarts[endParagraphIndex] ?? fullText.length
        : fullText.length;
    const combinedText = bodyText ? `${boundary.headingText}\n\n${bodyText}` : boundary.headingText;

    return {
      id: `source-section-${index + 1}`,
      headingText: boundary.headingText,
      headingLevel: boundary.headingLevel,
      startIndex: charStart,
      endIndex: charEnd,
      sourceStartParagraphIndex: boundary.paragraphIndex,
      sourceEndParagraphIndex: endParagraphIndex,
      text: combinedText,
      bodyText,
      confidence: boundary.confidence,
      detectedNumber: boundary.detectedNumber,
      detectionMethod: boundary.detectionMethod,
      sourcePreview: buildSourcePreview(bodyText || boundary.headingText),
      importedTextLength: bodyText.length,
      isSuspiciousBody: isSuspiciousImportedBody(bodyText, boundary.headingText),
    };
  });
}

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
  };
}

export function detectSourceSections(
  uploadId: string,
  filename: string,
  fullText: string,
  paragraphs: ExtractedParagraph[],
  headings: ExtractedHeading[],
  tables: ImportedProtocolSource['tables'],
  extractionWarnings: string[],
): ImportedProtocolSource {
  const warnings = [...extractionWarnings];
  const alignedFullText = paragraphs.length > 0 ? buildFullTextFromParagraphs(paragraphs) : fullText;
  const boundaries = collectParagraphSectionBoundaries(paragraphs, headings);
  let sections = buildSectionsFromBoundaries(boundaries, paragraphs, alignedFullText, tables);

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
    extractionWarnings: warnings,
  };
}

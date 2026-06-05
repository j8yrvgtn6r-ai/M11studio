import { mapSourceCandidatesToM11 } from './m11SourceSectionMapping';
import type {
  ExtractedHeading,
  ExtractedParagraph,
  ImportedProtocolSource,
  SourceSectionCandidate,
} from './types';

const NUMBERED_HEADING = /^(\d+(?:\.\d+)*)\s+(.+)$/;
const ALL_CAPS_HEADING = /^[A-Z][A-Z0-9\s\-–—:]{4,}$/;

interface SectionBoundary {
  id: string;
  headingText: string;
  headingLevel?: number;
  startIndex: number;
  confidence: number;
  detectedNumber?: string;
  detectionMethod: SourceSectionCandidate['detectionMethod'];
}

function buildCharOffsets(paragraphs: ExtractedParagraph[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const paragraph of paragraphs) {
    offsets.push(cursor);
    cursor += paragraph.text.length + 1;
  }
  return offsets;
}

function paragraphCharStart(paragraphIndex: number, offsets: number[]): number {
  return offsets[paragraphIndex] ?? 0;
}

function collectBoundaries(
  paragraphs: ExtractedParagraph[],
  headings: ExtractedHeading[],
  fullText: string,
): SectionBoundary[] {
  const offsets = buildCharOffsets(paragraphs);
  const boundaries: SectionBoundary[] = [];
  const seenStarts = new Set<number>();

  const pushBoundary = (boundary: SectionBoundary) => {
    if (!boundary.headingText.trim() || seenStarts.has(boundary.startIndex)) {
      return;
    }
    seenStarts.add(boundary.startIndex);
    boundaries.push(boundary);
  };

  for (const heading of headings) {
    pushBoundary({
      id: `boundary-heading-${heading.id}`,
      headingText: heading.text,
      headingLevel: heading.level,
      startIndex: heading.charStart,
      confidence: 0.9,
      detectionMethod: 'heading-style',
    });
  }

  for (const paragraph of paragraphs) {
    const text = paragraph.text.trim();
    if (!text) {
      continue;
    }

    const numbered = NUMBERED_HEADING.exec(text);
    if (numbered) {
      pushBoundary({
        id: `boundary-number-${paragraph.index}`,
        headingText: text,
        headingLevel: numbered[1].split('.').length,
        startIndex: paragraphCharStart(paragraph.index, offsets),
        confidence: 0.85,
        detectedNumber: numbered[1],
        detectionMethod: 'numbering',
      });
      continue;
    }

    if (ALL_CAPS_HEADING.test(text) && text.length <= 120) {
      pushBoundary({
        id: `boundary-caps-${paragraph.index}`,
        headingText: text,
        headingLevel: 1,
        startIndex: paragraphCharStart(paragraph.index, offsets),
        confidence: 0.55,
        detectionMethod: 'all-caps',
      });
    }
  }

  boundaries.sort((left, right) => left.startIndex - right.startIndex);
  return boundaries;
}

function buildSectionsFromBoundaries(
  boundaries: SectionBoundary[],
  fullText: string,
): SourceSectionCandidate[] {
  if (boundaries.length === 0) {
    return [];
  }

  return boundaries.map((boundary, index) => {
    const next = boundaries[index + 1];
    const endIndex = next ? next.startIndex : fullText.length;
    const text = fullText.slice(boundary.startIndex, endIndex).trim();

    return {
      id: `source-section-${index + 1}`,
      headingText: boundary.headingText,
      headingLevel: boundary.headingLevel,
      startIndex: boundary.startIndex,
      endIndex,
      text,
      confidence: boundary.confidence,
      detectedNumber: boundary.detectedNumber,
      detectionMethod: boundary.detectionMethod,
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
    text: fullText.trim(),
    confidence: 0.35,
    detectionMethod: 'whole-document',
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
  const boundaries = collectBoundaries(paragraphs, headings, fullText);
  let sections = buildSectionsFromBoundaries(boundaries, fullText);

  if (sections.length === 0 && fullText.trim()) {
    sections = [createWholeDocumentSection(fullText)];
    warnings.push(
      'No structured headings detected; rewrite will rely on full document context.',
    );
  }

  sections = mapSourceCandidatesToM11(sections);

  return {
    uploadId,
    filename,
    extractedAt: new Date().toISOString(),
    fullText,
    paragraphs,
    headings,
    sections,
    tables,
    extractionWarnings: warnings,
  };
}

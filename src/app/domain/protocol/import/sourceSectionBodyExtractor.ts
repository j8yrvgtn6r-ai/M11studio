import type { ExtractedHeading, ExtractedParagraph, ExtractedTable } from './types';

export const MIN_IMPORTED_BODY_LENGTH = 50;

const NUMBERED_HEADING = /^(\d+(?:\.\d+)*)\s+(.+)$/;
const ALL_CAPS_HEADING = /^[A-Z][A-Z0-9\s\-–—:]{4,}$/;

export interface ParagraphSectionBoundary {
  id: string;
  headingText: string;
  headingLevel: number;
  paragraphIndex: number;
  charStart: number;
  confidence: number;
  detectedNumber?: string;
  detectionMethod: 'heading-style' | 'numbering' | 'all-caps' | 'whole-document';
}

export function buildFullTextFromParagraphs(paragraphs: ExtractedParagraph[]): string {
  return paragraphs
    .map((paragraph) => paragraph.text)
    .filter((text) => text.length > 0)
    .join('\n');
}

export function buildParagraphCharStarts(paragraphs: ExtractedParagraph[]): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (const paragraph of paragraphs) {
    starts.push(cursor);
    if (paragraph.text) {
      cursor += paragraph.text.length + 1;
    }
  }
  return starts;
}

export function isTableOfContentsEntry(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  if (/^table of contents$/i.test(trimmed)) {
    return true;
  }
  if (/^contents$/i.test(trimmed)) {
    return true;
  }
  if (/\.{3,}\s*\d+\s*$/.test(trimmed)) {
    return true;
  }
  if (/\t+\d+\s*$/.test(trimmed)) {
    return true;
  }
  if (/^[\d.]+\s+.+\s{2,}\d+\s*$/.test(trimmed) && trimmed.length <= 120) {
    return true;
  }
  return false;
}

export function isAppendixHeading(text: string): boolean {
  const trimmed = text.trim();
  return /^appendix(\s+\d|\s+[a-z(])/i.test(trimmed) || /^annex(\s+\d|\s+[a-z(])/i.test(trimmed);
}

export function isAppendixM11Section(sectionId: string, title: string): boolean {
  return sectionId.startsWith('12') || sectionId.startsWith('13') || sectionId.startsWith('14') || /appendix/i.test(title);
}

export function extractBodyTextBetweenParagraphs(
  paragraphs: ExtractedParagraph[],
  headingParagraphIndex: number,
  endParagraphIndexExclusive: number,
  tables: ExtractedTable[] = [],
): string {
  const lines: string[] = [];
  for (let index = headingParagraphIndex + 1; index < endParagraphIndexExclusive; index += 1) {
    const paragraph = paragraphs[index];
    if (!paragraph?.text.trim()) {
      continue;
    }
    if (isTableOfContentsEntry(paragraph.text)) {
      continue;
    }
    lines.push(paragraph.text.trim());
  }

  let body = lines.join('\n\n').trim();
  if (body.length === 0 && tables.length > 0) {
    body = tables
      .map((table) => table.text.trim())
      .filter(Boolean)
      .join('\n\n');
  }
  return body.trim();
}

export function findNextPeerOrHigherBoundary(
  boundaries: ParagraphSectionBoundary[],
  currentIndex: number,
  paragraphCount: number,
): number {
  const current = boundaries[currentIndex];
  for (let index = currentIndex + 1; index < boundaries.length; index += 1) {
    const next = boundaries[index];
    if (next.headingLevel <= current.headingLevel) {
      return next.paragraphIndex;
    }
  }
  return paragraphCount;
}

export function collectParagraphSectionBoundaries(
  paragraphs: ExtractedParagraph[],
  headings: ExtractedHeading[],
): ParagraphSectionBoundary[] {
  const charStarts = buildParagraphCharStarts(paragraphs);
  const boundaries: ParagraphSectionBoundary[] = [];
  const seenParagraphIndexes = new Set<number>();

  const pushBoundary = (boundary: ParagraphSectionBoundary) => {
    if (!boundary.headingText.trim() || seenParagraphIndexes.has(boundary.paragraphIndex)) {
      return;
    }
    if (isTableOfContentsEntry(boundary.headingText)) {
      return;
    }
    seenParagraphIndexes.add(boundary.paragraphIndex);
    boundaries.push(boundary);
  };

  for (const heading of headings) {
    pushBoundary({
      id: `boundary-heading-${heading.id}`,
      headingText: heading.text,
      headingLevel: heading.level,
      paragraphIndex: heading.paragraphIndex,
      charStart: heading.charStart,
      confidence: 0.9,
      detectionMethod: 'heading-style',
    });
  }

  for (const paragraph of paragraphs) {
    const text = paragraph.text.trim();
    if (!text || isTableOfContentsEntry(text)) {
      continue;
    }

    const numbered = NUMBERED_HEADING.exec(text);
    if (numbered) {
      pushBoundary({
        id: `boundary-number-${paragraph.index}`,
        headingText: text,
        headingLevel: numbered[1].split('.').length,
        paragraphIndex: paragraph.index,
        charStart: charStarts[paragraph.index] ?? 0,
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
        paragraphIndex: paragraph.index,
        charStart: charStarts[paragraph.index] ?? 0,
        confidence: 0.55,
        detectionMethod: 'all-caps',
      });
    }
  }

  boundaries.sort((left, right) => left.paragraphIndex - right.paragraphIndex);
  return boundaries;
}

export function buildSourcePreview(text: string, maxLength = 120): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function isLikelyHeaderFooterText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  if (/^page\s+\d+\s+of\s+\d+$/i.test(trimmed)) {
    return true;
  }
  if (/^confidential$/i.test(trimmed)) {
    return true;
  }
  if (/^draft\s+protocol$/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function isMostlyTableOfContentsDots(text: string): boolean {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return false;
  }
  const tocLike = lines.filter((line) => isTableOfContentsEntry(line) || /\.{4,}/.test(line));
  return tocLike.length / lines.length >= 0.5;
}

export function isHeadingOnlyBody(body: string, headingText: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) {
    return true;
  }
  const normalizedBody = trimmed.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedHeading = headingText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalizedBody === normalizedHeading;
}

export function isSuspiciousImportedBody(body: string, headingText: string): boolean {
  const trimmed = body.trim();
  if (trimmed.length >= MIN_IMPORTED_BODY_LENGTH) {
    if (isMostlyTableOfContentsDots(trimmed)) {
      return true;
    }
    if (isLikelyHeaderFooterText(trimmed)) {
      return true;
    }
    return false;
  }
  if (trimmed.length === 0) {
    return true;
  }
  if (isHeadingOnlyBody(trimmed, headingText)) {
    return true;
  }
  if (trimmed.length < 20 && headingText.length > trimmed.length) {
    return true;
  }
  return trimmed.length < MIN_IMPORTED_BODY_LENGTH;
}

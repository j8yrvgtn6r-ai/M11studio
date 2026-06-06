import {
  buildFullTextFromParagraphs,
  buildParagraphCharStarts,
  buildSourcePreview,
  findNextPeerOrHigherBoundary,
  isLikelyHeaderFooterText,
  isSuspiciousImportedBody,
  isTableOfContentsEntry,
} from '../protocol/import/sourceSectionBodyExtractor';
import type { ExtractedHeading, ExtractedParagraph, ExtractedTable } from '../protocol/import/types';
import type {
  BuildCanonicalDocumentInput,
  CanonicalBlock,
  CanonicalBlockType,
  CanonicalDocument,
  CanonicalSourceSection,
} from './canonicalDocumentTypes';

const NUMBERED_HEADING = /^(\d+(?:\.\d+)*)\s+(.+)$/;
const ALL_CAPS_HEADING = /^[A-Z][A-Z0-9\s\-–—:]{4,}$/;
const LIST_ITEM = /^(?:[-•●▪◦*]|\d+[.)]|[a-z][.)])\s+/i;
const PAGE_BREAK = /^page\s+break$/i;
const PAGE_NUMBER = /^page\s+\d+\s*(?:of\s+\d+)?$/i;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/^\d+(\.\d+)*\s*/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumbering(text: string): string | undefined {
  return NUMBERED_HEADING.exec(text.trim())?.[1];
}

function inferHeadingLevel(text: string, styleLevel?: number): number {
  if (styleLevel && styleLevel > 0) {
    return styleLevel;
  }
  const numbering = extractNumbering(text);
  if (numbering) {
    return numbering.split('.').length;
  }
  return 1;
}

function isNumberedHeading(text: string): boolean {
  return NUMBERED_HEADING.test(text.trim());
}

function isAllCapsHeading(text: string): boolean {
  return ALL_CAPS_HEADING.test(text.trim()) && text.trim().length <= 120;
}

function isListItem(text: string): boolean {
  return LIST_ITEM.test(text.trim());
}

function detectRepeatedHeaderFooterTexts(paragraphs: ExtractedParagraph[]): Set<string> {
  const counts = new Map<string, number>();
  for (const paragraph of paragraphs) {
    const normalized = normalizeWhitespace(paragraph.text).toLowerCase();
    if (!normalized || normalized.length > 160) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const repeated = new Set<string>();
  for (const [text, count] of counts.entries()) {
    if (count >= 3 && (text.length <= 80 || PAGE_NUMBER.test(text) || isLikelyHeaderFooterText(text))) {
      repeated.add(text);
    }
  }
  return repeated;
}

function classifyParagraphBlock(
  paragraph: ExtractedParagraph,
  repeatedTexts: Set<string>,
): { type: CanonicalBlockType; headingLevel?: number; numbering?: string; diagnostics: string[] } {
  const text = paragraph.text.trim();
  const diagnostics: string[] = [];

  if (!text) {
    return { type: 'unknown', diagnostics: ['Empty paragraph'] };
  }

  const normalizedLower = normalizeWhitespace(text).toLowerCase();
  if (repeatedTexts.has(normalizedLower)) {
    diagnostics.push('Repeated text classified as header/footer');
    return {
      type: isLikelyHeaderFooterText(text) || PAGE_NUMBER.test(text) ? 'footer' : 'header',
      diagnostics,
    };
  }

  if (PAGE_BREAK.test(text)) {
    return { type: 'pageBreak', diagnostics: ['Explicit page break marker'] };
  }

  if (isTableOfContentsEntry(text)) {
    diagnostics.push('Table of contents pattern detected');
    return { type: 'toc', diagnostics };
  }

  if (isLikelyHeaderFooterText(text) || PAGE_NUMBER.test(text)) {
    diagnostics.push('Header/footer pattern detected');
    return { type: 'footer', diagnostics };
  }

  if (paragraph.isHeadingStyle && paragraph.headingLevel) {
    return {
      type: 'heading',
      headingLevel: paragraph.headingLevel,
      numbering: extractNumbering(text),
      diagnostics,
    };
  }

  if (isNumberedHeading(text)) {
    return {
      type: 'heading',
      headingLevel: inferHeadingLevel(text),
      numbering: extractNumbering(text),
      diagnostics: ['Numbered heading detected'],
    };
  }

  if (isAllCapsHeading(text)) {
    return {
      type: 'heading',
      headingLevel: 1,
      diagnostics: ['ALL CAPS heading detected'],
    };
  }

  if (isListItem(text)) {
    return { type: 'listItem', diagnostics: ['List item marker detected'] };
  }

  return { type: 'paragraph', diagnostics };
}

function buildBlocksFromParagraphs(
  paragraphs: ExtractedParagraph[],
  tables: ExtractedTable[],
): { blocks: CanonicalBlock[]; warnings: string[] } {
  const warnings: string[] = [];
  const repeatedTexts = detectRepeatedHeaderFooterTexts(paragraphs);
  const blocks: CanonicalBlock[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.text.trim()) {
      continue;
    }

    const classification = classifyParagraphBlock(paragraph, repeatedTexts);
    if (classification.diagnostics.length > 0 && classification.type !== 'paragraph') {
      warnings.push(...classification.diagnostics.map((detail) => `${paragraph.text.slice(0, 60)}: ${detail}`));
    }

    blocks.push({
      id: `block-${paragraph.index}`,
      type: classification.type,
      text: normalizeWhitespace(paragraph.text),
      normalizedText: normalizeTitle(paragraph.text) || normalizeWhitespace(paragraph.text).toLowerCase(),
      styleName: paragraph.styleName,
      numbering: classification.numbering,
      headingLevel: classification.headingLevel,
      sourceFormat: 'docx',
      sourceIndex: paragraph.index,
    });
  }

  let tableOffset = paragraphs.length;
  for (const table of tables) {
    if (!table.text.trim()) {
      continue;
    }
    blocks.push({
      id: `block-table-${table.index}`,
      type: 'table',
      text: table.text.trim(),
      normalizedText: normalizeTitle(table.text) || normalizeWhitespace(table.text).toLowerCase(),
      sourceFormat: 'docx',
      sourceIndex: tableOffset,
    });
    tableOffset += 1;
  }

  return { blocks, warnings };
}

function isSectionHeadingBlock(block: CanonicalBlock): boolean {
  return block.type === 'heading' && block.headingLevel !== undefined;
}

function findNextPeerOrHigherHeadingBlock(
  blocks: CanonicalBlock[],
  headingIndices: number[],
  currentPosition: number,
): number {
  const currentIndex = headingIndices[currentPosition];
  const current = blocks[currentIndex];
  const currentLevel = current.headingLevel ?? 1;

  for (let position = currentPosition + 1; position < headingIndices.length; position += 1) {
    const nextIndex = headingIndices[position];
    const next = blocks[nextIndex];
    if ((next.headingLevel ?? 1) <= currentLevel) {
      return nextIndex;
    }
  }
  return blocks.length;
}

function collectSectionBodyText(blocks: CanonicalBlock[], startIndex: number, endIndexExclusive: number): string {
  const lines: string[] = [];
  for (let index = startIndex + 1; index < endIndexExclusive; index += 1) {
    const block = blocks[index];
    if (!block?.text.trim()) {
      continue;
    }
    if (block.type === 'toc' || block.type === 'header' || block.type === 'footer' || block.type === 'pageBreak') {
      continue;
    }
    if (isSectionHeadingBlock(block)) {
      break;
    }
    lines.push(block.text);
  }
  return lines.join('\n\n').trim();
}

function buildCanonicalSections(blocks: CanonicalBlock[]): CanonicalSourceSection[] {
  const headingIndices = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isSectionHeadingBlock(block))
    .map(({ index }) => index);

  if (headingIndices.length === 0) {
    return [];
  }

  return headingIndices.map((startBlockIndex, sectionIndex) => {
    const headingBlock = blocks[startBlockIndex];
    const endBlockIndex = findNextPeerOrHigherHeadingBlock(blocks, headingIndices, sectionIndex);
    const blockIds = blocks.slice(startBlockIndex, endBlockIndex).map((block) => block.id);
    const bodyText = collectSectionBodyText(blocks, startBlockIndex, endBlockIndex);
    const title = headingBlock.text;
    const text = bodyText ? `${title}\n\n${bodyText}` : title;
    const diagnostics: string[] = [];

    if (!bodyText) {
      diagnostics.push('Section has heading only (no body blocks)');
    }
    if (isSuspiciousImportedBody(bodyText, title)) {
      diagnostics.push('Section body flagged as suspicious or too short');
    }
    if (headingBlock.type === 'heading' && headingBlock.numbering) {
      diagnostics.push(`Detected numbering: ${headingBlock.numbering}`);
    }

    return {
      id: `canonical-section-${sectionIndex + 1}`,
      title,
      normalizedTitle: normalizeTitle(title),
      numbering: headingBlock.numbering ?? extractNumbering(title),
      headingLevel: headingBlock.headingLevel ?? inferHeadingLevel(title),
      startBlockIndex,
      endBlockIndex,
      blockIds,
      text,
      diagnostics,
    };
  });
}

function createWholeDocumentSection(blocks: CanonicalBlock[], fullText: string): CanonicalSourceSection {
  return {
    id: 'canonical-section-whole-document',
    title: 'Full document',
    normalizedTitle: 'full document',
    headingLevel: 1,
    startBlockIndex: 0,
    endBlockIndex: blocks.length,
    blockIds: blocks.map((block) => block.id),
    text: fullText.trim(),
    diagnostics: ['Fallback whole-document section — no structured headings detected'],
  };
}

/** Builds a CanonicalDocument from raw DOCX extraction output. */
export function buildCanonicalDocument(input: BuildCanonicalDocumentInput): CanonicalDocument {
  input.onProgress?.({
    phase: 'building',
    message: 'Building Canonical Document',
  });

  const warnings = [...(input.warnings ?? [])];
  const alignedFullText =
    input.paragraphs.length > 0 ? buildFullTextFromParagraphs(input.paragraphs) : input.fullText;

  input.onProgress?.({
    phase: 'classifying',
    message: 'Classifying document blocks',
  });

  const { blocks, warnings: classificationWarnings } = buildBlocksFromParagraphs(
    input.paragraphs,
    input.tables,
  );
  warnings.push(...classificationWarnings);

  input.onProgress?.({
    phase: 'sections',
    message: 'Constructing canonical sections',
  });

  let sections = buildCanonicalSections(blocks);
  if (sections.length === 0 && alignedFullText.trim()) {
    sections = [createWholeDocumentSection(blocks, alignedFullText)];
    warnings.push('No structured headings detected; using whole-document canonical section.');
  }

  const statistics = {
    blockCount: blocks.length,
    headingCount: blocks.filter((block) => block.type === 'heading').length,
    sectionCount: sections.length,
    tableCount: blocks.filter((block) => block.type === 'table').length,
  };

  input.onProgress?.({
    phase: 'complete',
    message: 'Canonical document complete',
    metadata: {
      blockCount: statistics.blockCount,
      sectionCount: statistics.sectionCount,
      tableCount: statistics.tableCount,
      headingCount: statistics.headingCount,
    },
  });

  return {
    id: `canonical-${input.uploadId}`,
    blocks,
    sections,
    warnings,
    statistics,
  };
}

export function buildCanonicalDocumentFromImportedSource(
  source: import('../protocol/import/types').ImportedProtocolSource,
  onProgress?: BuildCanonicalDocumentInput['onProgress'],
): CanonicalDocument {
  return buildCanonicalDocument({
    uploadId: source.uploadId,
    filename: source.filename,
    paragraphs: source.paragraphs,
    headings: source.headings,
    tables: source.tables,
    fullText: source.fullText,
    warnings: source.extractionWarnings,
    onProgress,
  });
}

// Re-export helpers used by selectors
export { buildParagraphCharStarts, buildSourcePreview, normalizeTitle };

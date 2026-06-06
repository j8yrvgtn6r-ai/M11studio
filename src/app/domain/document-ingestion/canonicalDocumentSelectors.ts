import {
  buildParagraphCharStarts,
  buildSourcePreview,
  isSuspiciousImportedBody,
} from '../protocol/import/sourceSectionBodyExtractor';
import type { ExtractedParagraph, ExtractedTable, SourceSectionCandidate } from '../protocol/import/types';
import type { CanonicalDocument, CanonicalSourceSection } from './canonicalDocumentTypes';
import { calculateSectionSimilarity } from './canonicalDocumentDiagnostics';

function bodyTextFromSection(section: CanonicalSourceSection): string {
  const parts = section.text.split('\n\n');
  if (parts.length <= 1) {
    return '';
  }
  return parts.slice(1).join('\n\n').trim();
}

/** Converts canonical sections into legacy SourceSectionCandidate records for downstream adapters. */
export function canonicalSectionsToSourceCandidates(
  document: CanonicalDocument,
  paragraphs: ExtractedParagraph[],
  tables: ExtractedTable[] = [],
): SourceSectionCandidate[] {
  const charStarts = buildParagraphCharStarts(paragraphs);

  return document.sections.map((section, index) => {
    const startBlock = document.blocks[section.startBlockIndex];
    const endBlockIndex = Math.min(section.endBlockIndex, document.blocks.length);
    const paragraphIndex = startBlock?.sourceIndex ?? 0;
    const endParagraphIndex =
      endBlockIndex < document.blocks.length
        ? document.blocks[endBlockIndex]?.sourceIndex ?? paragraphs.length
        : paragraphs.length;

    const bodyText = bodyTextFromSection(section);
    const charStart = charStarts[paragraphIndex] ?? 0;
    const charEnd =
      endParagraphIndex < paragraphs.length ? charStarts[endParagraphIndex] ?? charStarts.at(-1) ?? 0 : charStarts.at(-1) ?? 0;

    let confidence = 0.75;
    let detectionMethod: SourceSectionCandidate['detectionMethod'] = 'heading-style';
    if (section.numbering) {
      confidence = 0.85;
      detectionMethod = 'numbering';
    }
    if (section.id.includes('whole-document')) {
      confidence = 0.35;
      detectionMethod = 'whole-document';
    }

    return {
      id: section.id,
      headingText: section.title,
      headingLevel: section.headingLevel,
      startIndex: charStart,
      endIndex: charEnd,
      sourceStartParagraphIndex: paragraphIndex,
      sourceEndParagraphIndex: endParagraphIndex,
      text: section.text,
      bodyText,
      confidence,
      detectedNumber: section.numbering,
      detectionMethod,
      sourcePreview: buildSourcePreview(bodyText || section.title),
      importedTextLength: bodyText.length,
      isSuspiciousBody: isSuspiciousImportedBody(bodyText, section.title),
      canonicalSectionId: section.id,
    };
  });
}

export function selectCanonicalSectionById(
  document: CanonicalDocument | null | undefined,
  sectionId: string | null | undefined,
): CanonicalSourceSection | null {
  if (!document || !sectionId) {
    return null;
  }
  return document.sections.find((section) => section.id === sectionId) ?? null;
}

export function selectCanonicalSectionForSourceCandidate(
  document: CanonicalDocument | null | undefined,
  candidate: SourceSectionCandidate | null | undefined,
): CanonicalSourceSection | null {
  if (!document || !candidate) {
    return null;
  }
  if (candidate.canonicalSectionId) {
    return selectCanonicalSectionById(document, candidate.canonicalSectionId);
  }
  return (
    document.sections.find(
      (section) => section.title.trim().toLowerCase() === candidate.headingText.trim().toLowerCase(),
    ) ?? null
  );
}

export function selectBestSimilarityForM11Section(
  document: CanonicalDocument | null | undefined,
  m11SectionId: string,
  m11Title: string,
): (SectionSimilarityResult & { canonicalSectionId: string; canonicalTitle: string }) | null {
  if (!document) {
    return null;
  }

  let best: (SectionSimilarityResult & { canonicalSectionId: string; canonicalTitle: string }) | null = null;
  for (const section of document.sections) {
    const result = calculateSectionSimilarity(section, { id: m11SectionId, title: m11Title });
    if (!best || result.score > best.score) {
      best = {
        ...result,
        canonicalSectionId: section.id,
        canonicalTitle: section.title,
      };
    }
  }
  return best;
}

export function selectDocumentStatisticsSummary(document: CanonicalDocument | null | undefined): string | null {
  if (!document) {
    return null;
  }
  const { blockCount, sectionCount, tableCount } = document.statistics;
  return `${blockCount} blocks · ${sectionCount} sections · ${tableCount} tables`;
}

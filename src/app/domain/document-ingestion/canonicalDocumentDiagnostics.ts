import type { IchM11SectionSpec } from '../protocol/ichM11/types';
import type { CanonicalBlock, CanonicalDocument, CanonicalSourceSection, SectionSimilarityResult } from './canonicalDocumentTypes';

const TITLE_SYNONYM_TARGETS: Record<string, string[]> = {
  '3': ['study objectives', 'trial objectives', 'objectives and estimands'],
  '3.1': ['primary objective', 'primary objectives'],
  '5.2': ['inclusion criteria'],
  '5.3': ['exclusion criteria'],
  '4': ['study design', 'trial design'],
  '6.7': ['randomization and blinding', 'randomisation and blinding', 'randomization', 'randomisation'],
  '8.4': ['safety assessments', 'safety assessment'],
  '8.4.2': ['vital signs'],
  '10': ['statistical analysis', 'statistical considerations', 'statistical methods'],
};

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\d+(\.\d+)*\s*/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(normalizeForMatch(left).split(' ').filter(Boolean));
  const rightTokens = normalizeForMatch(right).split(' ').filter(Boolean);
  if (leftTokens.size === 0 || rightTokens.length === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of rightTokens) {
    if (leftTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(leftTokens.size, rightTokens.length);
}

function matchesSynonym(specId: string, headingText: string): boolean {
  const synonyms = TITLE_SYNONYM_TARGETS[specId] ?? [];
  const normalized = normalizeForMatch(headingText);
  return synonyms.some((synonym) => normalized.includes(synonym) || synonym.includes(normalized));
}

/** Deterministic multi-layer similarity between a canonical source section and an M11 spec. */
export function calculateSectionSimilarity(
  canonicalSection: CanonicalSourceSection,
  m11Spec: Pick<IchM11SectionSpec, 'id' | 'title'>,
): SectionSimilarityResult {
  const reasons: string[] = [];
  const title = canonicalSection.title;
  const numbering = canonicalSection.numbering;

  if (numbering && numbering === m11Spec.id) {
    const titleOverlap = tokenOverlap(title, m11Spec.title);
    if (titleOverlap >= 0.25 || matchesSynonym(m11Spec.id, title) || m11Spec.id.includes('.')) {
      reasons.push(`exact number match (${numbering})`);
      if (titleOverlap >= 0.25) {
        reasons.push(`title overlap ${(titleOverlap * 100).toFixed(0)}%`);
      }
      return { score: 0.98, reasons };
    }
    reasons.push(`number match (${numbering}) with weak title alignment`);
    return { score: Math.max(0.4, tokenOverlap(title, m11Spec.title)), reasons };
  }

  const normalizedHeading = normalizeForMatch(title);
  const normalizedTitle = normalizeForMatch(m11Spec.title);
  if (normalizedHeading === normalizedTitle) {
    reasons.push('exact normalized title');
    return { score: 0.95, reasons };
  }

  if (numbering && m11Spec.id.startsWith(`${numbering}.`) && tokenOverlap(title, m11Spec.title) >= 0.5) {
    reasons.push(`parent number match (${numbering})`);
    reasons.push('normalized title overlap >= 50%');
    return { score: 0.9, reasons };
  }

  if (matchesSynonym(m11Spec.id, title)) {
    reasons.push('synonym match');
    return { score: 0.82, reasons };
  }

  const titleOverlap = tokenOverlap(title, m11Spec.title);
  if (titleOverlap >= 0.45) {
    reasons.push(`token overlap ${(titleOverlap * 100).toFixed(0)}%`);
    return { score: titleOverlap, reasons };
  }

  const bodySample = canonicalSection.text.slice(0, 600);
  const contextOverlap = tokenOverlap(bodySample, m11Spec.title);
  if (contextOverlap >= 0.35) {
    reasons.push(`content context overlap ${(contextOverlap * 100).toFixed(0)}%`);
    return { score: contextOverlap, reasons };
  }

  if (titleOverlap > 0) {
    reasons.push(`weak token overlap ${(titleOverlap * 100).toFixed(0)}%`);
  } else {
    reasons.push('no meaningful overlap');
  }
  return { score: titleOverlap, reasons };
}

export function findBestM11SimilarityMatches(
  document: CanonicalDocument,
  m11Specs: Array<Pick<IchM11SectionSpec, 'id' | 'title'>>,
  limit = 3,
): Map<string, SectionSimilarityResult & { m11SectionId: string; m11Title: string }> {
  const bestBySection = new Map<string, SectionSimilarityResult & { m11SectionId: string; m11Title: string }>();

  for (const section of document.sections) {
    let best:
      | (SectionSimilarityResult & { m11SectionId: string; m11Title: string })
      | undefined;

    for (const spec of m11Specs) {
      const result = calculateSectionSimilarity(section, spec);
      if (!best || result.score > best.score) {
        best = {
          ...result,
          m11SectionId: spec.id,
          m11Title: spec.title,
        };
      }
    }

    if (best) {
      bestBySection.set(section.id, best);
    }
  }

  return bestBySection;
}

export function summarizeCanonicalDocumentDiagnostics(document: CanonicalDocument): string[] {
  const lines: string[] = [
    `${document.statistics.blockCount} blocks`,
    `${document.statistics.sectionCount} sections`,
    `${document.statistics.headingCount} headings`,
    `${document.statistics.tableCount} tables`,
  ];
  if (document.warnings.length > 0) {
    lines.push(`${document.warnings.length} classification warning(s)`);
  }
  return lines;
}

export function blockClassificationWarnings(block: CanonicalBlock): string[] {
  const warnings: string[] = [];
  if (block.type === 'toc') {
    warnings.push('Classified as table of contents');
  }
  if (block.type === 'header' || block.type === 'footer') {
    warnings.push(`Classified as ${block.type}`);
  }
  if (block.type === 'unknown' && block.text.trim()) {
    warnings.push('Unclassified block');
  }
  return warnings;
}

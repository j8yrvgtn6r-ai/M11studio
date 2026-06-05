import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import type { SourceSectionCandidate } from './types';

const M11_SPECS = ICH_M11_TEMPLATE_SECTION_SPECS.map((spec) => ({
  id: spec.id,
  title: spec.title,
  number: spec.number,
  normalizedTitle: normalizeForMatch(spec.title),
}));

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

/** Assigns possibleM11SectionId to source section candidates. */
export function mapSourceCandidatesToM11(
  candidates: SourceSectionCandidate[],
): SourceSectionCandidate[] {
  return candidates.map((candidate) => {
    const possibleM11SectionId = resolveM11SectionId(candidate);
    return possibleM11SectionId
      ? { ...candidate, possibleM11SectionId }
      : candidate;
  });
}

function resolveM11SectionId(candidate: SourceSectionCandidate): string | undefined {
  if (candidate.detectedNumber) {
    const byNumber = M11_SPECS.find((spec) => spec.id === candidate.detectedNumber);
    if (byNumber) {
      return byNumber.id;
    }
  }

  const normalizedHeading = normalizeForMatch(candidate.headingText);
  let bestId: string | undefined;
  let bestScore = 0;

  for (const spec of M11_SPECS) {
    if (normalizedHeading === spec.normalizedTitle) {
      return spec.id;
    }
    const score = tokenOverlap(candidate.headingText, spec.title);
    if (score > bestScore) {
      bestScore = score;
      bestId = spec.id;
    }
  }

  return bestScore >= 0.45 ? bestId : undefined;
}

/** Returns source candidates most relevant to an M11 template section. */
export function findRelevantSourceCandidates(
  m11SectionId: string,
  m11Title: string,
  candidates: SourceSectionCandidate[],
  limit = 3,
): SourceSectionCandidate[] {
  const scored = candidates
    .map((candidate) => {
      let score = candidate.confidence;
      if (candidate.possibleM11SectionId === m11SectionId) {
        score += 0.5;
      }
      if (candidate.detectedNumber === m11SectionId) {
        score += 0.4;
      }
      score += tokenOverlap(candidate.headingText, m11Title) * 0.35;
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, limit).map((entry) => entry.candidate);
}

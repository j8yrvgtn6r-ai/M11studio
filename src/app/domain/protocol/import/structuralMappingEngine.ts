import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../ichM11/types';
import { isTemplateInstructionNode } from '../selectors/sectionVisibility';
import { mapSourceCandidatesToM11 } from './m11SourceSectionMapping';
import {
  buildSourcePreview,
  isAppendixHeading,
  isAppendixM11Section,
  isSuspiciousImportedBody,
  MIN_IMPORTED_BODY_LENGTH,
} from './sourceSectionBodyExtractor';
import type {
  ImportedProtocolSource,
  MappedProtocolSection,
  MappingMethod,
  SourceSectionCandidate,
  StructuralMappingResult,
} from './types';

const MIN_IMPORT_CONFIDENCE = 0.45;

export interface StructuralMappingOptions {
  onMapping?: (mapping: MappedProtocolSection) => void;
  onRejectedMapping?: (details: {
    mappedM11SectionId: string;
    sourceHeading: string;
    reason: string;
  }) => void;
}

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

function scoreCandidateForSpec(
  candidate: SourceSectionCandidate,
  spec: IchM11SectionSpec,
): { score: number; method: MappingMethod } {
  if (candidate.detectedNumber === spec.id) {
    return { score: 0.95, method: 'heading-number' };
  }
  if (candidate.possibleM11SectionId === spec.id) {
    return { score: Math.max(0.75, candidate.confidence), method: 'semantic-similarity' };
  }

  const normalizedHeading = normalizeForMatch(candidate.headingText);
  const normalizedTitle = normalizeForMatch(spec.title);
  if (normalizedHeading === normalizedTitle) {
    return { score: 0.9, method: 'heading-title' };
  }

  const overlap = tokenOverlap(candidate.headingText, spec.title);
  if (overlap >= 0.45) {
    return { score: overlap, method: 'semantic-similarity' };
  }

  const bodySample = candidate.bodyText ?? candidate.text;
  const contextOverlap = tokenOverlap(bodySample.slice(0, 600), spec.title);
  if (contextOverlap >= 0.35) {
    return { score: contextOverlap, method: 'content-context' };
  }

  return { score: overlap, method: 'semantic-similarity' };
}

function isAuthorableM11Spec(spec: IchM11SectionSpec): boolean {
  if (isTemplateInstructionNode(spec.id)) {
    return false;
  }
  return spec.sectionType !== 'template-instruction';
}

function resolveImportedBody(candidate: SourceSectionCandidate): string {
  return (candidate.bodyText ?? candidate.text).trim();
}

function shouldRejectCandidateForSpec(
  candidate: SourceSectionCandidate,
  spec: IchM11SectionSpec,
): string | null {
  const body = resolveImportedBody(candidate);
  if (isAppendixHeading(candidate.headingText) && !isAppendixM11Section(spec.id, spec.title)) {
    return 'Appendix heading cannot map to non-appendix M11 section';
  }
  if (candidate.isSuspiciousBody || isSuspiciousImportedBody(body, candidate.headingText)) {
    return `Imported body shorter than ${MIN_IMPORTED_BODY_LENGTH} characters`;
  }
  if (!body.trim()) {
    return 'No body text under source heading';
  }
  return null;
}

function buildMappedSection(
  candidate: SourceSectionCandidate,
  spec: IchM11SectionSpec,
  score: number,
  method: MappingMethod,
): MappedProtocolSection {
  const sourceText = resolveImportedBody(candidate);
  return {
    mappedM11SectionId: spec.id,
    mappedM11SectionTitle: spec.title,
    sourceSectionId: candidate.id,
    sourceHeading: candidate.headingText,
    sourceHeadingLevel: candidate.headingLevel,
    sourceText,
    sourceCandidateId: candidate.id,
    sourceStartIndex: candidate.sourceStartParagraphIndex ?? candidate.startIndex,
    sourceEndIndex: candidate.sourceEndParagraphIndex ?? candidate.endIndex,
    mappingConfidence: Number(score.toFixed(3)),
    mappingMethod: method,
    needsValidation: true,
    importedTextLength: sourceText.length,
    sourcePreview: candidate.sourcePreview ?? buildSourcePreview(sourceText),
  };
}

/** Compare uploaded protocol hierarchy against M11 and produce authoritative section mappings. */
export function runStructuralMappingEngine(
  source: ImportedProtocolSource,
  options?: StructuralMappingOptions,
): StructuralMappingResult {
  const candidates = mapSourceCandidatesToM11(source.sections);
  const specs = ICH_M11_TEMPLATE_SECTION_SPECS.filter(isAuthorableM11Spec);
  const mappings: MappedProtocolSection[] = [];
  const usedCandidateIds = new Set<string>();

  for (const spec of specs) {
    let bestCandidate: SourceSectionCandidate | undefined;
    let bestScore = 0;
    let bestMethod: MappingMethod = 'semantic-similarity';

    for (const candidate of candidates) {
      if (usedCandidateIds.has(candidate.id)) {
        continue;
      }
      const rejection = shouldRejectCandidateForSpec(candidate, spec);
      if (rejection) {
        continue;
      }
      const { score, method } = scoreCandidateForSpec(candidate, spec);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
        bestMethod = method;
      }
    }

    if (!bestCandidate || bestScore < MIN_IMPORT_CONFIDENCE) {
      continue;
    }

    const rejection = shouldRejectCandidateForSpec(bestCandidate, spec);
    if (rejection) {
      options?.onRejectedMapping?.({
        mappedM11SectionId: spec.id,
        sourceHeading: bestCandidate.headingText,
        reason: rejection,
      });
      continue;
    }

    usedCandidateIds.add(bestCandidate.id);
    const mapping = buildMappedSection(bestCandidate, spec, bestScore, bestMethod);
    mappings.push(mapping);
    options?.onMapping?.(mapping);
  }

  const mappedSectionIds = mappings.map((mapping) => mapping.mappedM11SectionId);
  const needsGenerationSectionIds = specs
    .filter((spec) => !mappedSectionIds.includes(spec.id))
    .map((spec) => spec.id);

  return { mappings, mappedSectionIds, needsGenerationSectionIds };
}

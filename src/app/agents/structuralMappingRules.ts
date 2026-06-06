import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../domain/protocol/ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../domain/protocol/ichM11/types';
import { isTemplateInstructionNode } from '../domain/protocol/selectors/sectionVisibility';
import { mapSourceCandidatesToM11 } from '../domain/protocol/import/m11SourceSectionMapping';
import {
  buildSourcePreview,
  isAppendixHeading,
  isAppendixM11Section,
  isHeadingOnlyBody,
  isLikelyHeaderFooterText,
  isMostlyTableOfContentsDots,
  isSuspiciousImportedBody,
  isTableOfContentsEntry,
  MIN_IMPORTED_BODY_LENGTH,
} from '../domain/protocol/import/sourceSectionBodyExtractor';
import type {
  ImportedProtocolSource,
  MappedProtocolSection,
  MappingMethod,
  SourceSectionCandidate,
  StructuralMappingResult,
} from '../domain/protocol/import/types';

export type StructuralMappingAgentTrigger = 'import' | 'manual' | 'remap';

export interface StructuralMappingAgentInput {
  sourceExtraction: ImportedProtocolSource | null | undefined;
  m11TemplateSections?: IchM11SectionSpec[];
  existingMappedSections?: MappedProtocolSection[];
  trigger: StructuralMappingAgentTrigger;
  metadata?: Record<string, string | number | boolean>;
}

export interface AgentMappedSection {
  sourceSectionId: string;
  sourceHeading: string;
  sourceHeadingLevel?: number;
  sourceStartIndex: number;
  sourceEndIndex: number;
  mappedM11SectionId: string;
  mappedM11Title: string;
  mappingMethod: MappingMethod;
  mappingScore: number;
  importedText: string;
  importedTextLength: number;
  sourcePreview: string;
  warnings: string[];
}

export interface SuspiciousMappingRecord {
  sourceSectionId: string;
  sourceHeading: string;
  mappedM11SectionId: string;
  mappedM11Title: string;
  mappingMethod: MappingMethod;
  mappingScore: number;
  reason: string;
  warnings: string[];
}

export interface StructuralMappingAgentOutput {
  mappedSections: AgentMappedSection[];
  unmappedSourceSections: SourceSectionCandidate[];
  unmappedM11Sections: string[];
  suspiciousMappings: SuspiciousMappingRecord[];
  mappingSummary: {
    importedCount: number;
    needsGenerationCount: number;
    suspiciousCount: number;
    unmappedSourceCount: number;
  };
}

export interface StructuralMappingRuleOptions {
  onMapping?: (mapping: AgentMappedSection) => void;
  onRejectedMapping?: (details: {
    mappedM11SectionId: string;
    sourceHeading: string;
    reason: string;
  }) => void;
  onSuspiciousMapping?: (record: SuspiciousMappingRecord) => void;
}

const MIN_IMPORT_CONFIDENCE = 0.45;

/** Known title synonyms for deterministic semantic matching. */
export const TITLE_SYNONYM_TARGETS: Record<string, string[]> = {
  '3': ['study objectives', 'trial objectives', 'objectives and estimands'],
  '3.1': ['primary objective', 'primary objectives'],
  '5.2': ['inclusion criteria'],
  '5.3': ['exclusion criteria'],
  '4': ['study design', 'trial design'],
  '6.7': ['randomization and blinding', 'randomisation and blinding', 'randomization', 'randomisation'],
  '8.4': ['safety assessments', 'safety assessment'],
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

function isAuthorableM11Spec(spec: IchM11SectionSpec): boolean {
  if (isTemplateInstructionNode(spec.id)) {
    return false;
  }
  return spec.sectionType !== 'template-instruction';
}

function resolveImportedBody(candidate: SourceSectionCandidate): string {
  return (candidate.bodyText ?? candidate.text).trim();
}

function evaluateSuspiciousReason(
  candidate: SourceSectionCandidate,
  spec: IchM11SectionSpec,
): string | null {
  const body = resolveImportedBody(candidate);

  if (isAppendixHeading(candidate.headingText) && !isAppendixM11Section(spec.id, spec.title)) {
    return 'Appendix heading cannot map to non-appendix M11 section';
  }
  if (isTableOfContentsEntry(candidate.headingText) || isMostlyTableOfContentsDots(body)) {
    return 'Source text appears to be a table of contents entry';
  }
  if (isLikelyHeaderFooterText(body)) {
    return 'Source text appears to be header/footer content';
  }
  if (isHeadingOnlyBody(body, candidate.headingText)) {
    return 'Source text is only a heading without body content';
  }
  if (candidate.isSuspiciousBody || isSuspiciousImportedBody(body, candidate.headingText)) {
    return `Imported body shorter than ${MIN_IMPORTED_BODY_LENGTH} characters or low quality`;
  }
  if (!body.trim()) {
    return 'No body text under source heading';
  }
  return null;
}

function scoreCandidateForSpec(
  candidate: SourceSectionCandidate,
  spec: IchM11SectionSpec,
): { score: number; method: MappingMethod } {
  const titleOverlap = tokenOverlap(candidate.headingText, spec.title);

  if (candidate.detectedNumber === spec.id) {
    const titleAligned =
      titleOverlap >= 0.25 || matchesSynonym(spec.id, candidate.headingText);
    const subsectionNumber = spec.id.includes('.');
    if (titleAligned || subsectionNumber) {
      return { score: 0.98, method: 'exactNumber' };
    }
    // Source outline numbering often differs from M11 — do not treat bare numbers as exact.
    return { score: Math.max(0.4, titleOverlap), method: 'semanticTitle' };
  }

  const normalizedHeading = normalizeForMatch(candidate.headingText);
  const normalizedTitle = normalizeForMatch(spec.title);
  if (normalizedHeading === normalizedTitle) {
    return { score: 0.95, method: 'exactTitle' };
  }

  if (
    candidate.detectedNumber &&
    spec.id.startsWith(`${candidate.detectedNumber}.`) &&
    titleOverlap >= 0.5
  ) {
    return { score: 0.9, method: 'normalizedTitle' };
  }

  if (matchesSynonym(spec.id, candidate.headingText)) {
    return { score: 0.82, method: 'semanticTitle' };
  }

  if (candidate.possibleM11SectionId === spec.id && titleOverlap >= 0.2) {
    return { score: Math.max(0.75, candidate.confidence), method: 'semanticTitle' };
  }

  if (titleOverlap >= 0.45) {
    return { score: titleOverlap, method: 'semanticTitle' };
  }

  const bodySample = candidate.bodyText ?? candidate.text;
  const contextOverlap = tokenOverlap(bodySample.slice(0, 600), spec.title);
  if (contextOverlap >= 0.35) {
    return { score: contextOverlap, method: 'contentHeuristic' };
  }

  return { score: titleOverlap, method: 'semanticTitle' };
}

function toMappedProtocolSection(mapping: AgentMappedSection): MappedProtocolSection {
  return {
    mappedM11SectionId: mapping.mappedM11SectionId,
    mappedM11SectionTitle: mapping.mappedM11Title,
    sourceSectionId: mapping.sourceSectionId,
    sourceHeading: mapping.sourceHeading,
    sourceHeadingLevel: mapping.sourceHeadingLevel,
    sourceText: mapping.importedText,
    sourceCandidateId: mapping.sourceSectionId,
    sourceStartIndex: mapping.sourceStartIndex,
    sourceEndIndex: mapping.sourceEndIndex,
    mappingConfidence: Number(mapping.mappingScore.toFixed(3)),
    mappingMethod: mapping.mappingMethod,
    needsValidation: true,
    importedTextLength: mapping.importedTextLength,
    sourcePreview: mapping.sourcePreview,
    mappingWarnings: mapping.warnings,
  };
}

export function toStructuralMappingResult(output: StructuralMappingAgentOutput): StructuralMappingResult {
  return {
    mappings: output.mappedSections.map(toMappedProtocolSection),
    mappedSectionIds: output.mappedSections.map((entry) => entry.mappedM11SectionId),
    needsGenerationSectionIds: output.unmappedM11Sections,
  };
}

export function evaluateStructuralMapping(
  input: StructuralMappingAgentInput,
  options?: StructuralMappingRuleOptions,
): StructuralMappingAgentOutput {
  if (!input.sourceExtraction) {
    return emptyStructuralMappingOutput();
  }

  const specs = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).filter(isAuthorableM11Spec);
  const candidates = mapSourceCandidatesToM11(input.sourceExtraction.sections);
  const mappedSections: AgentMappedSection[] = [];
  const suspiciousMappings: SuspiciousMappingRecord[] = [];
  const usedCandidateIds = new Set<string>();
  const mappedM11Ids = new Set<string>();
  const alternateCandidates = new Map<string, string[]>();

  interface ScoredPair {
    spec: IchM11SectionSpec;
    candidate: SourceSectionCandidate;
    score: number;
    method: MappingMethod;
    suspiciousReason: string | null;
  }

  const scoredPairs: ScoredPair[] = [];
  for (const spec of specs) {
    for (const candidate of candidates) {
      const { score, method } = scoreCandidateForSpec(candidate, spec);
      if (score < MIN_IMPORT_CONFIDENCE) {
        continue;
      }
      scoredPairs.push({
        spec,
        candidate,
        score,
        method,
        suspiciousReason: evaluateSuspiciousReason(candidate, spec),
      });
    }
  }

  scoredPairs.sort((left, right) => right.score - left.score);

  for (const pair of scoredPairs) {
    const { spec, candidate, score, method, suspiciousReason } = pair;

    if (suspiciousReason) {
      continue;
    }

    if (usedCandidateIds.has(candidate.id) || mappedM11Ids.has(spec.id)) {
      if (mappedM11Ids.has(spec.id) && !usedCandidateIds.has(candidate.id)) {
        alternateCandidates.set(spec.id, [
          ...(alternateCandidates.get(spec.id) ?? []),
          `${candidate.headingText} (${method}, ${score.toFixed(2)})`,
        ]);
      }
      continue;
    }

    usedCandidateIds.add(candidate.id);
    mappedM11Ids.add(spec.id);

    const importedText = resolveImportedBody(candidate);
    const mapping: AgentMappedSection = {
      sourceSectionId: candidate.id,
      sourceHeading: candidate.headingText,
      sourceHeadingLevel: candidate.headingLevel,
      sourceStartIndex: candidate.sourceStartParagraphIndex ?? candidate.startIndex,
      sourceEndIndex: candidate.sourceEndParagraphIndex ?? candidate.endIndex,
      mappedM11SectionId: spec.id,
      mappedM11Title: spec.title,
      mappingMethod: method,
      mappingScore: Number(score.toFixed(3)),
      importedText,
      importedTextLength: importedText.length,
      sourcePreview: candidate.sourcePreview ?? buildSourcePreview(importedText),
      warnings: [
        `Imported from source heading: ${candidate.headingText}`,
        `Mapping method: ${method}`,
        `Imported text length: ${importedText.length} characters`,
      ],
    };

    const alternates = alternateCandidates.get(spec.id);
    if (alternates?.length) {
      mapping.warnings.push(`Alternate source headings ignored: ${alternates.join('; ')}`);
    }

    mappedSections.push(mapping);
    options?.onMapping?.(mapping);
  }

  for (const spec of specs) {
    if (mappedM11Ids.has(spec.id)) {
      continue;
    }

    let bestCandidate: SourceSectionCandidate | undefined;
    let bestScore = 0;
    let bestMethod: MappingMethod = 'semanticTitle';
    let bestSuspiciousReason: string | null = null;

    for (const candidate of candidates) {
      if (usedCandidateIds.has(candidate.id)) {
        continue;
      }

      const { score, method } = scoreCandidateForSpec(candidate, spec);
      if (score <= bestScore) {
        continue;
      }

      const suspiciousReason = evaluateSuspiciousReason(candidate, spec);
      if (suspiciousReason) {
        if (score >= MIN_IMPORT_CONFIDENCE && score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          bestMethod = method;
          bestSuspiciousReason = suspiciousReason;
        }
        continue;
      }

      bestScore = score;
      bestCandidate = candidate;
      bestMethod = method;
      bestSuspiciousReason = null;
    }

    if (!bestCandidate || bestScore < MIN_IMPORT_CONFIDENCE || !bestSuspiciousReason) {
      continue;
    }

    const record: SuspiciousMappingRecord = {
      sourceSectionId: bestCandidate.id,
      sourceHeading: bestCandidate.headingText,
      mappedM11SectionId: spec.id,
      mappedM11Title: spec.title,
      mappingMethod: bestMethod,
      mappingScore: Number(bestScore.toFixed(3)),
      reason: bestSuspiciousReason,
      warnings: [],
    };
    suspiciousMappings.push(record);
    options?.onRejectedMapping?.({
      mappedM11SectionId: spec.id,
      sourceHeading: bestCandidate.headingText,
      reason: bestSuspiciousReason,
    });
    options?.onSuspiciousMapping?.(record);
  }

  const unmappedSourceSections = candidates.filter((candidate) => !usedCandidateIds.has(candidate.id));
  const unmappedM11Sections = specs.filter((spec) => !mappedM11Ids.has(spec.id)).map((spec) => spec.id);

  return {
    mappedSections,
    unmappedSourceSections,
    unmappedM11Sections,
    suspiciousMappings,
    mappingSummary: {
      importedCount: mappedSections.length,
      needsGenerationCount: unmappedM11Sections.length,
      suspiciousCount: suspiciousMappings.length,
      unmappedSourceCount: unmappedSourceSections.length,
    },
  };
}

function emptyStructuralMappingOutput(): StructuralMappingAgentOutput {
  return {
    mappedSections: [],
    unmappedSourceSections: [],
    unmappedM11Sections: [],
    suspiciousMappings: [],
    mappingSummary: {
      importedCount: 0,
      needsGenerationCount: 0,
      suspiciousCount: 0,
      unmappedSourceCount: 0,
    },
  };
}

export function formatMappingMethodLabel(method: MappingMethod): string {
  switch (method) {
    case 'exactNumber':
      return 'exactNumber';
    case 'exactTitle':
      return 'exactTitle';
    case 'normalizedTitle':
      return 'normalizedTitle';
    case 'semanticTitle':
    case 'semantic-similarity':
      return 'semanticTitle';
    case 'contentHeuristic':
    case 'content-context':
      return 'contentHeuristic';
    case 'heading-number':
      return 'exactNumber';
    case 'heading-title':
      return 'exactTitle';
    case 'manual':
      return 'manual';
    default:
      return method;
  }
}

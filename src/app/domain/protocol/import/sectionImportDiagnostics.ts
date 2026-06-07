import type { GenerationAgentOutput } from '../../../agents/generationSchedulingRules';
import type { SectionGenerationState } from '../build/protocolBuildConsoleStore';
import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import {
  getImportGenerationContextDiagnostics,
  getPriorityGenerationContextDiagnostics,
  isPriorityGenerationContextReady,
} from './importGenerationContext';
import { listM11GenerationTargetSectionIds } from './importVisualizationUtils';
import { findRelevantSourceCandidates } from './m11SourceSectionMapping';
import { sectionHasGenerationSource } from './sectionGenerationEligibility';
import {
  getCanonicalDocument,
  getCanonicalDocumentByUploadId,
} from '../../document-ingestion/canonicalDocumentStore';
import { selectBestSimilarityForM11Section } from '../../document-ingestion/canonicalDocumentSelectors';
import type {
  GeneratedSectionDraft,
  ImportContextPhase,
  ImportedProtocolSource,
  MappedProtocolSection,
  SectionGenerationEligibility,
  SectionImportDiagnostics,
  SectionMappingReason,
  SectionMappingStatus,
  SuspiciousMappingRecord,
} from './types';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';

const MIN_IMPORT_CONFIDENCE = 0.45;

export interface BuildSectionImportDiagnosticsInput {
  mappings: MappedProtocolSection[];
  suspiciousMappings: SuspiciousMappingRecord[];
  needsGenerationSectionIds: string[];
  generationSchedule: GenerationAgentOutput;
  importedSource: ImportedProtocolSource | null;
  protocolKnowledgeModel: ProtocolKnowledgeModel | null;
  importContextPhase: ImportContextPhase | undefined;
  sectionDrafts: Record<string, GeneratedSectionDraft>;
  sectionSkipReasons: Record<string, string>;
  sectionGenerationStates: Record<string, SectionGenerationState>;
  generatedSectionIds?: string[];
  queuedSectionIds?: string[];
}

export function classifyMappingReasonFromText(reason: string): SectionMappingReason {
  const lower = reason.toLowerCase();
  if (lower.includes('heading without body') || lower.includes('only a heading') || lower.includes('no body text')) {
    return 'headingOnly';
  }
  if (lower.includes('shorter than') || lower.includes('low quality')) {
    return 'bodyTooShort';
  }
  if (lower.includes('appendix')) {
    return 'appendixMismatch';
  }
  if (lower.includes('table of contents')) {
    return 'tocFragment';
  }
  return 'other';
}

export function mappingReasonLabel(reason: SectionMappingReason): string {
  switch (reason) {
    case 'headingOnly':
      return 'Heading only (no body)';
    case 'bodyTooShort':
      return 'Body too short or low quality';
    case 'appendixMismatch':
      return 'Appendix heading mismatch';
    case 'tocFragment':
      return 'Table of contents fragment';
    case 'lowConfidence':
      return 'Low mapping confidence';
    case 'duplicateMapping':
      return 'Duplicate source mapping';
    case 'noCandidate':
      return 'No source candidate';
    case 'other':
    default:
      return 'Other';
  }
}

export function mappingStatusLabel(status: SectionMappingStatus): string {
  switch (status) {
    case 'mapped':
      return 'Mapped';
    case 'suspicious':
      return 'Suspicious (rejected)';
    case 'rejected':
      return 'Rejected';
    case 'noMatch':
      return 'No match';
    default:
      return status;
  }
}

export function generationEligibilityLabel(eligibility: SectionGenerationEligibility): string {
  switch (eligibility) {
    case 'eligible':
      return 'Eligible';
    case 'waitingForCoreModel':
      return 'Waiting for Core Study Model';
    case 'waitingForKnowledgeLayer':
      return 'Waiting for knowledge layer';
    case 'noSourceContext':
      return 'Insufficient source/context';
    case 'skippedByGenerationAgent':
      return 'Skipped by generation agent';
    case 'alreadyGenerated':
      return 'Already generated or imported';
    case 'other':
    default:
      return 'Other';
  }
}

export function isOrphanSectionGenerationState(state: SectionGenerationState | undefined): boolean {
  return state === 'notGenerated' || state === 'needsGeneration';
}

function resolveSectionTitle(sectionId: string): string {
  return ICH_M11_TEMPLATE_SECTION_SPECS.find((spec) => spec.id === sectionId)?.title ?? sectionId;
}

function findSourceMatch(
  sectionId: string,
  sectionTitle: string,
  importedSource: ImportedProtocolSource | null,
): { foundInSource: boolean; sourceHeadingMatch?: string; bestScore?: number } {
  if (!importedSource) {
    return { foundInSource: false };
  }

  const candidates = findRelevantSourceCandidates(sectionId, sectionTitle, importedSource.sections, 3);
  if (candidates.length === 0) {
    const headingMatch = importedSource.headings.find((heading) => {
      const normalized = heading.text.toLowerCase();
      return normalized.includes('vital signs') || normalized.includes(sectionId);
    });
    if (headingMatch) {
      return { foundInSource: true, sourceHeadingMatch: headingMatch.text, bestScore: 0.3 };
    }
    return { foundInSource: false };
  }

  return {
    foundInSource: true,
    sourceHeadingMatch: candidates[0]?.headingText,
    bestScore: candidates[0]?.confidence,
  };
}

function isDuplicateSourceHeading(
  sourceHeading: string | undefined,
  sectionId: string,
  mappings: MappedProtocolSection[],
): boolean {
  if (!sourceHeading) {
    return false;
  }
  const normalized = sourceHeading.trim().toLowerCase();
  const owners = mappings.filter((entry) => entry.sourceHeading.trim().toLowerCase() === normalized);
  return owners.length > 0 && !owners.some((entry) => entry.mappedM11SectionId === sectionId);
}

function classifyGenerationEligibility(options: {
  skipReason?: string;
  draft?: GeneratedSectionDraft;
  importContextPhase: ImportContextPhase | undefined;
  sectionId: string;
  importedSource: ImportedProtocolSource | null;
  protocolKnowledgeModel: ProtocolKnowledgeModel | null;
}): SectionGenerationEligibility {
  const { skipReason, draft, importContextPhase, sectionId, importedSource, protocolKnowledgeModel } = options;

  if (draft?.generatedText?.trim() && draft.contentOrigin === 'generated' && draft.generationStatus !== 'failed') {
    return 'alreadyGenerated';
  }
  if (draft?.contentOrigin === 'imported' && draft.generatedText?.trim()) {
    return 'alreadyGenerated';
  }

  if (skipReason) {
    if (skipReason.includes('Core Study Model')) {
      return 'waitingForCoreModel';
    }
    if (skipReason.includes('source/context is insufficient')) {
      return 'noSourceContext';
    }
    if (skipReason.includes('imported text') || skipReason.includes('Template instruction')) {
      return 'skippedByGenerationAgent';
    }
    if (skipReason.includes('already has generated') || skipReason.includes('validated or reviewed')) {
      return 'alreadyGenerated';
    }
    if (skipReason.includes('already generating')) {
      return 'other';
    }
    return 'skippedByGenerationAgent';
  }

  if (!isPriorityGenerationContextReady() || importContextPhase === 'extraction' || importContextPhase === 'understanding') {
    return 'waitingForCoreModel';
  }

  if (importContextPhase === 'enriching') {
    const hasSource =
      importedSource &&
      protocolKnowledgeModel &&
      sectionHasGenerationSource(sectionId, importedSource, protocolKnowledgeModel);
    if (!hasSource) {
      return 'waitingForKnowledgeLayer';
    }
  }

  return 'eligible';
}

function resolveCurrentGenerationBlocker(
  sectionId: string,
  eligibility: SectionGenerationEligibility,
  skipReason: string | undefined,
): string {
  if (skipReason) {
    return skipReason;
  }
  if (eligibility === 'waitingForCoreModel') {
    const diagnostics = getPriorityGenerationContextDiagnostics();
    if (diagnostics.missing.length > 0) {
      return `Generation unavailable until Core Study Model is ready (${diagnostics.missing.join(', ')}).`;
    }
    return 'Generation unavailable until Core Study Model is ready.';
  }
  if (eligibility === 'waitingForKnowledgeLayer') {
    const diagnostics = getImportGenerationContextDiagnostics();
    return `Waiting for knowledge layer enrichment (${diagnostics.phase}).`;
  }
  if (eligibility === 'noSourceContext') {
    return 'Not generated because source/context is insufficient.';
  }
  if (eligibility === 'alreadyGenerated') {
    return 'Section already has imported or generated content.';
  }
  if (eligibility === 'eligible') {
    return 'Section is eligible for generation.';
  }
  return `Section ${sectionId} generation blocked (${eligibility}).`;
}

function classifyOrphanInvestigation(input: {
  mapping: Pick<SectionImportDiagnostics, 'mappingStatus' | 'mappingReason' | 'foundInSource'>;
  generationEligibility: SectionGenerationEligibility;
  generationAttempted: boolean;
  generationState?: SectionGenerationState;
  foundInSource: boolean;
  generationSkipReason?: string;
}): Pick<SectionImportDiagnostics, 'orphanClassification' | 'nextRecommendedAction' | 'mappingRejected'> {
  const mappingRejected =
    input.mapping.mappingStatus === 'rejected' || input.mapping.mappingStatus === 'suspicious';

  if (mappingRejected) {
    return {
      mappingRejected: true,
      orphanClassification: 'mappingFailure',
      nextRecommendedAction: 'Review structural mapping and source heading match',
    };
  }

  if (input.generationAttempted && input.generationState === 'failed') {
    return {
      mappingRejected: false,
      orphanClassification: 'generationFailure',
      nextRecommendedAction: 'Retry generation from Protocol Reconstruction Progress',
    };
  }

  if (!input.foundInSource && input.mapping.mappingStatus === 'noMatch') {
    return {
      mappingRejected: false,
      orphanClassification: 'trueMissing',
      nextRecommendedAction: 'Author section manually or verify source protocol coverage',
    };
  }

  if (
    input.generationEligibility === 'alreadyGenerated' &&
    (input.generationState === 'notGenerated' || input.generationState === 'needsGeneration')
  ) {
    return {
      mappingRejected: false,
      orphanClassification: 'staleState',
      nextRecommendedAction: 'Reset import workspace or re-import protocol to refresh section state',
    };
  }

  if (input.generationEligibility === 'skippedByGenerationAgent' || input.generationEligibility === 'noSourceContext') {
    return {
      mappingRejected: false,
      orphanClassification: input.foundInSource ? 'generationFailure' : 'trueMissing',
      nextRecommendedAction: input.generationSkipReason ?? 'Review generation eligibility in import diagnostics',
    };
  }

  return {
    mappingRejected: false,
    orphanClassification: 'unknown',
    nextRecommendedAction: 'Inspect import diagnostics for mapping and generation blockers',
  };
}

function buildDiagnosticSummary(diagnostics: Omit<SectionImportDiagnostics, 'diagnosticSummary'>): string {
  const parts: string[] = [];
  parts.push(`Mapping: ${mappingStatusLabel(diagnostics.mappingStatus)} (${mappingReasonLabel(diagnostics.mappingReason)})`);
  if (diagnostics.mappingDetail) {
    parts.push(diagnostics.mappingDetail);
  }
  if (diagnostics.foundInSource && diagnostics.sourceHeadingMatch) {
    parts.push(`Source heading: "${diagnostics.sourceHeadingMatch}"`);
  } else if (!diagnostics.foundInSource) {
    parts.push('No matching source heading found');
  }
  parts.push(`Generation: ${generationEligibilityLabel(diagnostics.generationEligibility)}`);
  if (diagnostics.generationSkipReason) {
    parts.push(diagnostics.generationSkipReason);
  }
  if (diagnostics.generationAttempted) {
    parts.push('Generation was attempted during import');
  } else if (isOrphanSectionGenerationState(diagnostics.generationState as SectionGenerationState)) {
    parts.push('Generation was not attempted during import');
  }
  return parts.join(' · ');
}

function resolveMappingDiagnostics(
  sectionId: string,
  sectionTitle: string,
  mappings: MappedProtocolSection[],
  suspiciousMappings: SuspiciousMappingRecord[],
  importedSource: ImportedProtocolSource | null,
): Pick<
  SectionImportDiagnostics,
  'foundInSource' | 'sourceHeadingMatch' | 'mappingStatus' | 'mappingReason' | 'mappingDetail' | 'mappingScore'
> {
  const mapping = mappings.find((entry) => entry.mappedM11SectionId === sectionId);
  if (mapping) {
    return {
      foundInSource: true,
      sourceHeadingMatch: mapping.sourceHeading,
      mappingStatus: 'mapped',
      mappingReason: 'other',
      mappingDetail: `Mapped via ${mapping.mappingMethod} (${Math.round(mapping.mappingConfidence * 100)}% confidence)`,
      mappingScore: mapping.mappingConfidence,
    };
  }

  const suspicious = suspiciousMappings.find((entry) => entry.mappedM11SectionId === sectionId);
  if (suspicious) {
    const duplicate = isDuplicateSourceHeading(suspicious.sourceHeading, sectionId, mappings);
    return {
      foundInSource: true,
      sourceHeadingMatch: suspicious.sourceHeading,
      mappingStatus: 'suspicious',
      mappingReason: duplicate ? 'duplicateMapping' : classifyMappingReasonFromText(suspicious.reason),
      mappingDetail: suspicious.reason,
      mappingScore: suspicious.mappingScore,
    };
  }

  const sourceMatch = findSourceMatch(sectionId, sectionTitle, importedSource);
  if (sourceMatch.foundInSource) {
    const score = sourceMatch.bestScore ?? 0;
    if (score > 0 && score < MIN_IMPORT_CONFIDENCE) {
      return {
        foundInSource: true,
        sourceHeadingMatch: sourceMatch.sourceHeadingMatch,
        mappingStatus: 'noMatch',
        mappingReason: 'lowConfidence',
        mappingDetail: `Best source candidate below confidence threshold (${score.toFixed(2)} < ${MIN_IMPORT_CONFIDENCE})`,
        mappingScore: score,
      };
    }
    if (isDuplicateSourceHeading(sourceMatch.sourceHeadingMatch, sectionId, mappings)) {
      return {
        foundInSource: true,
        sourceHeadingMatch: sourceMatch.sourceHeadingMatch,
        mappingStatus: 'rejected',
        mappingReason: 'duplicateMapping',
        mappingDetail: 'Source heading already mapped to another M11 section',
        mappingScore: score,
      };
    }
    return {
      foundInSource: true,
      sourceHeadingMatch: sourceMatch.sourceHeadingMatch,
      mappingStatus: 'noMatch',
      mappingReason: 'other',
      mappingDetail: 'Source heading present but structural mapping did not assign content',
      mappingScore: score,
    };
  }

  return {
    foundInSource: false,
    mappingStatus: 'noMatch',
    mappingReason: 'noCandidate',
    mappingDetail: 'No source section candidate matched this M11 section',
  };
}

function enrichWithCanonicalDiagnostics(
  sectionId: string,
  sectionTitle: string,
  importedSource: ImportedProtocolSource | null,
  mapping: Pick<SectionImportDiagnostics, 'sourceHeadingMatch'>,
): Pick<
  SectionImportDiagnostics,
  | 'canonicalSectionId'
  | 'canonicalHeadingLevel'
  | 'canonicalBlockCount'
  | 'mappingSimilarityScore'
  | 'mappingSimilarityReasons'
> {
  const canonicalDocument =
    getCanonicalDocument(importedSource?.canonicalDocumentId) ??
    getCanonicalDocumentByUploadId(importedSource?.uploadId);

  if (!canonicalDocument) {
    return {};
  }

  const similarity = selectBestSimilarityForM11Section(canonicalDocument, sectionId, sectionTitle);
  const canonicalSection =
    (similarity ? canonicalDocument.sections.find((section) => section.id === similarity.canonicalSectionId) : null) ??
    (mapping.sourceHeadingMatch
      ? canonicalDocument.sections.find(
          (section) => section.title.trim().toLowerCase() === mapping.sourceHeadingMatch!.trim().toLowerCase(),
        )
      : null);

  return {
    canonicalSectionId: canonicalSection?.id ?? similarity?.canonicalSectionId,
    canonicalHeadingLevel: canonicalSection?.headingLevel,
    canonicalBlockCount: canonicalSection?.blockIds.length,
    mappingSimilarityScore: similarity?.score,
    mappingSimilarityReasons: similarity?.reasons,
  };
}

export function buildSectionImportDiagnosticsForSection(
  sectionId: string,
  input: BuildSectionImportDiagnosticsInput,
): SectionImportDiagnostics {
  const sectionTitle = resolveSectionTitle(sectionId);
  const generationState = input.sectionGenerationStates[sectionId];
  const draft = input.sectionDrafts[sectionId];
  const skipped = input.generationSchedule.skippedSections.find((entry) => entry.sectionId === sectionId);
  const skipReason = input.sectionSkipReasons[sectionId] ?? skipped?.reason;
  const queued =
    input.generationSchedule.prioritizedSections.includes(sectionId) ||
    input.generationSchedule.backgroundSections.includes(sectionId) ||
    (input.queuedSectionIds?.includes(sectionId) ?? false);
  const generated = input.generatedSectionIds?.includes(sectionId) ?? false;

  const mapping = resolveMappingDiagnostics(
    sectionId,
    sectionTitle,
    input.mappings,
    input.suspiciousMappings,
    input.importedSource,
  );

  const generationEligibility = classifyGenerationEligibility({
    skipReason,
    draft,
    importContextPhase: input.importContextPhase,
    sectionId,
    importedSource: input.importedSource,
    protocolKnowledgeModel: input.protocolKnowledgeModel,
  });

  const generationAttempted = generated || (queued && !skipped);
  const generationSkipReason = resolveCurrentGenerationBlocker(sectionId, generationEligibility, skipReason);
  const canonicalFields = enrichWithCanonicalDiagnostics(sectionId, sectionTitle, input.importedSource, mapping);
  const orphanMeta = classifyOrphanInvestigation({
    mapping,
    generationEligibility,
    generationAttempted,
    generationState,
    foundInSource: mapping.foundInSource,
    generationSkipReason,
  });

  const base: Omit<SectionImportDiagnostics, 'diagnosticSummary'> = {
    sectionId,
    sectionTitle,
    capturedAt: new Date().toISOString(),
    generationState,
    ...mapping,
    ...canonicalFields,
    generationAttempted,
    generationEligibility,
    generationSkipReason,
    ...orphanMeta,
  };

  return {
    ...base,
    diagnosticSummary: buildDiagnosticSummary(base),
  };
}

export function buildSectionImportDiagnosticsSnapshot(
  input: BuildSectionImportDiagnosticsInput,
): Record<string, SectionImportDiagnostics> {
  const targetIds = listM11GenerationTargetSectionIds();
  const orphanIds = new Set<string>();

  for (const sectionId of targetIds) {
    const state = input.sectionGenerationStates[sectionId];
    if (isOrphanSectionGenerationState(state)) {
      orphanIds.add(sectionId);
    }
  }

  for (const sectionId of input.needsGenerationSectionIds) {
    orphanIds.add(sectionId);
  }

  for (const entry of input.generationSchedule.skippedSections) {
    orphanIds.add(entry.sectionId);
  }

  const snapshot: Record<string, SectionImportDiagnostics> = {};
  for (const sectionId of orphanIds) {
    snapshot[sectionId] = buildSectionImportDiagnosticsForSection(sectionId, input);
  }

  return snapshot;
}

export function resolveSectionImportDiagnostics(
  sectionId: string,
  persisted: Record<string, SectionImportDiagnostics> | undefined,
  liveInput?: Partial<BuildSectionImportDiagnosticsInput>,
): SectionImportDiagnostics | null {
  const persistedEntry = persisted?.[sectionId];
  if (!liveInput) {
    return persistedEntry ?? null;
  }

  const mergedInput: BuildSectionImportDiagnosticsInput = {
    mappings: liveInput.mappings ?? [],
    suspiciousMappings: liveInput.suspiciousMappings ?? [],
    needsGenerationSectionIds: liveInput.needsGenerationSectionIds ?? [],
    generationSchedule: liveInput.generationSchedule ?? {
      queue: [],
      skippedSections: [],
      prioritizedSections: [],
      backgroundSections: [],
      generationSummary: {
        queuedCount: 0,
        skippedCount: 0,
        priorityCount: 0,
        backgroundCount: 0,
        immediateCount: 0,
        status: 'skipped',
      },
      reasons: [],
    },
    importedSource: liveInput.importedSource ?? null,
    protocolKnowledgeModel: liveInput.protocolKnowledgeModel ?? null,
    importContextPhase: liveInput.importContextPhase,
    sectionDrafts: liveInput.sectionDrafts ?? {},
    sectionSkipReasons: liveInput.sectionSkipReasons ?? {},
    sectionGenerationStates: liveInput.sectionGenerationStates ?? {},
    generatedSectionIds: liveInput.generatedSectionIds,
    queuedSectionIds: liveInput.queuedSectionIds,
  };

  const live = buildSectionImportDiagnosticsForSection(sectionId, mergedInput);
  if (!persistedEntry) {
    return live;
  }

  return {
    ...persistedEntry,
    ...live,
    capturedAt: persistedEntry.capturedAt,
    diagnosticSummary: live.diagnosticSummary,
  };
}

export function formatImportDiagnosticsTooltip(diagnostics: SectionImportDiagnostics): string[] {
  return [
    `Mapping: ${mappingStatusLabel(diagnostics.mappingStatus)} (${mappingReasonLabel(diagnostics.mappingReason)})`,
    diagnostics.mappingDetail ? `Mapping detail: ${diagnostics.mappingDetail}` : null,
    diagnostics.foundInSource
      ? `Source: "${diagnostics.sourceHeadingMatch ?? 'heading detected'}"`
      : 'Source: not found in protocol',
    `Generation: ${generationEligibilityLabel(diagnostics.generationEligibility)}`,
    diagnostics.generationAttempted ? 'Import generation: attempted' : 'Import generation: not attempted',
    diagnostics.generationSkipReason ? `Blocker: ${diagnostics.generationSkipReason}` : null,
    diagnostics.orphanClassification ? `Orphan class: ${diagnostics.orphanClassification}` : null,
    diagnostics.nextRecommendedAction ? `Next: ${diagnostics.nextRecommendedAction}` : null,
    diagnostics.diagnosticSummary,
  ].filter((line): line is string => Boolean(line));
}

export function emitOrphanImportDiagnosticEvents(
  snapshot: Record<string, SectionImportDiagnostics>,
  appendEvent: (event: {
    type: 'info' | 'warning';
    message: string;
    sectionId?: string;
    sectionTitle?: string;
    metadata?: Record<string, string | number | boolean>;
  }) => void,
): void {
  for (const diagnostics of Object.values(snapshot)) {
    appendEvent({
      type: diagnostics.mappingStatus === 'mapped' ? 'info' : 'warning',
      message: `Import diagnostic · ${diagnostics.sectionId}: ${diagnostics.diagnosticSummary}`,
      sectionId: diagnostics.sectionId,
      sectionTitle: diagnostics.sectionTitle,
      metadata: {
        mappingStatus: diagnostics.mappingStatus,
        mappingReason: diagnostics.mappingReason,
        generationEligibility: diagnostics.generationEligibility,
        foundInSource: diagnostics.foundInSource,
        generationAttempted: diagnostics.generationAttempted,
      },
    });
  }
}

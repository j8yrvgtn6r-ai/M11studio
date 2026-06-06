import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../domain/protocol/ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../domain/protocol/ichM11/types';
import type { CoreStudyModel } from '../domain/protocol/import/coreStudyModel';
import { listM11GenerationTargetSectionIds } from '../domain/protocol/import/importVisualizationUtils';
import { sectionHasGenerationSource } from '../domain/protocol/import/sectionGenerationEligibility';
import {
  isQuickReconstructionSection,
  QUICK_RECONSTRUCTION_SECTION_IDS,
} from '../domain/protocol/import/quickReconstructionSections';
import type {
  GeneratedSectionDraft,
  ImportedProtocolSource,
  MappedProtocolSection,
} from '../domain/protocol/import/types';
import type { ProtocolKnowledgeModel } from '../domain/protocol/import/protocolKnowledgeTypes';
import { isTemplateInstructionNode } from '../domain/protocol/selectors/sectionVisibility';
import type { ProtocolDocument } from '../domain/protocol/types';
import type { StudyModel } from '../domain/study-model/studyModelTypes';

export type GenerationAgentTrigger =
  | 'import'
  | 'generateRemaining'
  | 'generateSection'
  | 'retryFailed'
  | 'outOfSync'
  | 'background'
  | 'manual';

export type GenerationQueuePriority = 'immediate' | 'high' | 'normal' | 'low' | 'background';

export type GenerationQueueSource =
  | 'missing'
  | 'needsGeneration'
  | 'outOfSync'
  | 'failedRetry'
  | 'manual'
  | 'background';

export type EstimatedComplexity = 'low' | 'medium' | 'high';

export interface GenerationQueueItem {
  sectionId: string;
  sectionTitle: string;
  priority: GenerationQueuePriority;
  reason: string;
  source: GenerationQueueSource;
  estimatedComplexity: EstimatedComplexity;
  requiredContext: string[];
  canGenerateNow: boolean;
  skipReason?: string;
}

export interface SkippedSectionRecord {
  sectionId: string;
  sectionTitle: string;
  reason: string;
}

export interface GenerationAgentInput {
  protocolDocument?: ProtocolDocument;
  m11TemplateSections?: IchM11SectionSpec[];
  sectionDrafts: Record<string, GeneratedSectionDraft>;
  mappedSections?: MappedProtocolSection[];
  studyModel?: StudyModel | null;
  coreStudyModel?: CoreStudyModel | null;
  generationContext?: {
    ready: boolean;
    phase?: string;
    missing?: string[];
  };
  trigger: GenerationAgentTrigger;
  requestedSectionId?: string;
  failedSectionIds?: string[];
  outOfSyncSectionIds?: string[];
  needsGenerationSectionIds?: string[];
  importedSource?: ImportedProtocolSource | null;
  protocolKnowledgeModel?: ProtocolKnowledgeModel | null;
  activeGeneratingSectionIds?: string[];
}

export interface GenerationAgentOutput {
  queue: GenerationQueueItem[];
  skippedSections: SkippedSectionRecord[];
  prioritizedSections: string[];
  backgroundSections: string[];
  generationSummary: {
    queuedCount: number;
    skippedCount: number;
    priorityCount: number;
    backgroundCount: number;
    immediateCount: number;
    status: 'success' | 'partial' | 'skipped' | 'failed';
  };
  reasons: string[];
}

const PRIORITY_RANK: Record<GenerationQueuePriority, number> = {
  immediate: 0,
  high: 1,
  normal: 2,
  low: 3,
  background: 4,
};

function getSpec(sectionId: string, specs: IchM11SectionSpec[]): IchM11SectionSpec | undefined {
  return specs.find((spec) => spec.id === sectionId);
}

function isInstructionSection(sectionId: string, spec?: IchM11SectionSpec): boolean {
  if (isTemplateInstructionNode(sectionId)) {
    return true;
  }
  return spec?.sectionType === 'template-instruction';
}

function isImportedUnvalidatedDraft(draft: GeneratedSectionDraft | undefined): boolean {
  if (!draft) {
    return false;
  }
  if (draft.workflowState === 'importedUnvalidated' || draft.workflowState === 'imported') {
    return true;
  }
  return draft.contentOrigin === 'imported' && !draft.validatedTargetText && draft.workflowState !== 'validated';
}

function isValidatedOrReviewedDraft(draft: GeneratedSectionDraft | undefined): boolean {
  if (!draft || draft.generationStatus === 'failed') {
    return false;
  }
  return (
    draft.workflowState === 'validated' ||
    draft.workflowState === 'reviewed' ||
    draft.state === 'validationPassed' ||
    draft.state === 'approved'
  );
}

function isSuccessfulDraft(draft: GeneratedSectionDraft | undefined): boolean {
  return Boolean(draft && draft.generationStatus !== 'failed' && draft.generatedText.trim());
}

function listRequiredContext(
  sectionId: string,
  spec: IchM11SectionSpec | undefined,
  input: GenerationAgentInput,
): string[] {
  const required: string[] = [];
  if (!input.generationContext?.ready) {
    required.push('Core Study Model');
  }
  if (!input.importedSource) {
    required.push('Source extraction');
  }
  if (!input.protocolKnowledgeModel && !input.coreStudyModel) {
    required.push('Protocol knowledge model');
  }
  if (
    spec &&
    input.importedSource &&
    input.protocolKnowledgeModel &&
    !sectionHasGenerationSource(sectionId, input.importedSource, input.protocolKnowledgeModel) &&
    !isQuickReconstructionSection(sectionId)
  ) {
    required.push('Source mapping or study model context');
  }
  return required;
}

export function estimateSectionComplexity(
  sectionId: string,
  spec: IchM11SectionSpec | undefined,
  draft: GeneratedSectionDraft | undefined,
  hasSourceContext: boolean,
): EstimatedComplexity {
  if (
    sectionId.startsWith('10') ||
    sectionId.startsWith('3.1') ||
    spec?.metadata?.viewKind === 'schedule-of-activities' ||
    sectionId === '1.3'
  ) {
    return 'high';
  }
  if (sectionId.startsWith('6') || sectionId.startsWith('8') || sectionId.startsWith('9')) {
    return 'medium';
  }
  if (hasSourceContext || draft?.matchedSourceCandidateIds?.length) {
    return 'low';
  }
  if (isQuickReconstructionSection(sectionId)) {
    return 'medium';
  }
  return 'medium';
}

function buildQueueItem(
  sectionId: string,
  input: GenerationAgentInput,
  options: {
    priority: GenerationQueuePriority;
    reason: string;
    source: GenerationQueueSource;
    forceGenerate?: boolean;
  },
): GenerationQueueItem {
  const specs = input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS;
  const spec = getSpec(sectionId, specs);
  const draft = input.sectionDrafts[sectionId];
  const title = spec?.title ?? draft?.title ?? sectionId;
  const hasSourceContext = Boolean(
    input.importedSource &&
      input.protocolKnowledgeModel &&
      sectionHasGenerationSource(sectionId, input.importedSource, input.protocolKnowledgeModel),
  );
  const requiredContext = listRequiredContext(sectionId, spec, input);
  const complexity = estimateSectionComplexity(sectionId, spec, draft, hasSourceContext);

  let skipReason: string | undefined;
  if (isInstructionSection(sectionId, spec)) {
    skipReason = 'Template instruction or Foreword section is not generated.';
  } else if (input.activeGeneratingSectionIds?.includes(sectionId)) {
    skipReason = 'Section is already generating.';
  } else if (isImportedUnvalidatedDraft(draft)) {
    skipReason = 'Section contains imported text — validate instead of generating.';
  } else if (
    isValidatedOrReviewedDraft(draft) &&
    !input.outOfSyncSectionIds?.includes(sectionId) &&
    input.trigger !== 'generateSection' &&
    input.trigger !== 'manual'
  ) {
    skipReason = 'Section is validated or reviewed.';
  } else if (isSuccessfulDraft(draft) && input.trigger !== 'generateSection' && input.trigger !== 'retryFailed') {
    skipReason = 'Section already has generated content.';
  } else if (!input.generationContext?.ready && !options.forceGenerate) {
    skipReason = 'Cannot generate yet because Core Study Model is not ready.';
  } else if (
    options.priority === 'background' &&
    !hasSourceContext &&
    !isQuickReconstructionSection(sectionId) &&
    input.trigger !== 'generateSection'
  ) {
    skipReason = 'Not generated because source/context is insufficient.';
  }

  const canGenerateNow = !skipReason || options.forceGenerate === true;

  return {
    sectionId,
    sectionTitle: title,
    priority: options.priority,
    reason: options.reason,
    source: options.source,
    estimatedComplexity: complexity,
    requiredContext,
    canGenerateNow,
    skipReason: canGenerateNow ? undefined : skipReason,
  };
}

function candidateSectionIds(input: GenerationAgentInput): string[] {
  const targets = listM11GenerationTargetSectionIds(
    (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).map((spec) => spec.id),
  );

  switch (input.trigger) {
    case 'generateSection':
      return input.requestedSectionId ? [input.requestedSectionId] : [];
    case 'retryFailed':
      return (input.failedSectionIds ?? []).filter((sectionId) => targets.includes(sectionId));
    case 'outOfSync':
      return (input.outOfSyncSectionIds ?? []).filter((sectionId) => targets.includes(sectionId));
    case 'import':
      return (input.needsGenerationSectionIds ?? []).filter((sectionId) => targets.includes(sectionId));
    case 'generateRemaining':
    case 'background':
    case 'manual':
    default:
      return targets.filter((sectionId) => {
        const draft = input.sectionDrafts[sectionId];
        return !draft || draft.generationStatus === 'failed';
      });
  }
}

function resolveItemOptions(
  sectionId: string,
  input: GenerationAgentInput,
): { priority: GenerationQueuePriority; reason: string; source: GenerationQueueSource; forceGenerate?: boolean } {
  if (input.trigger === 'generateSection' && input.requestedSectionId === sectionId) {
    return {
      priority: 'immediate',
      reason: 'Manual Generate Section request',
      source: 'manual',
    };
  }

  if (input.trigger === 'retryFailed' && input.failedSectionIds?.includes(sectionId)) {
    return {
      priority: 'high',
      reason: 'Retry failed section generation',
      source: 'failedRetry',
    };
  }

  if (input.trigger === 'outOfSync' && input.outOfSyncSectionIds?.includes(sectionId)) {
    return {
      priority: 'high',
      reason: 'Out-of-sync section regeneration requested',
      source: 'outOfSync',
    };
  }

  if (input.needsGenerationSectionIds?.includes(sectionId) || input.trigger === 'import') {
    if (isQuickReconstructionSection(sectionId)) {
      return {
        priority: 'high',
        reason: 'Priority missing M11 section after structural mapping',
        source: 'needsGeneration',
      };
    }
    return {
      priority: 'background',
      reason: 'Background generation for mapped-missing section with sufficient context',
      source: 'background',
    };
  }

  if (isQuickReconstructionSection(sectionId)) {
    return {
      priority: 'high',
      reason: 'Priority missing M11 section',
      source: 'missing',
    };
  }

  const hasSourceContext = Boolean(
    input.importedSource &&
      input.protocolKnowledgeModel &&
      sectionHasGenerationSource(sectionId, input.importedSource, input.protocolKnowledgeModel),
  );

  if (hasSourceContext) {
    return {
      priority: 'low',
      reason: 'Background generation with available source/context',
      source: 'background',
    };
  }

  return {
    priority: 'normal',
    reason: 'Remaining authorable M11 section',
    source: 'missing',
  };
}

function dedupeQueue(items: GenerationQueueItem[]): GenerationQueueItem[] {
  const byId = new Map<string, GenerationQueueItem>();
  for (const item of items) {
    const existing = byId.get(item.sectionId);
    if (!existing || PRIORITY_RANK[item.priority] < PRIORITY_RANK[existing.priority]) {
      byId.set(item.sectionId, item);
    }
  }
  return [...byId.values()].sort((left, right) => {
    const rank = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (rank !== 0) {
      return rank;
    }
    const complexityRank =
      (left.estimatedComplexity === 'low' ? 0 : left.estimatedComplexity === 'medium' ? 1 : 2) -
      (right.estimatedComplexity === 'low' ? 0 : right.estimatedComplexity === 'medium' ? 1 : 2);
    return complexityRank;
  });
}

export function evaluateGenerationSchedule(input: GenerationAgentInput): GenerationAgentOutput {
  if (!input.m11TemplateSections?.length && ICH_M11_TEMPLATE_SECTION_SPECS.length === 0) {
    return emptyGenerationOutput('failed', ['M11 template sections unavailable']);
  }

  const specs = input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS;
  const normalizedInput = { ...input, m11TemplateSections: specs };
  const candidates = candidateSectionIds(normalizedInput);
  const mappedIds = new Set((input.mappedSections ?? []).map((entry) => entry.mappedM11SectionId));

  const rawItems = candidates
    .filter((sectionId) => !mappedIds.has(sectionId) || input.trigger === 'generateSection')
    .map((sectionId) => buildQueueItem(sectionId, normalizedInput, resolveItemOptions(sectionId, normalizedInput)));

  const queue = dedupeQueue(rawItems.filter((item) => item.canGenerateNow));
  const skippedSections = rawItems
    .filter((item) => !item.canGenerateNow)
    .map((item) => ({
      sectionId: item.sectionId,
      sectionTitle: item.sectionTitle,
      reason: item.skipReason ?? 'Skipped by generation policy',
    }));

  const dedupedSkipped = [...new Map(skippedSections.map((entry) => [entry.sectionId, entry])).values()];
  const prioritizedSections = queue
    .filter((item) => item.priority === 'immediate' || item.priority === 'high')
    .map((item) => item.sectionId);
  const backgroundSections = queue
    .filter((item) => item.priority === 'background' || item.priority === 'low')
    .map((item) => item.sectionId);

  const reasons = [
    ...queue.slice(0, 5).map((item) => `${item.sectionId}: ${item.reason}`),
    ...dedupedSkipped.slice(0, 5).map((item) => `Skipped ${item.sectionId}: ${item.reason}`),
  ];

  return {
    queue,
    skippedSections: dedupedSkipped,
    prioritizedSections,
    backgroundSections,
    generationSummary: {
      queuedCount: queue.length,
      skippedCount: dedupedSkipped.length,
      priorityCount: prioritizedSections.length,
      backgroundCount: backgroundSections.length,
      immediateCount: queue.filter((item) => item.priority === 'immediate').length,
      status:
        queue.length === 0 && dedupedSkipped.length > 0
          ? 'skipped'
          : queue.length > 0 && dedupedSkipped.length > 0
            ? 'partial'
            : queue.length > 0
              ? 'success'
              : 'skipped',
    },
    reasons,
  };
}

function emptyGenerationOutput(
  status: GenerationAgentOutput['generationSummary']['status'],
  reasons: string[],
): GenerationAgentOutput {
  return {
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
      status,
    },
    reasons,
  };
}

export function getPrioritySectionIdsForScheduling(): string[] {
  return [...QUICK_RECONSTRUCTION_SECTION_IDS];
}

export function resolveQueueTypeLabel(
  trigger: GenerationAgentTrigger,
  output: GenerationAgentOutput,
): string {
  if (trigger === 'generateSection') {
    return 'Manual Section';
  }
  if (trigger === 'retryFailed') {
    return 'Retry Failed';
  }
  if (output.generationSummary.immediateCount > 0) {
    return 'Manual Section';
  }
  if (output.generationSummary.priorityCount > 0) {
    return 'Priority Drafts';
  }
  if (output.generationSummary.backgroundCount > 0) {
    return 'Background Drafts';
  }
  return 'Scheduling';
}

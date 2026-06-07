import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../../ichM11/ichM11Template';
import {
  appendProtocolBuildEvent,
  initializeSectionGenerationQueue,
  injectSectionIntoGenerationQueue,
  isProtocolBuildPauseRequested,
  markProtocolBuildPaused,
  prependSectionGenerationPriority,
  pullInjectedSectionGenerationId,
  pullPrioritySectionGenerationId,
  hasPendingInjectedSections,
  updateSectionGenerationState,
  waitForProtocolBuildResume,
} from '../../build/protocolBuildConsoleStore';
import type { IchM11SectionSpec } from '../../ichM11/types';
import { transitionSectionState } from '../sectionReviewStateMachine';
import type { GeneratedSectionDraft, SectionGenerationProvenance } from '../types';
import { generateFixtureSectionDraft, regenerateFixtureM11Section } from './fixtureGeneration';
import { resolveLlmProviderConfig } from './llmConfig';
import { callOpenAiChat } from './openAiClient';
import {
  enrichGenerationProgressSnapshot,
  logM11Generation,
  providerProgressMeta,
  type M11GenerationCallbacks,
  type M11GenerationProgressSnapshot,
} from './m11GenerationProgress';
import { formatLlmUserError, ImportProcessingAbortedError, throwIfAborted } from './llmRequestTimeouts';
import { parseLlmJson } from './parseLlmJson';
import type { M11GenerationInput, M11GenerationProvider } from './types';
import { GENERATION_PROMPT_VERSION } from './types';
import { getGenerationGuidancePayload } from '../../../m11-template-guidance';

function shouldGenerate(spec: IchM11SectionSpec): boolean {
  if (spec.sectionType === 'template-instruction') return false;
  if (spec.id === '0' || spec.id.startsWith('0.')) return false;
  return true;
}

function truncate(text: string, max = 6000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[truncated]`;
}

function listTargetSpecs(input: M11GenerationInput): IchM11SectionSpec[] {
  const specs = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).filter(shouldGenerate);
  const filterIds = input.sectionIds ? new Set(input.sectionIds) : null;
  return specs.filter((spec) => !filterIds || filterIds.has(spec.id));
}

function emitProgress(
  callbacks: M11GenerationCallbacks | undefined,
  snapshot: M11GenerationProgressSnapshot,
  sectionDurations: number[],
): void {
  callbacks?.onProgress?.(enrichGenerationProgressSnapshot(snapshot, sectionDurations));
}

function createFailedSectionDraft(
  spec: IchM11SectionSpec,
  input: M11GenerationInput,
  draftVersion: number,
  providerId: SectionGenerationProvenance['generationProvider'],
  model: string,
  errorMessage: string,
): GeneratedSectionDraft {
  const generatedAt = new Date().toISOString();
  const provenance: SectionGenerationProvenance = {
    generationProvider: providerId,
    generationModel: model,
    generationTimestamp: generatedAt,
    generationPromptVersion: GENERATION_PROMPT_VERSION,
    sourceUploadId: input.artifact.id,
    knowledgeModelId: input.protocolKnowledgeModel.id,
    sourceCandidateIds: [],
    confidence: input.protocolKnowledgeModel.confidence,
    generationNotes: [`Generation failed: ${errorMessage}`],
    knowledgeElementsUsed: [],
    draftVersion,
  };

  return {
    sectionId: spec.id,
    title: spec.title,
    generatedText: '',
    sourceUploadId: input.artifact.id,
    sourceExtractionId: input.sourceExtraction.uploadId,
    knowledgeModelId: input.protocolKnowledgeModel.id,
    matchedSourceCandidateIds: [],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'failed',
    generationProvider: providerId,
    provenance,
    draftVersion,
    state: 'validationFailed',
    stateChangedAt: generatedAt,
    stateChangedBy: `${providerId}-generation-provider`,
    stateHistory: [
      {
        state: 'validationFailed',
        changedAt: generatedAt,
        changedBy: `${providerId}-generation-provider`,
        note: errorMessage,
      },
    ],
    generatedAt,
    validationStatus: 'failed',
    validationMessages: [errorMessage],
    validationFindings: [],
  };
}

async function generateOpenAiSectionDraft(
  spec: IchM11SectionSpec,
  input: M11GenerationInput,
  draftVersion: number,
  providerId: SectionGenerationProvenance['generationProvider'],
  callbacks?: M11GenerationCallbacks,
): Promise<GeneratedSectionDraft> {
  const config = resolveLlmProviderConfig();
  const techSpec = input.m11TechnicalSpecification.find((s) => s.id === spec.id);
  const sectionGuidance = getGenerationGuidancePayload(spec.id);

  const result = await callOpenAiChat(
    config,
    [
      {
        role: 'system',
        content:
          'You reconstruct clinical protocol content into ICH M11 template sections from global study understanding. ' +
          'Do not perform section-to-section translation. Write proposal narrative for human review. Return JSON only.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'm11_section_reconstruction',
          promptVersion: GENERATION_PROMPT_VERSION,
          m11Section: { id: spec.id, title: spec.title, conformance: spec.conformance },
          sectionGuidance,
          technicalSpec: techSpec?.description ?? techSpec?.title,
          protocolKnowledgeModel: input.protocolKnowledgeModel,
          fullProtocolContext: truncate(input.sourceExtraction.fullText),
          controlledTerminology: input.controlledTerminology,
          outputSchema: {
            generatedText: 'string — M11 section proposal narrative',
            knowledgeElementsUsed: 'string[]',
            sourceCandidateIds: 'string[] — reference only, not mapping',
            confidence: 'number 0-1',
            generationNotes: 'string[]',
          },
        }),
      },
    ],
    {
      jsonMode: true,
      temperature: 0.25,
      signal: callbacks?.signal,
      operation: draftVersion > 1 ? 'sectionRegeneration' : 'sectionGeneration',
    },
  );

  const parsed = parseLlmJson<{
    generatedText: string;
    knowledgeElementsUsed?: string[];
    sourceCandidateIds?: string[];
    confidence?: number;
    generationNotes?: string[];
  }>(result.content);

  const generatedAt = new Date().toISOString();
  const provenance: SectionGenerationProvenance = {
    generationProvider: providerId,
    generationModel: result.model,
    generationTimestamp: generatedAt,
    generationPromptVersion: GENERATION_PROMPT_VERSION,
    sourceUploadId: input.artifact.id,
    knowledgeModelId: input.protocolKnowledgeModel.id,
    sourceCandidateIds: parsed.sourceCandidateIds ?? [],
    confidence: parsed.confidence ?? input.protocolKnowledgeModel.confidence,
    generationNotes: parsed.generationNotes ?? ['LLM M11 section reconstruction'],
    knowledgeElementsUsed: parsed.knowledgeElementsUsed ?? [],
    draftVersion,
  };

  const draft: GeneratedSectionDraft = {
    sectionId: spec.id,
    title: spec.title,
    generatedText: parsed.generatedText,
    sourceUploadId: input.artifact.id,
    sourceExtractionId: input.sourceExtraction.uploadId,
    knowledgeModelId: input.protocolKnowledgeModel.id,
    matchedSourceCandidateIds: provenance.sourceCandidateIds,
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: providerId,
    provenance,
    draftVersion,
    state: 'generated',
    stateChangedAt: generatedAt,
    stateChangedBy: `${providerId}-generation-provider`,
    stateHistory: [],
    generatedAt,
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
  };

  return transitionSectionState(draft, 'importGenerated', `${providerId}-generation-provider`, 'LLM M11 draft generated');
}

async function generateSectionsWithProgress(
  input: M11GenerationInput,
  generateOne: (
    spec: IchM11SectionSpec,
    draftVersion: number,
  ) => Promise<GeneratedSectionDraft>,
  callbacks?: M11GenerationCallbacks,
  providerId: SectionGenerationProvenance['generationProvider'] = 'openai',
): Promise<GeneratedSectionDraft[]> {
  const specs = listTargetSpecs(input);
  const config = resolveLlmProviderConfig();
  const { providerLabel, model } = providerProgressMeta(config);
  const startedAt = performance.now();
  let completedSections = 0;
  let failedSections = 0;
  const sectionDurations: number[] = [];

  logM11Generation('generation-started', {
    totalSections: specs.length,
    provider: providerLabel,
    model,
  });

  initializeSectionGenerationQueue(specs.map((spec) => spec.id));
  appendProtocolBuildEvent({
    type: 'progress',
    message: `Generating ${specs.length} M11 section draft${specs.length === 1 ? '' : 's'}`,
    provider: providerLabel,
    model,
    metadata: { totalSections: specs.length },
  });

  const initialProgress: M11GenerationProgressSnapshot = {
    totalSections: specs.length,
    completedSections: 0,
    failedSections: 0,
    elapsedMs: 0,
    providerLabel,
    model,
  };
  emitProgress(callbacks, initialProgress, sectionDurations);

  const drafts: GeneratedSectionDraft[] = [];
  const specById = new Map(specs.map((spec) => [spec.id, spec]));
  const pendingIds = specs.map((spec) => spec.id);
  const allTemplateSpecs = input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS;

  const drainInjectedSections = (): void => {
    let injectedId = pullInjectedSectionGenerationId();
    while (injectedId) {
      if (!specById.has(injectedId)) {
        const injectedSpec = allTemplateSpecs.find((entry) => entry.id === injectedId);
        if (injectedSpec && shouldGenerate(injectedSpec)) {
          specById.set(injectedId, injectedSpec);
        }
      }
      if (specById.has(injectedId) && !pendingIds.includes(injectedId)) {
        pendingIds.unshift(injectedId);
      } else if (specById.has(injectedId)) {
        prependSectionGenerationPriority(injectedId);
      }
      injectedId = pullInjectedSectionGenerationId();
    }
  };

  while (pendingIds.length > 0 || hasPendingInjectedSections()) {
    drainInjectedSections();
    if (pendingIds.length === 0) {
      continue;
    }

    const priorityId = pullPrioritySectionGenerationId();
    let nextId: string | undefined;
    if (priorityId && pendingIds.includes(priorityId)) {
      pendingIds.splice(pendingIds.indexOf(priorityId), 1);
      nextId = priorityId;
    } else if (priorityId && specById.has(priorityId)) {
      nextId = priorityId;
    } else {
      nextId = pendingIds.shift();
    }
    const spec = nextId ? specById.get(nextId) : undefined;

    if (!spec) {
      continue;
    }

    await waitForProtocolBuildResume();
    throwIfAborted(callbacks?.signal);

    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('m11-smoke-simulate-section-generation-failure') === 'first' &&
      providerId === 'fixture' &&
      spec.id === specs[0]?.id
    ) {
      const errorMessage = 'Simulated section failure for smoke testing.';
      drafts.push(createFailedSectionDraft(spec, input, 1, providerId, model, errorMessage));
      updateSectionGenerationState(spec.id, 'failed');
      callbacks?.onSectionDraft?.(drafts[drafts.length - 1]);
      appendProtocolBuildEvent({
        type: 'error',
        message: `Section ${spec.id} failed; retry available`,
        sectionId: spec.id,
        sectionTitle: spec.title,
        provider: providerLabel,
        model,
        metadata: { error: errorMessage },
      });
      emitProgress(callbacks, {
        totalSections: specs.length,
        completedSections,
        failedSections: ++failedSections,
        currentSectionId: spec.id,
        currentSectionTitle: spec.title,
        elapsedMs: performance.now() - startedAt,
        providerLabel,
        model,
        lastError: errorMessage,
      }, sectionDurations);
      if (isProtocolBuildPauseRequested()) {
        markProtocolBuildPaused();
        appendProtocolBuildEvent({ type: 'info', message: 'Import paused after current section.' });
        await waitForProtocolBuildResume();
      }
      continue;
    }

    const requestStartedAt = performance.now();
    logM11Generation('section-started', { sectionId: spec.id, title: spec.title });
    updateSectionGenerationState(spec.id, 'generating');
    appendProtocolBuildEvent({
      type: 'progress',
      message: `Generating ${spec.title}`,
      sectionId: spec.id,
      sectionTitle: spec.title,
      provider: providerLabel,
      model,
    });
    emitProgress(callbacks, {
      totalSections: specs.length,
      completedSections,
      failedSections,
      currentSectionId: spec.id,
      currentSectionTitle: spec.title,
      elapsedMs: performance.now() - startedAt,
      currentRequestDurationMs: 0,
      providerLabel,
      model,
    }, sectionDurations);

    try {
      const draft = await generateOne(spec, 1);
      completedSections += 1;
      drafts.push(draft);
      const requestDurationMs = performance.now() - requestStartedAt;
      sectionDurations.push(requestDurationMs);
      updateSectionGenerationState(spec.id, 'needsReview');
      callbacks?.onSectionDraft?.(draft);
      logM11Generation('section-completed', {
        sectionId: spec.id,
        durationMs: Math.round(requestDurationMs),
      });
      appendProtocolBuildEvent({
        type: 'success',
        message: `Completed ${spec.title} · ${Math.round(requestDurationMs / 1000)} sec`,
        sectionId: spec.id,
        sectionTitle: spec.title,
        provider: providerLabel,
        model,
        durationMs: Math.round(requestDurationMs),
      });
      emitProgress(callbacks, {
        totalSections: specs.length,
        completedSections,
        failedSections,
        currentSectionId: spec.id,
        currentSectionTitle: spec.title,
        elapsedMs: performance.now() - startedAt,
        currentRequestDurationMs: requestDurationMs,
        providerLabel,
        model,
      }, sectionDurations);
    } catch (error) {
      const errorMessage = formatLlmUserError(error);
      failedSections += 1;
      updateSectionGenerationState(spec.id, 'failed');
      logM11Generation('section-failed', { sectionId: spec.id, error: errorMessage });
      drafts.push(createFailedSectionDraft(spec, input, 1, providerId, model, errorMessage));
      callbacks?.onSectionDraft?.(drafts[drafts.length - 1]);
      appendProtocolBuildEvent({
        type: 'error',
        message: `Section ${spec.id} failed; retry available`,
        sectionId: spec.id,
        sectionTitle: spec.title,
        provider: providerLabel,
        model,
        metadata: { error: errorMessage },
      });
      emitProgress(callbacks, {
        totalSections: specs.length,
        completedSections,
        failedSections,
        currentSectionId: spec.id,
        currentSectionTitle: spec.title,
        elapsedMs: performance.now() - startedAt,
        currentRequestDurationMs: performance.now() - requestStartedAt,
        providerLabel,
        model,
        lastError: errorMessage,
      }, sectionDurations);

      if (error instanceof ImportProcessingAbortedError) {
        throw error;
      }
    }

    if (isProtocolBuildPauseRequested()) {
      markProtocolBuildPaused();
      appendProtocolBuildEvent({ type: 'info', message: 'Import paused after current section.' });
      await waitForProtocolBuildResume();
    }
  }

  const totalDurationMs = Math.round(performance.now() - startedAt);
  logM11Generation('generation-completed', {
    totalSections: specs.length,
    completedSections,
    failedSections,
    totalDurationMs,
  });

  emitProgress(callbacks, {
    totalSections: specs.length,
    completedSections,
    failedSections,
    elapsedMs: performance.now() - startedAt,
    providerLabel,
    model,
    isComplete: true,
  }, sectionDurations);

  return drafts;
}

async function generateOpenAiSections(
  input: M11GenerationInput,
  callbacks?: M11GenerationCallbacks,
): Promise<GeneratedSectionDraft[]> {
  const providerId = resolveLlmProviderConfig().providerId;
  const llmProvider = providerId === 'azure-openai' ? 'azure-openai' : 'openai';

  return generateSectionsWithProgress(
    input,
    (spec, draftVersion) => generateOpenAiSectionDraft(spec, input, draftVersion, llmProvider, callbacks),
    callbacks,
    llmProvider,
  );
}

const fixtureProvider: M11GenerationProvider = {
  id: 'fixture',
  displayName: 'Simulation Mode',
  generateSections: async (input, callbacks) =>
    generateSectionsWithProgress(
      input,
      async (spec) => {
        if (
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('m11-smoke-show-generation-progress') === 'true'
        ) {
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        return generateFixtureSectionDraft(spec, input, 1);
      },
      callbacks,
      'fixture',
    ),
  regenerateSection: async (input, sectionId, priorDraft) =>
    regenerateFixtureM11Section(input, sectionId, priorDraft),
};

const openAiProvider: M11GenerationProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  generateSections: generateOpenAiSections,
  regenerateSection: async (input, sectionId, priorDraft, callbacks) => {
    const spec = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).find((s) => s.id === sectionId);
    if (!spec) throw new Error(`Unknown section ${sectionId}`);
    const version = (priorDraft?.draftVersion ?? 0) + 1;
    return generateOpenAiSectionDraft(spec, input, version, 'openai', callbacks);
  },
};

const azureProvider: M11GenerationProvider = {
  ...openAiProvider,
  id: 'azure-openai',
  displayName: 'Azure OpenAI',
  regenerateSection: async (input, sectionId, priorDraft, callbacks) => {
    const spec = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).find((s) => s.id === sectionId);
    if (!spec) throw new Error(`Unknown section ${sectionId}`);
    const version = (priorDraft?.draftVersion ?? 0) + 1;
    return generateOpenAiSectionDraft(spec, input, version, 'azure-openai', callbacks);
  },
};

const PROVIDERS: Record<string, M11GenerationProvider> = {
  fixture: fixtureProvider,
  openai: openAiProvider,
  'azure-openai': azureProvider,
  local: fixtureProvider,
  anthropic: fixtureProvider,
};

export function resolveM11GenerationProvider(): M11GenerationProvider {
  const { providerId } = resolveLlmProviderConfig();
  return PROVIDERS[providerId] ?? fixtureProvider;
}

export type { M11GenerationCallbacks } from './m11GenerationProgress';

export async function runM11SectionGeneration(
  input: M11GenerationInput,
  callbacks?: M11GenerationCallbacks,
): Promise<GeneratedSectionDraft[]> {
  return resolveM11GenerationProvider().generateSections(input, callbacks);
}

export async function runM11SectionRegeneration(
  input: M11GenerationInput,
  sectionId: string,
  priorDraft?: GeneratedSectionDraft,
  callbacks?: M11GenerationCallbacks,
): Promise<GeneratedSectionDraft> {
  return resolveM11GenerationProvider().regenerateSection(input, sectionId, priorDraft, callbacks);
}

export function mergeRetriedSectionDrafts(
  existing: GeneratedSectionDraft[],
  retried: GeneratedSectionDraft[],
): GeneratedSectionDraft[] {
  const byId = new Map(existing.map((draft) => [draft.sectionId, draft]));
  for (const draft of retried) {
    byId.set(draft.sectionId, draft);
  }
  return Array.from(byId.values());
}

export function failedSectionIdsFromDrafts(drafts: GeneratedSectionDraft[]): string[] {
  return drafts.filter((draft) => draft.generationStatus === 'failed').map((draft) => draft.sectionId);
}

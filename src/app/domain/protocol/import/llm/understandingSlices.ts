import type { ProtocolKnowledgeModel } from '../protocolKnowledgeTypes';
import type { ImportedProtocolSource } from '../types';
import { appendProtocolBuildEvent } from '../../build/protocolBuildConsoleStore';
import { rebuildStudyModel } from '../../../study-model/studyModelStore';
import { getProtocolDocument } from '../../store/protocolStore';
import {
  mergeKnowledgeArrayField,
  normalizeProtocolKnowledgeModelArrays,
  PROTOCOL_KNOWLEDGE_ARRAY_FIELDS,
} from '../protocolKnowledgeNormalization';
import { ensureArray } from '../../../../utils/ensureArray';
import { buildFixtureProtocolUnderstanding } from './fixtureUnderstanding';
import { resolveLlmProviderConfig } from './llmConfig';
import { callOpenAiChat } from './openAiClient';
import { throwIfAborted } from './llmRequestTimeouts';
import { parseLlmJson } from './parseLlmJson';
import type { ProtocolUnderstandingCallbacks, ProtocolUnderstandingInput } from './types';
import { UNDERSTANDING_PROMPT_VERSION } from './types';

export type UnderstandingSliceId =
  | 'identity'
  | 'objectives'
  | 'design'
  | 'population'
  | 'interventions'
  | 'assessments'
  | 'statistics';

export interface UnderstandingSliceDefinition {
  id: UnderstandingSliceId;
  consoleLabel: string;
  sourcePatterns: RegExp[];
  outputFields: (keyof ProtocolKnowledgeModel)[];
}

export const UNDERSTANDING_SLICE_DEFINITIONS: UnderstandingSliceDefinition[] = [
  {
    id: 'identity',
    consoleLabel: 'Building study identity',
    sourcePatterns: [/synopsis|protocol\s+summary|study\s+title|sponsor|identifier|phase|indication/i],
    outputFields: [
      'studyTitle',
      'shortTitle',
      'sponsor',
      'protocolIdentifier',
      'version',
      'phase',
      'indication',
    ],
  },
  {
    id: 'objectives',
    consoleLabel: 'Extracting objectives',
    sourcePatterns: [/objective|endpoint|estimand|primary|secondary|exploratory/i],
    outputFields: [
      'primaryObjectives',
      'secondaryObjectives',
      'exploratoryObjectives',
      'estimands',
      'endpoints',
    ],
  },
  {
    id: 'design',
    consoleLabel: 'Extracting trial design',
    sourcePatterns: [/trial\s+design|overall\s+design|schema|randomi|blinding|arm|control/i],
    outputFields: ['arms', 'armDefinitions', 'interventionModel', 'controlType'],
  },
  {
    id: 'population',
    consoleLabel: 'Extracting population',
    sourcePatterns: [/population|inclusion|exclusion|eligibility|enrollment|participant/i],
    outputFields: ['targetPopulation', 'inclusionCriteriaSummary', 'exclusionCriteriaSummary'],
  },
  {
    id: 'interventions',
    consoleLabel: 'Extracting interventions',
    sourcePatterns: [/intervention|investigational|dose|regimen|administration|concomitant/i],
    outputFields: ['interventions'],
  },
  {
    id: 'assessments',
    consoleLabel: 'Extracting assessments',
    sourcePatterns: [/assessment|procedure|visit|schedule|safety|efficacy|adverse/i],
    outputFields: ['visits', 'assessments', 'safetyMonitoring', 'safetyAssessments', 'efficacyAssessments'],
  },
  {
    id: 'statistics',
    consoleLabel: 'Extracting statistics',
    sourcePatterns: [/statistic|sample\s+size|analysis|multiplicity|interim/i],
    outputFields: ['statisticalSummary', 'riskBenefitSummary'],
  },
];

function truncate(text: string, max = 6000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated for slice context]`;
}

function filterSourceSections(
  source: ImportedProtocolSource,
  patterns: RegExp[],
): ImportedProtocolSource['sections'] {
  const matched = source.sections.filter(
    (section) => patterns.some((pattern) => pattern.test(section.headingText) || pattern.test(section.text.slice(0, 400))),
  );
  if (matched.length > 0) {
    return matched.slice(0, 12);
  }
  return source.sections.slice(0, 8);
}

function mergePartialKnowledge(
  base: Partial<ProtocolKnowledgeModel>,
  partial: Partial<ProtocolKnowledgeModel>,
): Partial<ProtocolKnowledgeModel> {
  const merged: Partial<ProtocolKnowledgeModel> = { ...base };
  for (const [key, value] of Object.entries(partial) as Array<[keyof ProtocolKnowledgeModel, unknown]>) {
    if (value === undefined || value === null) continue;
    if (PROTOCOL_KNOWLEDGE_ARRAY_FIELDS.includes(key as (typeof PROTOCOL_KNOWLEDGE_ARRAY_FIELDS)[number])) {
      merged[key] = mergeKnowledgeArrayField(merged[key], value) as never;
      continue;
    }
    if (Array.isArray(value)) {
      const existing = (merged[key] as unknown[] | undefined) ?? [];
      merged[key] = [...new Set([...(existing as unknown[]), ...value])] as never;
      continue;
    }
    if (typeof value === 'string' && value.trim().length === 0) continue;
    merged[key] = value as never;
  }
  return normalizeProtocolKnowledgeModelArrays(merged);
}

function normalizeSliceOutput(
  raw: Partial<ProtocolKnowledgeModel>,
  slice: UnderstandingSliceDefinition,
): Partial<ProtocolKnowledgeModel> {
  const partial: Partial<ProtocolKnowledgeModel> = {};
  for (const field of slice.outputFields) {
    const value = raw[field];
    if (value !== undefined) {
      partial[field] = value as never;
    }
  }
  return partial;
}

async function runFixtureSlice(
  input: ProtocolUnderstandingInput,
  slice: UnderstandingSliceDefinition,
): Promise<Partial<ProtocolKnowledgeModel>> {
  const full = buildFixtureProtocolUnderstanding(input);
  return normalizeSliceOutput(full, slice);
}

async function runOpenAiSlice(
  input: ProtocolUnderstandingInput,
  slice: UnderstandingSliceDefinition,
  callbacks?: ProtocolUnderstandingCallbacks,
): Promise<Partial<ProtocolKnowledgeModel>> {
  throwIfAborted(callbacks?.signal);
  const config = resolveLlmProviderConfig();
  const sections = filterSourceSections(input.sourceExtraction, slice.sourcePatterns);
  const sliceText = sections.map((section) => `${section.headingText}\n${section.text}`).join('\n\n');

  const result = await callOpenAiChat(
    config,
    [
      {
        role: 'system',
        content:
          'You are a clinical protocol scientist. Extract only the requested study knowledge slice. Return JSON only.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: `protocol_understanding_slice_${slice.id}`,
          promptVersion: UNDERSTANDING_PROMPT_VERSION,
          slice: slice.id,
          sourceSections: sections.map((section) => ({
            id: section.id,
            heading: section.headingText,
            excerpt: section.text.slice(0, 800),
          })),
          focusedProtocolText: truncate(sliceText),
          outputFields: slice.outputFields,
        }),
      },
    ],
    {
      jsonMode: true,
      temperature: 0.1,
      signal: callbacks?.signal,
      operation: 'protocolUnderstanding',
    },
  );

  const parsed = parseLlmJson<Partial<ProtocolKnowledgeModel>>(result.content);
  return normalizeSliceOutput(parsed, slice);
}

export interface StagedUnderstandingResult {
  model: ProtocolKnowledgeModel;
  partialUnderstanding: boolean;
  failedSlices: UnderstandingSliceId[];
  completedSlices: UnderstandingSliceId[];
}

export interface DeepEnrichmentCallbacks extends ProtocolUnderstandingCallbacks {
  onSliceComplete?: (sliceId: UnderstandingSliceId, merged: ProtocolKnowledgeModel) => void;
}

/** Background deep knowledge enrichment — does not block priority generation. */
export async function runDeepKnowledgeEnrichment(
  baseModel: ProtocolKnowledgeModel,
  input: ProtocolUnderstandingInput,
  callbacks?: DeepEnrichmentCallbacks,
): Promise<StagedUnderstandingResult> {
  const providerId = resolveLlmProviderConfig().providerId;
  const useFixture = providerId === 'fixture' || providerId === 'local' || providerId === 'anthropic';
  const uploadId = input.sourceExtraction.uploadId;

  let merged: Partial<ProtocolKnowledgeModel> = { ...baseModel };
  const completedSlices: UnderstandingSliceId[] = [];
  const failedSlices: UnderstandingSliceId[] = [];

  for (const slice of UNDERSTANDING_SLICE_DEFINITIONS) {
    throwIfAborted(callbacks?.signal);
    appendProtocolBuildEvent({ type: 'progress', message: `Enriching ${slice.id}` });

    try {
      const partial = useFixture
        ? await runFixtureSlice(input, slice)
        : await runOpenAiSlice(input, slice, callbacks);
      merged = mergePartialKnowledge(merged, partial);
      completedSlices.push(slice.id);
      appendProtocolBuildEvent({ type: 'success', message: `${slice.consoleLabel} complete` });
    } catch (error) {
      failedSlices.push(slice.id);
      appendProtocolBuildEvent({
        type: 'warning',
        message: `${slice.consoleLabel} unavailable — continuing with partial enrichment`,
        metadata: { slice: slice.id, error: error instanceof Error ? error.message : String(error) },
      });
    }

    const normalized = normalizeProtocolKnowledgeModelArrays(merged) as ProtocolKnowledgeModel;
    rebuildStudyModel({
      sourceUploadId: uploadId,
      knowledge: normalized,
      document: getProtocolDocument(),
    });
    callbacks?.onSliceComplete?.(slice.id, normalized);
  }

  const partialUnderstanding = failedSlices.length > 0;
  const model: ProtocolKnowledgeModel = normalizeProtocolKnowledgeModelArrays({
    ...(merged as ProtocolKnowledgeModel),
    confidence: 0,
    extractionNotes: [
      ...(ensureArray<string>(merged.extractionNotes)),
      partialUnderstanding
        ? `Deep enrichment partial (${completedSlices.length}/${UNDERSTANDING_SLICE_DEFINITIONS.length} slices).`
        : `Deep enrichment complete (${completedSlices.length} slices).`,
      ...failedSlices.map((slice) => `Enrichment slice unavailable: ${slice}`),
    ],
    understandingSliceStatus: Object.fromEntries(
      UNDERSTANDING_SLICE_DEFINITIONS.map((slice) => [
        slice.id,
        completedSlices.includes(slice.id) ? 'complete' : 'failed',
      ]),
    ),
    partialUnderstanding,
  }) as ProtocolKnowledgeModel;

  if (partialUnderstanding) {
    appendProtocolBuildEvent({
      type: 'warning',
      message: 'Deep Study Model enrichment partial — some slices were unavailable',
      metadata: { failedSlices: failedSlices.join(', ') },
    });
  } else {
    appendProtocolBuildEvent({ type: 'success', message: 'Deep Study Model enrichment complete' });
  }

  return { model, partialUnderstanding, failedSlices, completedSlices };
}

/** @deprecated Use buildCoreStudyModel + runDeepKnowledgeEnrichment instead. */
export async function runStagedProtocolUnderstanding(
  input: ProtocolUnderstandingInput,
  callbacks?: ProtocolUnderstandingCallbacks,
): Promise<StagedUnderstandingResult> {
  const providerId = resolveLlmProviderConfig().providerId;
  const useFixture = providerId === 'fixture' || providerId === 'local' || providerId === 'anthropic';
  const uploadId = input.sourceExtraction.uploadId;

  let merged: Partial<ProtocolKnowledgeModel> = {
    id: `knowledge-${uploadId}`,
    sourceUploadId: uploadId,
    extractedAt: new Date().toISOString(),
    knowledgeProvider: useFixture ? 'fixture' : providerId === 'azure-openai' ? 'azure-openai' : 'openai',
    understandingModel: useFixture ? 'fixture-protocol-understanding-v1' : resolveLlmProviderConfig().model ?? 'gpt-5',
    understandingPromptVersion: UNDERSTANDING_PROMPT_VERSION,
    confidence: 0,
    extractionNotes: [],
    sourceReferences: input.sourceExtraction.sections.slice(0, 6).map((section) => ({
      sourceSectionId: section.id,
      label: section.headingText,
      excerpt: section.text.slice(0, 200),
    })),
    primaryObjectives: [],
    secondaryObjectives: [],
    exploratoryObjectives: [],
    estimands: [],
    arms: [],
    armDefinitions: [],
    interventions: [],
    visits: [],
    assessments: [],
    safetyMonitoring: [],
    safetyAssessments: [],
    efficacyAssessments: [],
  };

  const completedSlices: UnderstandingSliceId[] = [];
  const failedSlices: UnderstandingSliceId[] = [];

  for (const slice of UNDERSTANDING_SLICE_DEFINITIONS) {
    throwIfAborted(callbacks?.signal);
    appendProtocolBuildEvent({ type: 'progress', message: slice.consoleLabel });

    try {
      const partial = useFixture
        ? await runFixtureSlice(input, slice)
        : await runOpenAiSlice(input, slice, callbacks);
      merged = mergePartialKnowledge(merged, partial);
      completedSlices.push(slice.id);
      appendProtocolBuildEvent({ type: 'success', message: `${slice.consoleLabel} complete` });
    } catch (error) {
      failedSlices.push(slice.id);
      appendProtocolBuildEvent({
        type: 'warning',
        message: `${slice.consoleLabel} unavailable — continuing with partial understanding`,
        metadata: { slice: slice.id, error: error instanceof Error ? error.message : String(error) },
      });
    }

    rebuildStudyModel({
      sourceUploadId: uploadId,
      knowledge: normalizeProtocolKnowledgeModelArrays(merged) as ProtocolKnowledgeModel,
      document: getProtocolDocument(),
    });
  }

  if (completedSlices.length === 0) {
    throw new Error('Protocol understanding failed — no understanding slices completed.');
  }

  const partialUnderstanding = failedSlices.length > 0;
  if (partialUnderstanding) {
    appendProtocolBuildEvent({
      type: 'warning',
      message: 'Partial protocol understanding — some slices were unavailable',
      metadata: { failedSlices: failedSlices.join(', ') },
    });
  }

  const confidence = Math.min(0.95, 0.45 + completedSlices.length * 0.07);
  const model: ProtocolKnowledgeModel = normalizeProtocolKnowledgeModelArrays({
    ...(merged as ProtocolKnowledgeModel),
    confidence,
    extractionNotes: [
      ...(ensureArray<string>(merged.extractionNotes)),
      partialUnderstanding
        ? `Partial protocol understanding (${completedSlices.length}/${UNDERSTANDING_SLICE_DEFINITIONS.length} slices).`
        : `Staged protocol understanding completed (${completedSlices.length} slices).`,
      ...failedSlices.map((slice) => `Slice unavailable: ${slice}`),
    ],
    understandingSliceStatus: Object.fromEntries(
      UNDERSTANDING_SLICE_DEFINITIONS.map((slice) => [
        slice.id,
        completedSlices.includes(slice.id) ? 'complete' : 'failed',
      ]),
    ),
    partialUnderstanding,
  }) as ProtocolKnowledgeModel;

  return { model, partialUnderstanding, failedSlices, completedSlices };
}

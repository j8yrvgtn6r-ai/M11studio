import type { ProtocolKnowledgeModel } from '../protocolKnowledgeTypes';
import { buildFixtureProtocolUnderstanding } from './fixtureUnderstanding';
import { resolveLlmProviderConfig } from './llmConfig';
import { callOpenAiChat } from './openAiClient';
import { parseLlmJson } from './parseLlmJson';
import type { ProtocolUnderstandingInput, ProtocolUnderstandingProvider } from './types';
import { UNDERSTANDING_PROMPT_VERSION } from './types';

function truncate(text: string, max = 14000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated for model context]`;
}

function normalizeKnowledgeModel(
  raw: Partial<ProtocolKnowledgeModel>,
  input: ProtocolUnderstandingInput,
  providerId: ProtocolKnowledgeModel['knowledgeProvider'],
  model: string,
): ProtocolKnowledgeModel {
  const uploadId = input.sourceExtraction.uploadId;
  return {
    id: `knowledge-${uploadId}`,
    sourceUploadId: uploadId,
    extractedAt: new Date().toISOString(),
    knowledgeProvider: providerId,
    understandingModel: model,
    understandingPromptVersion: UNDERSTANDING_PROMPT_VERSION,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.7,
    extractionNotes: raw.extractionNotes ?? ['LLM protocol understanding completed.'],
    sourceReferences:
      raw.sourceReferences ??
      input.sourceExtraction.sections.slice(0, 6).map((section) => ({
        sourceSectionId: section.id,
        label: section.headingText,
        excerpt: section.text.slice(0, 200),
      })),
    studyTitle: raw.studyTitle,
    shortTitle: raw.shortTitle,
    sponsor: raw.sponsor,
    protocolIdentifier: raw.protocolIdentifier,
    version: raw.version,
    phase: raw.phase,
    indication: raw.indication,
    targetPopulation: raw.targetPopulation ?? raw.population,
    inclusionCriteriaSummary: raw.inclusionCriteriaSummary ?? raw.eligibilitySummary,
    exclusionCriteriaSummary: raw.exclusionCriteriaSummary,
    primaryObjectives: raw.primaryObjectives ?? raw.objectives ?? [],
    secondaryObjectives: raw.secondaryObjectives ?? [],
    exploratoryObjectives: raw.exploratoryObjectives ?? [],
    estimands: raw.estimands ?? [],
    arms: raw.arms ?? [],
    armDefinitions: raw.armDefinitions ?? [],
    interventionModel: raw.interventionModel,
    controlType: raw.controlType,
    interventions: raw.interventions ?? [],
    visits: raw.visits ?? [],
    assessments: raw.assessments ?? [],
    safetyMonitoring: raw.safetyMonitoring ?? raw.safetyAssessments ?? [],
    safetyAssessments: raw.safetyAssessments ?? [],
    efficacyAssessments: raw.efficacyAssessments ?? [],
    statisticalSummary: raw.statisticalSummary,
    riskBenefitSummary: raw.riskBenefitSummary,
    population: raw.targetPopulation ?? raw.population,
    objectives: raw.primaryObjectives ?? raw.objectives,
    endpoints: raw.endpoints ?? [],
    eligibilitySummary: raw.inclusionCriteriaSummary ?? raw.eligibilitySummary,
  };
}

const fixtureProvider: ProtocolUnderstandingProvider = {
  id: 'fixture',
  displayName: 'Fixture (development/smoke)',
  understand: async (input) => buildFixtureProtocolUnderstanding(input),
};

const openAiProvider: ProtocolUnderstandingProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  understand: async (input) => {
    const config = resolveLlmProviderConfig();
    const templateOutline = input.m11TemplateSections
      .filter((spec) => spec.sectionType !== 'template-instruction')
      .slice(0, 40)
      .map((spec) => `${spec.id} ${spec.title}`)
      .join('\n');

    const result = await callOpenAiChat(
      config,
      [
        {
          role: 'system',
          content:
            'You are a clinical protocol scientist. Understand the uploaded protocol as a complete study design document. ' +
            'Return JSON only. Do not map source sections to M11 sections. Extract global study knowledge for later M11 reconstruction.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'protocol_understanding',
            promptVersion: UNDERSTANDING_PROMPT_VERSION,
            m11TemplateOutline: templateOutline,
            sourceSectionCandidates: input.sourceExtraction.sections.map((section) => ({
              id: section.id,
              heading: section.headingText,
              excerpt: section.text.slice(0, 500),
            })),
            fullProtocolText: truncate(input.sourceExtraction.fullText),
            outputSchema: {
              studyTitle: 'string',
              protocolIdentifier: 'string',
              sponsor: 'string',
              phase: 'string',
              indication: 'string',
              targetPopulation: 'string',
              primaryObjectives: 'string[]',
              secondaryObjectives: 'string[]',
              estimands: 'string[]',
              arms: 'string[]',
              interventions: 'string[]',
              visits: 'string[]',
              assessments: 'string[]',
              safetyMonitoring: 'string[]',
              statisticalSummary: 'string',
              riskBenefitSummary: 'string',
              confidence: 'number 0-1',
              extractionNotes: 'string[]',
              sourceReferences: 'array of {label, excerpt, sourceSectionId?}',
            },
          }),
        },
      ],
      { jsonMode: true, temperature: 0.1 },
    );

    const parsed = parseLlmJson<Partial<ProtocolKnowledgeModel>>(result.content);
    return normalizeKnowledgeModel(parsed, input, 'openai', result.model);
  },
};

const azureProvider: ProtocolUnderstandingProvider = {
  ...openAiProvider,
  id: 'azure-openai',
  displayName: 'Azure OpenAI',
  understand: async (input) => {
    const model = await openAiProvider.understand(input);
    return { ...model, knowledgeProvider: 'azure-openai' };
  },
};

const PROVIDERS: Record<string, ProtocolUnderstandingProvider> = {
  fixture: fixtureProvider,
  openai: openAiProvider,
  'azure-openai': azureProvider,
  local: fixtureProvider,
  anthropic: fixtureProvider,
};

export function resolveProtocolUnderstandingProvider(): ProtocolUnderstandingProvider {
  const { providerId } = resolveLlmProviderConfig();
  return PROVIDERS[providerId] ?? fixtureProvider;
}

export async function runProtocolUnderstanding(
  input: ProtocolUnderstandingInput,
): Promise<ProtocolKnowledgeModel> {
  const provider = resolveProtocolUnderstandingProvider();
  return provider.understand(input);
}

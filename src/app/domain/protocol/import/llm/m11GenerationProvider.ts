import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../../ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../../ichM11/types';
import { transitionSectionState } from '../sectionReviewStateMachine';
import type { GeneratedSectionDraft, SectionGenerationProvenance } from '../types';
import { generateFixtureM11Sections, regenerateFixtureM11Section } from './fixtureGeneration';
import { resolveLlmProviderConfig } from './llmConfig';
import { callOpenAiChat } from './openAiClient';
import { parseLlmJson } from './parseLlmJson';
import type { M11GenerationInput, M11GenerationProvider } from './types';
import { GENERATION_PROMPT_VERSION } from './types';

function shouldGenerate(spec: IchM11SectionSpec): boolean {
  if (spec.sectionType === 'template-instruction') return false;
  if (spec.id === '0' || spec.id.startsWith('0.')) return false;
  return true;
}

function truncate(text: string, max = 6000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[truncated]`;
}

async function generateOpenAiSectionDraft(
  spec: IchM11SectionSpec,
  input: M11GenerationInput,
  draftVersion: number,
  providerId: SectionGenerationProvenance['generationProvider'],
): Promise<GeneratedSectionDraft> {
  const config = resolveLlmProviderConfig();
  const techSpec = input.m11TechnicalSpecification.find((s) => s.id === spec.id);

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
    { jsonMode: true, temperature: 0.25 },
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

async function generateOpenAiSections(input: M11GenerationInput): Promise<GeneratedSectionDraft[]> {
  const specs = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).filter(shouldGenerate);
  const filterIds = input.sectionIds ? new Set(input.sectionIds) : null;
  const providerId = resolveLlmProviderConfig().providerId;
  const llmProvider = providerId === 'azure-openai' ? 'azure-openai' : 'openai';

  const drafts: GeneratedSectionDraft[] = [];
  for (const spec of specs) {
    if (filterIds && !filterIds.has(spec.id)) continue;
    drafts.push(await generateOpenAiSectionDraft(spec, input, 1, llmProvider));
  }
  return drafts;
}

const fixtureProvider: M11GenerationProvider = {
  id: 'fixture',
  displayName: 'Fixture (development/smoke)',
  generateSections: async (input) => generateFixtureM11Sections(input),
  regenerateSection: async (input, sectionId, priorDraft) =>
    regenerateFixtureM11Section(input, sectionId, priorDraft),
};

const openAiProvider: M11GenerationProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  generateSections: generateOpenAiSections,
  regenerateSection: async (input, sectionId, priorDraft) => {
    const spec = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).find((s) => s.id === sectionId);
    if (!spec) throw new Error(`Unknown section ${sectionId}`);
    const version = (priorDraft?.draftVersion ?? 0) + 1;
    return generateOpenAiSectionDraft(spec, input, version, 'openai');
  },
};

const azureProvider: M11GenerationProvider = {
  ...openAiProvider,
  id: 'azure-openai',
  displayName: 'Azure OpenAI',
  regenerateSection: async (input, sectionId, priorDraft) => {
    const spec = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).find((s) => s.id === sectionId);
    if (!spec) throw new Error(`Unknown section ${sectionId}`);
    const version = (priorDraft?.draftVersion ?? 0) + 1;
    return generateOpenAiSectionDraft(spec, input, version, 'azure-openai');
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

export async function runM11SectionGeneration(input: M11GenerationInput): Promise<GeneratedSectionDraft[]> {
  return resolveM11GenerationProvider().generateSections(input);
}

export async function runM11SectionRegeneration(
  input: M11GenerationInput,
  sectionId: string,
  priorDraft?: GeneratedSectionDraft,
): Promise<GeneratedSectionDraft> {
  return resolveM11GenerationProvider().regenerateSection(input, sectionId, priorDraft);
}

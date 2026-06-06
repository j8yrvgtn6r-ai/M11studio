import type {
  KnowledgeSourceReference,
  ProtocolKnowledgeModel,
  ProtocolKnowledgeProviderId,
} from './protocolKnowledgeTypes';
import type { ImportedProtocolSource, ProtocolSourceArtifact } from './types';
import { buildLocalDeterministicKnowledgeModel } from './buildProtocolKnowledgeModel';
import { normalizeProtocolKnowledgeModelArrays } from './protocolKnowledgeNormalization';
import { ensureArray } from '../../../utils/ensureArray';
import { resolveLlmProviderConfig } from './llm/llmConfig';
import { callOpenAiChat } from './llm/openAiClient';
import { parseLlmJson } from './llm/parseLlmJson';
import { throwIfAborted } from './llm/llmRequestTimeouts';
import { buildFixtureProtocolUnderstanding } from './llm/fixtureUnderstanding';
import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import { ICH_M11_TECHNICAL_SPEC_SECTION_SPECS } from '../ichM11/ichM11TechnicalSpecification';
import { UNDERSTANDING_PROMPT_VERSION } from './llm/types';

/** Fast, minimally sufficient study model for first-pass M11 generation. */
export interface CoreStudyModel {
  sourceUploadId: string;
  builtAt: string;
  studyTitle?: string;
  protocolIdentifier?: string;
  sponsor?: string;
  phase?: string;
  indication?: string;
  populationSummary?: string;
  interventionArms: string[];
  investigationalIntervention?: string;
  controlIntervention?: string;
  randomization?: string;
  blinding?: string;
  primaryObjectives: string[];
  secondaryObjectives: string[];
  exploratoryObjectives: string[];
  primaryEndpoints: string[];
  keySecondaryEndpoints: string[];
  coreEligibilitySummary?: string;
  coreTrialDesignSummary?: string;
  mainSafetyAssessments: string[];
  mainEfficacyAssessments: string[];
  statisticalHeadline?: string;
  sampleSize?: string;
  sourceReferences: KnowledgeSourceReference[];
  extractionNotes: string[];
  usedLlm: boolean;
}

const CORE_LLM_TIMEOUT_MS = 40_000;

const CORE_SOURCE_PATTERNS = [
  /synopsis|protocol\s+summary|study\s+title|title\s+page|sponsor|identifier|phase|indication/i,
  /objective|endpoint|primary|secondary|exploratory/i,
  /trial\s+design|overall\s+design|schema|randomi|blinding|arm|control/i,
  /population|inclusion|exclusion|eligibility|enrollment|participant/i,
  /intervention|investigational|dose|regimen/i,
  /assessment|procedure|visit|schedule|safety|efficacy|adverse/i,
  /statistic|sample\s+size|analysis|multiplicity|interim/i,
];

function filterCoreSourceSections(source: ImportedProtocolSource): ImportedProtocolSource['sections'] {
  const matched = source.sections.filter(
    (section) =>
      CORE_SOURCE_PATTERNS.some(
        (pattern) => pattern.test(section.headingText) || pattern.test(section.text.slice(0, 400)),
      ),
  );
  return (matched.length > 0 ? matched : source.sections).slice(0, 14);
}

function splitInterventions(interventions: string[]): {
  investigationalIntervention?: string;
  controlIntervention?: string;
} {
  const lower = interventions.map((item) => item.toLowerCase());
  const investigational = interventions.find((_, index) =>
    /investigational|experimental|active|study drug|test product/.test(lower[index] ?? ''),
  );
  const control = interventions.find((_, index) =>
    /placebo|control|comparator|standard of care/.test(lower[index] ?? ''),
  );
  return {
    investigationalIntervention: investigational ?? interventions[0],
    controlIntervention: control ?? interventions[1],
  };
}

function splitEndpoints(endpoints: string[]): { primary: string[]; secondary: string[] } {
  const primary: string[] = [];
  const secondary: string[] = [];
  for (const endpoint of endpoints) {
    if (/primary/i.test(endpoint)) {
      primary.push(endpoint);
    } else if (/secondary|key secondary/i.test(endpoint)) {
      secondary.push(endpoint);
    } else if (primary.length === 0) {
      primary.push(endpoint);
    } else {
      secondary.push(endpoint);
    }
  }
  return { primary, secondary };
}

function deterministicCoreFromSource(source: ImportedProtocolSource): CoreStudyModel {
  const base = buildLocalDeterministicKnowledgeModel(source);
  const endpoints = ensureArray<string>(base.endpoints);
  const { primary, secondary } = splitEndpoints(endpoints);
  const interventions = ensureArray<string>(base.interventions);
  const { investigationalIntervention, controlIntervention } = splitInterventions(interventions);

  const designSections = source.sections
    .filter((section) => /design|schema|randomi|blinding/i.test(section.headingText))
    .map((section) => section.text.replace(/\s+/g, ' ').trim().slice(0, 280));

  return {
    sourceUploadId: source.uploadId,
    builtAt: new Date().toISOString(),
    studyTitle: base.studyTitle,
    protocolIdentifier: base.protocolIdentifier,
    sponsor: base.sponsor,
    phase: base.phase,
    indication: base.indication,
    populationSummary: base.targetPopulation ?? base.inclusionCriteriaSummary,
    interventionArms: ensureArray<string>(base.arms),
    investigationalIntervention,
    controlIntervention,
    randomization: base.interventionModel,
    blinding: base.controlType,
    primaryObjectives: ensureArray<string>(base.primaryObjectives),
    secondaryObjectives: ensureArray<string>(base.secondaryObjectives),
    exploratoryObjectives: ensureArray<string>(base.exploratoryObjectives),
    primaryEndpoints: primary,
    keySecondaryEndpoints: secondary,
    coreEligibilitySummary: [base.inclusionCriteriaSummary, base.exclusionCriteriaSummary]
      .filter(Boolean)
      .join(' · '),
    coreTrialDesignSummary: designSections[0] ?? base.interventionModel,
    mainSafetyAssessments: ensureArray<string>(base.safetyAssessments),
    mainEfficacyAssessments: ensureArray<string>(base.efficacyAssessments),
    statisticalHeadline: base.statisticalSummary,
    sampleSize: undefined,
    sourceReferences: base.sourceReferences,
    extractionNotes: ['Core Study Model built from deterministic DOCX extraction.'],
    usedLlm: false,
  };
}

function coreModelNeedsLlmGap(core: CoreStudyModel): boolean {
  return (
    !core.studyTitle ||
    core.primaryObjectives.length === 0 ||
    (core.interventionArms.length === 0 && !core.investigationalIntervention)
  );
}

async function enrichCoreWithLlm(
  source: ImportedProtocolSource,
  core: CoreStudyModel,
  artifact: ProtocolSourceArtifact | undefined,
  signal?: AbortSignal,
): Promise<CoreStudyModel> {
  throwIfAborted(signal);
  const providerId = resolveLlmProviderConfig().providerId;
  const useFixture = providerId === 'fixture' || providerId === 'local' || providerId === 'anthropic';

  if (useFixture) {
    const fixture = buildFixtureProtocolUnderstanding({
      sourceExtraction: source,
      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
      m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
      artifact,
    });
    return {
      ...core,
      studyTitle: core.studyTitle ?? fixture.studyTitle,
      protocolIdentifier: core.protocolIdentifier ?? fixture.protocolIdentifier,
      sponsor: core.sponsor ?? fixture.sponsor,
      phase: core.phase ?? fixture.phase,
      indication: core.indication ?? fixture.indication,
      populationSummary: core.populationSummary ?? fixture.targetPopulation,
      interventionArms: core.interventionArms.length > 0 ? core.interventionArms : ensureArray(fixture.arms),
      investigationalIntervention: core.investigationalIntervention ?? fixture.interventions?.[0],
      controlIntervention: core.controlIntervention ?? fixture.interventions?.[1],
      randomization: core.randomization ?? fixture.interventionModel,
      blinding: core.blinding ?? fixture.controlType,
      primaryObjectives:
        core.primaryObjectives.length > 0 ? core.primaryObjectives : ensureArray(fixture.primaryObjectives),
      secondaryObjectives:
        core.secondaryObjectives.length > 0 ? core.secondaryObjectives : ensureArray(fixture.secondaryObjectives),
      exploratoryObjectives:
        core.exploratoryObjectives.length > 0
          ? core.exploratoryObjectives
          : ensureArray(fixture.exploratoryObjectives),
      primaryEndpoints:
        core.primaryEndpoints.length > 0 ? core.primaryEndpoints : ensureArray(fixture.endpoints).slice(0, 3),
      keySecondaryEndpoints:
        core.keySecondaryEndpoints.length > 0
          ? core.keySecondaryEndpoints
          : ensureArray(fixture.endpoints).slice(3, 8),
      coreEligibilitySummary:
        core.coreEligibilitySummary ??
        [fixture.inclusionCriteriaSummary, fixture.exclusionCriteriaSummary].filter(Boolean).join(' · '),
      coreTrialDesignSummary: core.coreTrialDesignSummary ?? fixture.interventionModel,
      mainSafetyAssessments:
        core.mainSafetyAssessments.length > 0
          ? core.mainSafetyAssessments
          : ensureArray(fixture.safetyAssessments),
      mainEfficacyAssessments:
        core.mainEfficacyAssessments.length > 0
          ? core.mainEfficacyAssessments
          : ensureArray(fixture.efficacyAssessments),
      statisticalHeadline: core.statisticalHeadline ?? fixture.statisticalSummary,
      extractionNotes: [...core.extractionNotes, 'Core Study Model enriched via fixture provider.'],
      usedLlm: true,
    };
  }

  const sections = filterCoreSourceSections(source);
  const focusedText = sections
    .map((section) => `${section.headingText}\n${section.text.slice(0, 900)}`)
    .join('\n\n')
    .slice(0, 12000);

  const llmPromise = callOpenAiChat(
    resolveLlmProviderConfig(),
    [
      {
        role: 'system',
        content:
          'Extract a compact Core Study Model for first-pass clinical protocol drafting. Return JSON only with the requested fields.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'core_study_model',
          promptVersion: UNDERSTANDING_PROMPT_VERSION,
          focusedProtocolText: focusedText,
          existingCore: core,
          outputFields: [
            'studyTitle',
            'protocolIdentifier',
            'sponsor',
            'phase',
            'indication',
            'populationSummary',
            'interventionArms',
            'investigationalIntervention',
            'controlIntervention',
            'randomization',
            'blinding',
            'primaryObjectives',
            'secondaryObjectives',
            'exploratoryObjectives',
            'primaryEndpoints',
            'keySecondaryEndpoints',
            'coreEligibilitySummary',
            'coreTrialDesignSummary',
            'mainSafetyAssessments',
            'mainEfficacyAssessments',
            'statisticalHeadline',
            'sampleSize',
          ],
        }),
      },
    ],
    {
      jsonMode: true,
      temperature: 0.1,
      signal,
      operation: 'protocolUnderstanding',
    },
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Core Study Model LLM call timed out')), CORE_LLM_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([llmPromise, timeoutPromise]);
    const parsed = parseLlmJson<Partial<CoreStudyModel>>(result.content);
    return {
      ...core,
      studyTitle: parsed.studyTitle ?? core.studyTitle,
      protocolIdentifier: parsed.protocolIdentifier ?? core.protocolIdentifier,
      sponsor: parsed.sponsor ?? core.sponsor,
      phase: parsed.phase ?? core.phase,
      indication: parsed.indication ?? core.indication,
      populationSummary: parsed.populationSummary ?? core.populationSummary,
      interventionArms: ensureArray<string>(parsed.interventionArms ?? core.interventionArms),
      investigationalIntervention: parsed.investigationalIntervention ?? core.investigationalIntervention,
      controlIntervention: parsed.controlIntervention ?? core.controlIntervention,
      randomization: parsed.randomization ?? core.randomization,
      blinding: parsed.blinding ?? core.blinding,
      primaryObjectives: ensureArray<string>(parsed.primaryObjectives ?? core.primaryObjectives),
      secondaryObjectives: ensureArray<string>(parsed.secondaryObjectives ?? core.secondaryObjectives),
      exploratoryObjectives: ensureArray<string>(parsed.exploratoryObjectives ?? core.exploratoryObjectives),
      primaryEndpoints: ensureArray<string>(parsed.primaryEndpoints ?? core.primaryEndpoints),
      keySecondaryEndpoints: ensureArray<string>(parsed.keySecondaryEndpoints ?? core.keySecondaryEndpoints),
      coreEligibilitySummary: parsed.coreEligibilitySummary ?? core.coreEligibilitySummary,
      coreTrialDesignSummary: parsed.coreTrialDesignSummary ?? core.coreTrialDesignSummary,
      mainSafetyAssessments: ensureArray<string>(parsed.mainSafetyAssessments ?? core.mainSafetyAssessments),
      mainEfficacyAssessments: ensureArray<string>(parsed.mainEfficacyAssessments ?? core.mainEfficacyAssessments),
      statisticalHeadline: parsed.statisticalHeadline ?? core.statisticalHeadline,
      sampleSize: parsed.sampleSize ?? core.sampleSize,
      extractionNotes: [...core.extractionNotes, 'Core Study Model enriched via compact LLM call.'],
      usedLlm: true,
    };
  } catch {
    return {
      ...core,
      extractionNotes: [...core.extractionNotes, 'Core Study Model LLM enrichment skipped — using deterministic core.'],
    };
  }
}

export async function buildCoreStudyModel(input: {
  sourceExtraction: ImportedProtocolSource;
  artifact?: ProtocolSourceArtifact;
  signal?: AbortSignal;
}): Promise<CoreStudyModel> {
  throwIfAborted(input.signal);
  let core = deterministicCoreFromSource(input.sourceExtraction);

  if (coreModelNeedsLlmGap(core)) {
    core = await enrichCoreWithLlm(input.sourceExtraction, core, input.artifact, input.signal);
  }

  return core;
}

export function coreStudyModelToProtocolKnowledgeModel(
  core: CoreStudyModel,
  providerId: string,
  modelLabel: string,
): ProtocolKnowledgeModel {
  const endpoints = [...core.primaryEndpoints, ...core.keySecondaryEndpoints];
  const interventions = [
    ...(core.investigationalIntervention ? [core.investigationalIntervention] : []),
    ...(core.controlIntervention ? [core.controlIntervention] : []),
  ];

  const knowledgeProvider: ProtocolKnowledgeProviderId =
    providerId === 'azure-openai'
      ? 'azure-openai'
      : providerId === 'openai'
        ? 'openai'
        : providerId === 'fixture' || providerId === 'local'
          ? 'fixture'
          : 'openai';

  return normalizeProtocolKnowledgeModelArrays({
    id: `knowledge-${core.sourceUploadId}`,
    sourceUploadId: core.sourceUploadId,
    extractedAt: core.builtAt,
    knowledgeProvider,
    understandingModel: modelLabel,
    understandingPromptVersion: UNDERSTANDING_PROMPT_VERSION,
    confidence: 0,
    extractionNotes: [...core.extractionNotes, 'Core Study Model — deep enrichment pending.'],
    sourceReferences: core.sourceReferences,
    studyTitle: core.studyTitle,
    sponsor: core.sponsor,
    protocolIdentifier: core.protocolIdentifier,
    phase: core.phase,
    indication: core.indication,
    targetPopulation: core.populationSummary,
    inclusionCriteriaSummary: core.coreEligibilitySummary,
    interventionModel: core.randomization ?? core.coreTrialDesignSummary,
    controlType: core.blinding,
    primaryObjectives: core.primaryObjectives,
    secondaryObjectives: core.secondaryObjectives,
    exploratoryObjectives: core.exploratoryObjectives,
    endpoints,
    arms: core.interventionArms,
    interventions: interventions.length > 0 ? interventions : core.interventionArms,
    safetyAssessments: core.mainSafetyAssessments,
    efficacyAssessments: core.mainEfficacyAssessments,
    statisticalSummary: core.statisticalHeadline ?? core.sampleSize,
    partialUnderstanding: true,
    understandingSliceStatus: { core: 'complete' },
  }) as ProtocolKnowledgeModel;
}

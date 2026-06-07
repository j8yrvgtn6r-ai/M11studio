import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../../ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../../ichM11/types';
import type { ProtocolKnowledgeModel } from '../protocolKnowledgeTypes';
import { transitionSectionState } from '../sectionReviewStateMachine';
import type { GeneratedSectionDraft, ImportedProtocolSource, ProtocolSourceArtifact } from '../types';
import type { SectionGenerationProvenance } from '../types';
import type { M11GenerationInput } from './types';
import { GENERATION_PROMPT_VERSION } from './types';
import { getGenerationGuidancePayload } from '../../../m11-template-guidance';

const SOA_NOTE =
  'Schedule of Activities is authored in SoA Configuration. This proposal reminds reviewers that visit and assessment schedules must be confirmed against the reconstructed study design.';

function shouldGenerate(spec: IchM11SectionSpec): boolean {
  if (spec.sectionType === 'template-instruction') return false;
  if (spec.id === '0' || spec.id.startsWith('0.')) return false;
  return true;
}

function knowledgeElementsForSection(spec: IchM11SectionSpec, knowledge: ProtocolKnowledgeModel): string[] {
  const title = spec.title.toLowerCase();
  const id = spec.id;
  const elements: string[] = [];

  const push = (label: string, values?: string | string[]) => {
    if (!values) return;
    if (Array.isArray(values)) {
      for (const value of values.slice(0, 3)) elements.push(`${label}: ${value}`);
      return;
    }
    elements.push(`${label}: ${values}`);
  };

  if (id.startsWith('1') || title.includes('synopsis') || title.includes('title')) {
    push('Study title', knowledge.studyTitle);
    push('Protocol ID', knowledge.protocolIdentifier);
    push('Sponsor', knowledge.sponsor);
    push('Phase', knowledge.phase);
    push('Indication', knowledge.indication);
  }
  if (id.startsWith('3') || title.includes('objective')) {
    push('Primary objectives', knowledge.primaryObjectives);
    push('Secondary objectives', knowledge.secondaryObjectives);
    push('Estimands', knowledge.estimands);
    push('Endpoints', knowledge.endpoints);
  }
  if (id.startsWith('4') || title.includes('design') || title.includes('population')) {
    push('Target population', knowledge.targetPopulation);
    push('Arms', knowledge.arms);
    push('Intervention model', knowledge.interventionModel);
    push('Interventions', knowledge.interventions);
  }
  if (id.startsWith('5') || title.includes('eligibility')) {
    push('Inclusion', knowledge.inclusionCriteriaSummary);
    push('Exclusion', knowledge.exclusionCriteriaSummary);
  }
  if (title.includes('visit') || title.includes('schedule')) {
    push('Visits', knowledge.visits);
    push('Assessments', knowledge.assessments);
  }
  if (title.includes('safety')) {
    push('Safety monitoring', knowledge.safetyMonitoring);
  }
  if (id.startsWith('9') || title.includes('statistic')) {
    push('Statistics', knowledge.statisticalSummary);
  }
  if (title.includes('risk') || title.includes('benefit')) {
    push('Risk-benefit', knowledge.riskBenefitSummary);
  }

  return elements.slice(0, 8);
}

function reconstructSectionText(
  spec: IchM11SectionSpec,
  knowledge: ProtocolKnowledgeModel,
  source: ImportedProtocolSource,
  artifact: ProtocolSourceArtifact,
): string {
  if (spec.metadata?.viewKind === 'schedule-of-activities') {
    return SOA_NOTE;
  }

  const elements = knowledgeElementsForSection(spec, knowledge);
  const contextExcerpt = source.fullText.replace(/\s+/g, ' ').trim().slice(0, 900);

  return [
    `[PROPOSED M11 SECTION — ${spec.title}]`,
    'Reconstructed from global protocol understanding. This is not a section-to-section translation.',
    '',
    `M11 Template section ${spec.id}: ${spec.title}`,
    `Source document: ${artifact.filename}`,
    '',
    'Study design elements applied:',
    elements.length > 0 ? elements.map((line) => `• ${line}`).join('\n') : '• Global protocol context (see Protocol Knowledge tab)',
    '',
    'Reconstruction narrative:',
    elements.length > 0
      ? `This section drafts the ${spec.title.toLowerCase()} content based on the understood study design. ` +
        `Reviewers should confirm clinical accuracy against the uploaded protocol and edit before approval. ` +
        `Key elements: ${elements.slice(0, 3).join('; ')}.`
      : `This section is drafted from the complete uploaded protocol context. ` +
        `The source structure differs from ICH M11; content was reconstructed to fit template section ${spec.id}.`,
    '',
    'Source protocol context excerpt:',
    contextExcerpt,
    '',
    'Human approval is required. Validation does not replace clinical review.',
  ].join('\n');
}

function buildProvenance(
  spec: IchM11SectionSpec,
  input: M11GenerationInput,
  knowledgeElements: string[],
  draftVersion = 1,
): SectionGenerationProvenance {
  const refs = input.sourceExtraction.sections.slice(0, 4).map((section) => section.id);
  const sectionGuidance = getGenerationGuidancePayload(spec.id);
  return {
    generationProvider: 'fixture',
    generationModel: 'fixture-m11-reconstruct-v1',
    generationTimestamp: new Date().toISOString(),
    generationPromptVersion: GENERATION_PROMPT_VERSION,
    sourceUploadId: input.artifact.id,
    knowledgeModelId: input.protocolKnowledgeModel.id,
    sourceCandidateIds: refs,
    confidence: input.protocolKnowledgeModel.confidence,
    generationNotes: [
      'Fixture M11 reconstruction provider (development/smoke).',
      `Reconstructed M11 section ${spec.id} from ProtocolKnowledgeModel — not source-section mapping.`,
      ...(sectionGuidance ? [`Applied section guidance for ${spec.id}.`] : []),
    ],
    knowledgeElementsUsed: knowledgeElements,
    draftVersion,
  };
}

function createDraft(
  spec: IchM11SectionSpec,
  input: M11GenerationInput,
  generatedAt: string,
  draftVersion = 1,
): GeneratedSectionDraft {
  const knowledgeElements = knowledgeElementsForSection(spec, input.protocolKnowledgeModel);
  const provenance = buildProvenance(spec, input, knowledgeElements, draftVersion);

  const draft: GeneratedSectionDraft = {
    sectionId: spec.id,
    title: spec.title,
    generatedText: reconstructSectionText(
      spec,
      input.protocolKnowledgeModel,
      input.sourceExtraction,
      input.artifact,
    ),
    sourceUploadId: input.artifact.id,
    sourceExtractionId: input.sourceExtraction.uploadId,
    knowledgeModelId: input.protocolKnowledgeModel.id,
    matchedSourceCandidateIds: provenance.sourceCandidateIds,
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'fixture',
    provenance,
    draftVersion,
    state: 'generated',
    stateChangedAt: generatedAt,
    stateChangedBy: 'fixture-generation-provider',
    stateHistory: [],
    generatedAt,
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
  };

  return transitionSectionState(draft, 'importGenerated', 'fixture-generation-provider', 'M11 draft generated');
}

export function generateFixtureM11Sections(input: M11GenerationInput): GeneratedSectionDraft[] {
  const specs = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).filter(shouldGenerate);
  const filterIds = input.sectionIds ? new Set(input.sectionIds) : null;
  const generatedAt = new Date().toISOString();

  return specs
    .filter((spec) => !filterIds || filterIds.has(spec.id))
    .map((spec) => createDraft(spec, input, generatedAt));
}

export function generateFixtureSectionDraft(
  spec: IchM11SectionSpec,
  input: M11GenerationInput,
  draftVersion = 1,
): GeneratedSectionDraft {
  return createDraft(spec, input, new Date().toISOString(), draftVersion);
}

export function regenerateFixtureM11Section(
  input: M11GenerationInput,
  sectionId: string,
  priorDraft?: GeneratedSectionDraft,
): GeneratedSectionDraft {
  const spec = (input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS).find((s) => s.id === sectionId);
  if (!spec) {
    throw new Error(`Unknown M11 section ${sectionId}`);
  }
  const version = (priorDraft?.draftVersion ?? 0) + 1;
  return createDraft(spec, input, new Date().toISOString(), version);
}

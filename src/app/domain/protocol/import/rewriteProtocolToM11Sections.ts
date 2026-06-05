/**
 * M11 section rewrite provider boundary — deterministic local generation until LLM is configured.
 */

import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import { ICH_M11_TECHNICAL_SPEC_SECTION_SPECS } from '../ichM11/ichM11TechnicalSpecification';
import type { IchM11SectionSpec } from '../ichM11/types';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';
import { findRelevantSourceCandidates } from './m11SourceSectionMapping';
import { transitionSectionState } from './sectionReviewStateMachine';
import type {
  GeneratedSectionDraft,
  ImportedProtocolSource,
  ProtocolSourceArtifact,
  SectionGenerationProvider,
} from './types';

export interface RewriteProtocolSectionsInput {
  sourceExtraction: ImportedProtocolSource;
  protocolKnowledgeModel: ProtocolKnowledgeModel;
  m11TemplateSections?: IchM11SectionSpec[];
  m11TechnicalSpecification?: IchM11SectionSpec[];
  controlledTerminology?: { codelistCount: number; termCount: number };
  artifact: ProtocolSourceArtifact;
  generationProvider?: SectionGenerationProvider;
}

const SOA_NOTE =
  'Schedule of Activities is not extracted from DOCX in this release. Author visits and assessments in SoA Configuration. Human approval is still required for any narrative linked to section 1.3.';

function shouldGenerateDraftForSpec(spec: IchM11SectionSpec): boolean {
  if (spec.sectionType === 'template-instruction') {
    return false;
  }
  if (spec.id === '0' || spec.id.startsWith('0.')) {
    return false;
  }
  return true;
}

function excerpt(text: string, maxLength = 220): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}

function knowledgeLinesForSection(
  spec: IchM11SectionSpec,
  knowledge: ProtocolKnowledgeModel,
): string[] {
  const id = spec.id;
  const title = spec.title.toLowerCase();
  const lines: string[] = [];

  const push = (label: string, value?: string | string[]) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return;
      }
      lines.push(`${label}:`);
      for (const item of value.slice(0, 4)) {
        lines.push(`  • ${item}`);
      }
      return;
    }
    lines.push(`${label}: ${value}`);
  };

  if (id.startsWith('1') || title.includes('title') || title.includes('synopsis')) {
    push('Study title', knowledge.studyTitle);
    push('Short title', knowledge.shortTitle);
    push('Sponsor', knowledge.sponsor);
    push('Protocol identifier', knowledge.protocolIdentifier);
    push('Version', knowledge.version);
    push('Phase', knowledge.phase);
    push('Indication', knowledge.indication);
  }

  if (id.startsWith('3') || title.includes('objective')) {
    push('Objectives', knowledge.objectives);
    push('Endpoints', knowledge.endpoints);
    push('Estimands', knowledge.estimands);
  }

  if (id.startsWith('4') || title.includes('design') || title.includes('population')) {
    push('Population', knowledge.population);
    push('Arms', knowledge.arms);
    push('Interventions', knowledge.interventions);
  }

  if (id.startsWith('5') || title.includes('eligibility')) {
    push('Eligibility summary', knowledge.eligibilitySummary);
  }

  if (title.includes('safety') || title.includes('adverse')) {
    push('Safety assessments', knowledge.safetyAssessments);
  }

  if (title.includes('efficacy') || title.includes('endpoint')) {
    push('Efficacy assessments', knowledge.efficacyAssessments);
    push('Endpoints', knowledge.endpoints);
  }

  if (id.startsWith('9') || title.includes('statistic')) {
    push('Statistical summary', knowledge.statisticalSummary);
  }

  return lines;
}

function buildDeterministicDraftText(
  spec: IchM11SectionSpec,
  input: RewriteProtocolSectionsInput,
  matchedIds: string[],
): string {
  if (spec.metadata?.viewKind === 'schedule-of-activities') {
    return SOA_NOTE;
  }

  const matched = input.sourceExtraction.sections.filter((section) => matchedIds.includes(section.id));
  const knowledgeLines = knowledgeLinesForSection(spec, input.protocolKnowledgeModel);
  const sourcePreview =
    matched.length > 0
      ? matched.map((section) => `• ${section.headingText}: ${excerpt(section.text, 180)}`).join('\n')
      : '• No mapped source section — see Source extraction for full candidate list.';

  const providerLabel =
    input.generationProvider === 'llm'
      ? 'LLM provider (configured)'
      : 'Local deterministic assembly (not AI-generated)';

  return [
    'PROPOSED M11 SECTION DRAFT — requires human review before approval.',
    'Approval triggers validation; validation does not replace human approval.',
    '',
    `Generation: ${providerLabel}`,
    `Source file: ${input.artifact.filename}`,
    `M11 template section: ${spec.title}`,
    `Technical specification sections loaded: ${input.m11TechnicalSpecification?.length ?? ICH_M11_TECHNICAL_SPEC_SECTION_SPECS.length}`,
    `Controlled terminology codelists available: ${input.controlledTerminology?.codelistCount ?? 'bundled'}`,
    '',
    'Protocol knowledge (from uploaded DOCX):',
    knowledgeLines.length > 0 ? knowledgeLines.join('\n') : '  • No structured knowledge fields matched this section.',
    '',
    'Matched source excerpt(s):',
    sourcePreview,
    '',
    'Edit this text during review. Request changes or approve only after clinical review.',
  ].join('\n');
}

function createBaseDraft(
  spec: IchM11SectionSpec,
  input: RewriteProtocolSectionsInput,
  matchedIds: string[],
  generatedAt: string,
): GeneratedSectionDraft {
  const draft: GeneratedSectionDraft = {
    sectionId: spec.id,
    title: spec.title,
    generatedText: buildDeterministicDraftText(spec, input, matchedIds),
    sourceUploadId: input.artifact.id,
    sourceExtractionId: input.sourceExtraction.uploadId,
    knowledgeModelId: input.protocolKnowledgeModel.id,
    matchedSourceCandidateIds: matchedIds,
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: input.generationProvider ?? 'local-deterministic',
    draftVersion: 1,
    state: 'generated',
    stateChangedAt: generatedAt,
    stateChangedBy: 'import-processor',
    stateHistory: [],
    generatedAt,
    validationStatus: 'not-run',
    validationMessages: [],
  };

  return transitionSectionState(draft, 'importGenerated', 'import-processor', 'Import draft created');
}

/** Generates M11 section draft proposals (never auto-approved). */
export function rewriteProtocolToM11Sections(input: RewriteProtocolSectionsInput): GeneratedSectionDraft[] {
  const templateSpecs = input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS;
  const generatedAt = new Date().toISOString();
  const drafts: GeneratedSectionDraft[] = [];

  for (const spec of templateSpecs) {
    if (!shouldGenerateDraftForSpec(spec)) {
      continue;
    }

    const matched = findRelevantSourceCandidates(
      spec.id,
      spec.title,
      input.sourceExtraction.sections,
    );
    const matchedIds = matched.map((section) => section.id);
    drafts.push(createBaseDraft(spec, input, matchedIds, generatedAt));
  }

  return drafts;
}

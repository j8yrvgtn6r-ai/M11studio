import { getIchM11TemplateSpecById } from '../../ichM11/ichM11Template';
import { ICH_M11_TECHNICAL_SPEC_SECTION_SPECS } from '../../ichM11/ichM11TechnicalSpecification';
import type { ValidationAgentOutput } from '../../../agents/validationRules';
import { getKnowledgeGraphSummary } from '../../../knowledge-graph';
import { getStudyModel } from '../../../study-model/studyModelStore';
import type { SectionGenerationProvider, ValidationChange, ValidationChangeSeverity, ValidationChangeType } from '../types';
import { callOpenAiChat } from './openAiClient';
import { getLlmValidationAvailability, resolveLlmProviderConfig } from './llmConfig';
import { formatLlmUserError } from './llmRequestTimeouts';
import { parseLlmJson } from './parseLlmJson';

interface LlmValidationResponse {
  validatedText: string;
  changes?: Array<{
    id?: string;
    type?: ValidationChangeType;
    originalText?: string;
    replacementText?: string;
    reason?: string;
    terminologyCode?: string;
    severity?: ValidationChangeSeverity;
  }>;
  findings?: Array<{
    code?: string;
    severity?: 'error' | 'warning' | 'info';
    message?: string;
    suggestedTerm?: string;
  }>;
}

function normalizeProviderId(providerId: string): SectionGenerationProvider {
  if (providerId === 'azure-openai') {
    return 'azure-openai';
  }
  if (providerId === 'openai') {
    return 'openai';
  }
  return 'openai';
}

function normalizeChanges(raw: LlmValidationResponse['changes'], validatedText: string): ValidationChange[] {
  if (!raw?.length) {
    return [];
  }

  return raw.map((change, index) => ({
    id: change.id ?? `llm-change-${index + 1}`,
    type: change.type ?? 'replacement',
    originalText: change.originalText,
    replacementText: change.replacementText,
    reason: change.reason ?? 'LLM validation adjustment',
    terminologyCode: change.terminologyCode,
    severity: change.severity ?? 'info',
  })).filter((change) => change.originalText || change.replacementText || change.reason);
}

export function getLlmValidationHelpMessage(): string {
  return getLlmValidationAvailability().message;
}

export function isLlmValidationAvailable(): boolean {
  return getLlmValidationAvailability().available;
}

export async function runLlmSectionValidation(input: {
  sectionId: string;
  sectionTitle: string;
  importedText: string;
}): Promise<{ output: ValidationAgentOutput; provider: SectionGenerationProvider; model: string }> {
  const availability = getLlmValidationAvailability();
  if (!availability.available) {
    throw new Error(availability.message);
  }

  const config = resolveLlmProviderConfig();
  const spec = getIchM11TemplateSpecById(input.sectionId);
  const studyModel = getStudyModel();
  const knowledgeSummary = getKnowledgeGraphSummary();
  const techSpec = ICH_M11_TECHNICAL_SPEC_SECTION_SPECS.find((entry) => entry.id === input.sectionId);

  const systemPrompt = [
    'You are an ICH M11 protocol validation assistant.',
    'Review imported protocol section text and propose M11-compliant validated text.',
    'Return JSON only with keys: validatedText, changes[], findings[].',
    'Each change must include type, reason, originalText, replacementText, severity, terminologyCode when applicable.',
    'Change types: terminology, structural, formatting, replacement, addition, deletion.',
    'Do not invent clinical facts. Preserve meaning while aligning terminology and structure with ICH M11.',
  ].join(' ');

  const userPrompt = [
    `Section ID: ${input.sectionId}`,
    `Section title: ${input.sectionTitle}`,
    spec ? `M11 template guidance: ${spec.title} — ${spec.description ?? ''}` : '',
    techSpec ? `Technical specification note: ${techSpec.title}` : '',
    studyModel?.studyTitle ? `Study title: ${studyModel.studyTitle}` : '',
    knowledgeSummary.entityCount > 0
      ? `Knowledge graph entities available: ${knowledgeSummary.entityCount}`
      : '',
    'Original imported text:',
    input.importedText,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const result = await callOpenAiChat(
      config,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { jsonMode: true, temperature: 0.2, operation: 'sectionValidation' },
    );

    const parsed = parseLlmJson<LlmValidationResponse>(result.content);
    const validatedText = (parsed.validatedText ?? input.importedText).trim();
    const changes = normalizeChanges(parsed.changes, validatedText);
    const findings =
      parsed.findings?.map((finding, index) => ({
        code: finding.code ?? `llm_finding_${index + 1}`,
        severity: finding.severity ?? 'info',
        message: finding.message ?? 'LLM validation finding',
        suggestedTerm: finding.suggestedTerm,
      })) ?? [];

    const terminologyCount = changes.filter((change) => change.type === 'terminology').length;
    const structuralCount = changes.filter((change) => change.type === 'structural').length;

    return {
      output: {
        originalText: input.importedText,
        validatedText,
        changes,
        findings,
        terminologySuggestions: [],
        structuralSuggestions: [],
        validationSummary: {
          changeCount: changes.length,
          findingCount: findings.length,
          terminologyCount,
          structuralCount,
          status: findings.some((finding) => finding.severity === 'error') ? 'failed' : 'passed',
        },
      },
      provider: normalizeProviderId(config.providerId),
      model: result.model,
    };
  } catch (error) {
    throw new Error(formatLlmUserError(error));
  }
}

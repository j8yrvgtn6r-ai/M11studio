import { getM11Codelists } from '../ichM11/ichM11ControlledTerminology';
import { getIchM11TemplateSpecById } from '../ichM11/ichM11Template';
import { validateGeneratedSectionDraft } from './sectionDraftValidation';
import type { GeneratedSectionDraft, SectionValidationFinding } from './types';

function suggestTerminologyHarmonization(text: string): SectionValidationFinding[] {
  const findings: SectionValidationFinding[] = [];
  const lower = text.toLowerCase();

  const phaseMatch = lower.match(/\bphase\s+(i{1,3}|iv|1|2|3|4)\b/i);
  if (phaseMatch) {
    const trialPhaseList = getM11Codelists().find((list) => list.name === 'Trial Phase');
    if (trialPhaseList) {
      findings.push({
        code: 'terminology_suggestion',
        severity: 'info',
        message: `Narrative mentions trial phase "${phaseMatch[0]}". Bind structured Trial Phase field to NCI EVS codelist ${trialPhaseList.id}.`,
        suggestedTerm: trialPhaseList.terms.find((term) =>
          term.ichPreferredTerm.toLowerCase().includes(phaseMatch[1].toLowerCase()),
        )?.ichPreferredTerm,
      });
    }
  }

  if (/\byes\b|\bno\b/i.test(text)) {
    findings.push({
      code: 'terminology_suggestion',
      severity: 'info',
      message: 'Narrative contains Yes/No wording. Structured Yes-No codelist harmonization available for bound fields.',
    });
  }

  return findings;
}

/** Non-blocking post-generation validation — findings become review artifacts. */
export function applyPostGenerationValidation(draft: GeneratedSectionDraft): GeneratedSectionDraft {
  const structural = validateGeneratedSectionDraft(draft);
  const terminology = suggestTerminologyHarmonization(draft.generatedText);
  const spec = getIchM11TemplateSpecById(draft.sectionId);

  const findings: SectionValidationFinding[] = [
    ...terminology,
    ...structural.messages.map((message) => ({
      code: 'structural_check',
      severity:
        structural.validationStatus === 'failed'
          ? ('error' as const)
          : structural.validationStatus === 'warnings'
            ? ('warning' as const)
            : ('info' as const),
      message,
    })),
  ];

  if (spec?.conformance === 'required' && !draft.generatedText.trim()) {
    findings.push({
      code: 'required_content',
      severity: 'error',
      message: 'Required M11 section has no generated text after generation.',
    });
  }

  return {
    ...draft,
    validationStatus: structural.validationStatus,
    validationMessages: structural.messages,
    validationFindings: findings,
  };
}

export function applyPostGenerationValidationBatch(
  drafts: GeneratedSectionDraft[],
): GeneratedSectionDraft[] {
  return drafts.map(applyPostGenerationValidation);
}

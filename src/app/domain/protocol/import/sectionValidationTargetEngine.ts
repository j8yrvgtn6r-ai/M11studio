import { evaluateValidationFromDraft } from '../../../agents/validationRules';
import type { GeneratedSectionDraft, SectionValidationFinding } from './types';

/** Build a validated target from imported source text against M11 guidance hooks. */
export function buildValidatedTarget(draft: GeneratedSectionDraft): {
  validatedTargetText: string;
  findings: SectionValidationFinding[];
  messages: string[];
} {
  const output = evaluateValidationFromDraft(draft, 'validateImported');
  return {
    validatedTargetText: output.validatedText,
    findings: output.findings,
    messages: output.findings.map((finding) => finding.message),
  };
}

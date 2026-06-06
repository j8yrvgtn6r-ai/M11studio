import { getIchM11TemplateSpecById } from '../ichM11/ichM11Template';
import { validateGeneratedSectionDraft } from './sectionDraftValidation';
import type { GeneratedSectionDraft, SectionValidationFinding } from './types';

const TERMINOLOGY_EXPANSIONS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\boverall survival\b(?!\s*\(OS\))/gi,
    replacement: 'overall survival (OS)',
  },
  {
    pattern: /\bprogression-free survival\b(?!\s*\(PFS\))/gi,
    replacement: 'progression-free survival (PFS)',
  },
  {
    pattern: /\badverse events?\b(?!\s*\(AEs?\))/gi,
    replacement: 'adverse events (AEs)',
  },
];

function applyTerminologyExpansions(text: string): { text: string; findings: SectionValidationFinding[] } {
  let next = text;
  const findings: SectionValidationFinding[] = [];

  for (const rule of TERMINOLOGY_EXPANSIONS) {
    if (typeof rule.replacement === 'string') {
      if (rule.pattern.test(next)) {
        next = next.replace(rule.pattern, rule.replacement);
        findings.push({
          code: 'terminology_expansion',
          severity: 'info',
          message: `Expanded terminology: ${rule.replacement}`,
        });
      }
      continue;
    }
    next = next.replace(rule.pattern, rule.replacement);
  }

  return { text: next, findings };
}

/** Build a validated target from imported source text against M11 guidance hooks. */
export function buildValidatedTarget(draft: GeneratedSectionDraft): {
  validatedTargetText: string;
  findings: SectionValidationFinding[];
  messages: string[];
} {
  const baseText = (draft.sourceText ?? draft.generatedText).trim();
  const spec = getIchM11TemplateSpecById(draft.sectionId);
  const { text: expandedText, findings: terminologyFindings } = applyTerminologyExpansions(baseText);

  const provisionalDraft: GeneratedSectionDraft = {
    ...draft,
    generatedText: expandedText,
  };
  const validation = validateGeneratedSectionDraft(provisionalDraft);

  const messages = [...validation.messages];
  if (spec?.conformance === 'required' && !expandedText.trim()) {
    messages.push('Required M11 section is empty after validation.');
  }

  return {
    validatedTargetText: expandedText,
    findings: [...terminologyFindings, ...validation.messages.map((message) => ({
      code: 'm11_validation',
      severity: 'warning' as const,
      message,
    }))],
    messages,
  };
}

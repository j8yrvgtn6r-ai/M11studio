import { getIchM11TemplateSpecById } from '../ichM11/ichM11Template';
import { validateM11ControlledTerm } from '../ichM11/ichM11ControlledTerminology';
import type { GeneratedSectionDraft, GeneratedSectionValidationStatus } from './types';

export interface SectionDraftValidationOutcome {
  validationStatus: GeneratedSectionValidationStatus;
  messages: string[];
}

/** M11 template structure + controlled terminology hooks (non-blocking in v1). */
export function validateGeneratedSectionDraft(
  draft: GeneratedSectionDraft,
): SectionDraftValidationOutcome {
  const messages: string[] = [];
  const spec = getIchM11TemplateSpecById(draft.sectionId);

  if (!spec) {
    messages.push('Section is not present in the ICH M11 Template hierarchy.');
    return { validationStatus: 'failed', messages };
  }

  if (spec.title !== draft.title) {
    messages.push(
      `Section title differs from template heading (template: "${spec.title}", draft: "${draft.title}").`,
    );
  }

  if (spec.conformance === 'required' && !draft.generatedText.trim()) {
    messages.push('Required M11 section has no generated text.');
  }

  if (spec.metadata?.viewKind === 'schedule-of-activities') {
    messages.push(
      'SoA extraction is not implemented in v1; validate schedule content in SoA Configuration separately.',
    );
  }

  const terminologyNote =
    'Controlled terminology validation available for structured fields; narrative validation pending.';
  if (!messages.includes(terminologyNote)) {
    messages.push(terminologyNote);
  }

  const trialPhaseCheck = validateM11ControlledTerm('Trial Phase', 'Phase 3');
  if (draft.generatedText.toLowerCase().includes('phase 3') && !trialPhaseCheck.valid) {
    messages.push('Narrative mentions trial phase — structured codelist validation should run on bound fields.');
  }

  const hasError = messages.some((message) =>
    message.includes('not present') || message.includes('no generated text'),
  );
  const hasWarning =
    messages.length > 0 &&
    !hasError &&
    (messages.some((message) => message.includes('differs')) ||
      messages.some((message) => message.includes('not implemented')) ||
      messages.some((message) => message.includes('pending')));

  if (hasError) {
    return { validationStatus: 'failed', messages };
  }
  if (hasWarning) {
    return { validationStatus: 'warnings', messages };
  }
  return { validationStatus: 'passed', messages: messages.length > 0 ? messages : ['Section passed preliminary M11 checks.'] };
}

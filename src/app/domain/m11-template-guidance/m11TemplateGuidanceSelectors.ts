import { NOT_APPLICABLE_SECTION_TEXT } from './m11TemplateGuidanceConstants';
import { getM11TemplateGuidanceCatalog, GUIDANCE_EXCLUDED_SECTION_IDS } from './m11TemplateGuidanceExtraction';
import type { M11SectionGuidance } from './m11TemplateGuidanceTypes';

export function getSectionGuidance(sectionId: string | null | undefined): M11SectionGuidance | null {
  if (!sectionId) {
    return null;
  }
  return getM11TemplateGuidanceCatalog().get(sectionId) ?? null;
}

export function isGuidanceExcludedSection(sectionId: string | null | undefined): boolean {
  if (!sectionId) {
    return true;
  }
  const guidance = getSectionGuidance(sectionId);
  return GUIDANCE_EXCLUDED_SECTION_IDS.has(sectionId) || Boolean(guidance?.excludedFromGuidanceUi);
}

export function shouldUseM11TemplateGuidanceLayer(sectionId: string | null | undefined): boolean {
  return !isGuidanceExcludedSection(sectionId) && Boolean(getSectionGuidance(sectionId));
}

export function getEditorPlaceholderText(sectionId: string | null | undefined): string | undefined {
  const guidance = getSectionGuidance(sectionId);
  if (!guidance || guidance.excludedFromGuidanceUi || guidance.headingOnly) {
    return undefined;
  }
  return guidance.guidanceText[0];
}

export function shouldShowHeadingOnlyAuthoring(sectionId: string | null | undefined): boolean {
  const guidance = getSectionGuidance(sectionId);
  return Boolean(guidance && !guidance.excludedFromGuidanceUi && guidance.headingOnly);
}

export function allowsMarkNotApplicable(sectionId: string | null | undefined): boolean {
  const guidance = getSectionGuidance(sectionId);
  return Boolean(guidance?.allowsNotApplicable && !guidance.headingOnly && !guidance.excludedFromGuidanceUi);
}

export function getNotApplicableInsertText(): string {
  return NOT_APPLICABLE_SECTION_TEXT;
}

export function getGenerationGuidancePayload(sectionId: string): Record<string, unknown> | null {
  const guidance = getSectionGuidance(sectionId);
  if (!guidance || guidance.excludedFromGuidanceUi || guidance.headingOnly) {
    return null;
  }
  return {
    sectionTitle: guidance.sectionTitle,
    guidanceText: guidance.guidanceText,
    insertionPrompts: guidance.insertionPrompts,
    controlledTerminologyPrompts: guidance.controlledTerminologyPrompts,
    optionalityNotes: guidance.optionalityNotes,
    conditionalityNotes: guidance.conditionalityNotes,
    tableGuidance: guidance.tableGuidance,
  };
}

export function listMajorSectionGuidanceIds(): string[] {
  return [...getM11TemplateGuidanceCatalog().keys()].filter((sectionId) => {
    const guidance = getSectionGuidance(sectionId);
    return guidance && !guidance.excludedFromGuidanceUi;
  });
}

export function guidanceContainsInsertionPrompt(text: string, sectionId: string): boolean {
  const guidance = getSectionGuidance(sectionId);
  if (!guidance) {
    return false;
  }
  const normalized = text.trim().toLowerCase();
  return guidance.insertionPrompts.some((prompt) => normalized.includes(prompt.trim().toLowerCase()));
}

export function isHeadingOnlyWithAuthoredText(sectionId: string, plainText: string): boolean {
  const guidance = getSectionGuidance(sectionId);
  if (!guidance?.headingOnly) {
    return false;
  }
  const trimmed = plainText.trim();
  if (!trimmed) {
    return false;
  }
  return trimmed.toLowerCase() !== NOT_APPLICABLE_SECTION_TEXT.toLowerCase();
}

export function shouldSkipRequiredMissingForEmptySection(sectionId: string): boolean {
  const guidance = getSectionGuidance(sectionId);
  return Boolean(guidance?.headingOnly || guidance?.excludedFromGuidanceUi);
}

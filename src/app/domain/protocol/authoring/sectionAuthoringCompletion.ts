import type { ProtocolSection } from '../../../types/protocol';
import type { GeneratedSectionDraft } from '../import/types';
import { getFieldDefinitions } from '../selectors';
import {
  TITLE_PAGE_SECTION_ID,
  evaluateTitlePageCompletion,
} from './titlePageAuthoring';

/**
 * Section completion rules for footer progress (completed/total):
 *
 * - Title Page (`title`): all four required title-page fields have non-empty, non-placeholder values.
 * - Narrative sections: import draft exists with substantive text AND workflow is validated or approved.
 * - Manual/imported/generated drafts in "Draft / pending validation" do NOT increment completion until validated.
 */

function isNarrativeDraftComplete(draft: GeneratedSectionDraft | undefined): boolean {
  if (!draft?.generatedText?.trim()) {
    return false;
  }
  if (draft.workflowState === 'validated') {
    return true;
  }
  if (draft.state === 'approved' || draft.state === 'validationPassed') {
    return true;
  }
  return false;
}

function isSectionComplete(
  section: ProtocolSection,
  sectionDrafts: Record<string, GeneratedSectionDraft>,
  titlePageFields: ReturnType<typeof getFieldDefinitions>,
): boolean {
  if (section.id === TITLE_PAGE_SECTION_ID) {
    return evaluateTitlePageCompletion(titlePageFields).allRequiredComplete;
  }
  return isNarrativeDraftComplete(sectionDrafts[section.id]);
}

function walkSections(
  sections: ProtocolSection[],
  sectionDrafts: Record<string, GeneratedSectionDraft>,
  titlePageFields: ReturnType<typeof getFieldDefinitions>,
  counter: { completed: number; total: number },
): void {
  for (const section of sections) {
    if (section.ichM11InstructionOnly) {
      if (section.children?.length) {
        walkSections(section.children, sectionDrafts, titlePageFields, counter);
      }
      continue;
    }
    counter.total += 1;
    if (isSectionComplete(section, sectionDrafts, titlePageFields)) {
      counter.completed += 1;
    }
    if (section.children?.length) {
      walkSections(section.children, sectionDrafts, titlePageFields, counter);
    }
  }
}

export function countAuthoringCompletedSections(
  sections: ProtocolSection[],
  sectionDrafts: Record<string, GeneratedSectionDraft>,
): number {
  const titlePageFields = getFieldDefinitions();
  const counter = { completed: 0, total: 0 };
  walkSections(sections, sectionDrafts, titlePageFields, counter);
  return counter.completed;
}

export function countAuthoringTotalSections(sections: ProtocolSection[]): number {
  const counter = { completed: 0, total: 0 };
  walkSections(sections, {}, getFieldDefinitions(), counter);
  return counter.total;
}

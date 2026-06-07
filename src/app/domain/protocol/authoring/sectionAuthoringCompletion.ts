import type { ProtocolSection } from '../../../types/protocol';
import type { GeneratedSectionDraft } from '../import/types';

function isDraftComplete(draft: GeneratedSectionDraft | undefined): boolean {
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

function walkSections(
  sections: ProtocolSection[],
  sectionDrafts: Record<string, GeneratedSectionDraft>,
  counter: { completed: number; total: number },
): void {
  for (const section of sections) {
    if (section.ichM11InstructionOnly) {
      if (section.children?.length) {
        walkSections(section.children, sectionDrafts, counter);
      }
      continue;
    }
    counter.total += 1;
    if (isDraftComplete(sectionDrafts[section.id])) {
      counter.completed += 1;
    }
    if (section.children?.length) {
      walkSections(section.children, sectionDrafts, counter);
    }
  }
}

export function countAuthoringCompletedSections(
  sections: ProtocolSection[],
  sectionDrafts: Record<string, GeneratedSectionDraft>,
): number {
  const counter = { completed: 0, total: 0 };
  walkSections(sections, sectionDrafts, counter);
  return counter.completed;
}

export function countAuthoringTotalSections(sections: ProtocolSection[]): number {
  const counter = { completed: 0, total: 0 };
  walkSections(sections, {}, counter);
  return counter.total;
}

import type { ProtocolSection } from '../../../types/protocol';
import type { SectionNode } from '../types';

/** ICH M11 Foreword / template instruction sections — reference material only. */
export const TEMPLATE_INSTRUCTION_SECTION_IDS = ['0', '0.1', '0.2', '0.3', '0.4'] as const;

export type WorkingProtocolSectionKind = 'instruction' | 'heading' | 'authorable' | 'derived';

export function isTemplateInstructionNode(sectionId: string): boolean {
  if (sectionId === '0' || sectionId.startsWith('0.')) {
    return true;
  }
  return (TEMPLATE_INSTRUCTION_SECTION_IDS as readonly string[]).includes(sectionId);
}

export function classifySectionKind(
  section: Pick<SectionNode, 'id' | 'ichM11InstructionOnly' | 'ichM11TemplateOnly'>,
): WorkingProtocolSectionKind {
  if (section.ichM11InstructionOnly || isTemplateInstructionNode(section.id)) {
    return 'instruction';
  }
  if (section.ichM11TemplateOnly) {
    return 'heading';
  }
  return 'authorable';
}

export function isWorkingProtocolSectionNode(
  section: Pick<SectionNode, 'id' | 'ichM11InstructionOnly'>,
): boolean {
  return !section.ichM11InstructionOnly && !isTemplateInstructionNode(section.id);
}

export function isWorkingProtocolSection(
  section: Pick<ProtocolSection, 'id' | 'ichM11InstructionOnly'>,
): boolean {
  return !section.ichM11InstructionOnly && !isTemplateInstructionNode(section.id);
}

export function filterWorkingProtocolSectionNodes(sections: SectionNode[]): SectionNode[] {
  return sections.filter(isWorkingProtocolSectionNode).map((section) => ({
    ...section,
    ...(section.children?.length
      ? { children: filterWorkingProtocolSectionNodes(section.children) }
      : {}),
  }));
}

export function filterWorkingProtocolSections(sections: ProtocolSection[]): ProtocolSection[] {
  return sections.filter(isWorkingProtocolSection).map((section) => ({
    ...section,
    ...(section.children?.length ? { children: filterWorkingProtocolSections(section.children) } : {}),
  }));
}

export function listForewordTemplateReferenceSectionIds(): string[] {
  return [...TEMPLATE_INSTRUCTION_SECTION_IDS];
}

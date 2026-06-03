import type { ProtocolSection } from '../../../types/protocol';
import type { ProtocolDocument, SectionNode } from '../types';
import { resolveSectionCommentCount, resolveSectionValidationCount } from './computeSectionCounts';

function toProtocolSection(section: SectionNode, document: ProtocolDocument): ProtocolSection {
  const validationCount = resolveSectionValidationCount(section, document);
  const commentCount = resolveSectionCommentCount(section, document);

  const mapped: ProtocolSection = {
    id: section.id,
    title: section.title,
    level: section.level,
    conformance: section.conformance,
    status: section.status,
    validationCount,
  };

  if (section.hasAmendment) {
    mapped.hasAmendment = true;
  }

  if (commentCount !== undefined) {
    mapped.commentCount = commentCount;
  }

  if (section.children?.length) {
    mapped.children = section.children.map((child) => toProtocolSection(child, document));
  }

  return mapped;
}

export function selectProtocolSections(document: ProtocolDocument): ProtocolSection[] {
  return document.sections.map((section) => toProtocolSection(section, document));
}

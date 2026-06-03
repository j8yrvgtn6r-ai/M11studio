import type { ProtocolDocument, SectionNode } from '../types';

function countValidationIssuesForSection(sectionId: string, document: ProtocolDocument): number {
  return document.validationIssues.filter(
    (issue) =>
      issue.sectionId === sectionId || issue.sectionId.startsWith(`${sectionId}.`)
  ).length;
}

function countCommentsForSection(sectionId: string, document: ProtocolDocument): number {
  return document.collaboration.comments.filter((comment) => comment.sectionId === sectionId)
    .length;
}

export function resolveSectionValidationCount(
  section: SectionNode,
  document: ProtocolDocument
): number {
  if (section.validationCount !== undefined) {
    return section.validationCount;
  }

  return countValidationIssuesForSection(section.id, document);
}

export function resolveSectionCommentCount(
  section: SectionNode,
  document: ProtocolDocument
): number | undefined {
  if (section.commentCount !== undefined) {
    return section.commentCount;
  }

  const count = countCommentsForSection(section.id, document);
  return count > 0 ? count : undefined;
}

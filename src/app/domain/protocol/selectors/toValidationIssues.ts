import type { ValidationIssue } from '../../../types/protocol';
import type { ProtocolDocument } from '../types';
import { isTemplateInstructionNode } from './sectionVisibility';

export function selectValidationIssues(document: ProtocolDocument): ValidationIssue[] {
  return document.validationIssues
    .filter((issue) => !isTemplateInstructionNode(issue.sectionId))
    .map(
    ({ id, name, severity, sectionId, elementId, message, quickFix }) => ({
      id,
      name,
      severity,
      sectionId,
      ...(elementId !== undefined ? { fieldId: elementId } : {}),
      message,
      ...(quickFix !== undefined ? { quickFix } : {}),
    })
  );
}

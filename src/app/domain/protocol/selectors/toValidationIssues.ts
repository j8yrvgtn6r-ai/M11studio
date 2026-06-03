import type { ValidationIssue } from '../../../types/protocol';
import type { ProtocolDocument } from '../types';

export function selectValidationIssues(document: ProtocolDocument): ValidationIssue[] {
  return document.validationIssues.map(
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

import type { ProtocolLintContext, ProtocolLintIssue } from '../protocol/authoring/linting/protocolLintTypes';
import {
  getSectionGuidance,
  guidanceContainsInsertionPrompt,
  isHeadingOnlyWithAuthoredText,
  shouldSkipRequiredMissingForEmptySection,
} from './m11TemplateGuidanceSelectors';

export function runM11TemplateGuidanceLintRules(context: ProtocolLintContext): ProtocolLintIssue[] {
  const guidance = getSectionGuidance(context.sectionId);
  if (!guidance || guidance.excludedFromGuidanceUi) {
    return [];
  }

  const issues: ProtocolLintIssue[] = [];
  const trimmed = context.plainText.trim();

  if (!trimmed && !shouldSkipRequiredMissingForEmptySection(context.sectionId)) {
    issues.push({
      id: `lint.guidance.required.${context.sectionId}`,
      sectionId: context.sectionId,
      lineNumber: 1,
      severity: 'error',
      category: 'requiredContent',
      message: 'Required section content is missing.',
      source: 'm11Template',
      createdAt: new Date().toISOString(),
    });
  }

  if (isHeadingOnlyWithAuthoredText(context.sectionId, trimmed)) {
    issues.push({
      id: `lint.guidance.headingOnlyContent.${context.sectionId}`,
      sectionId: context.sectionId,
      lineNumber: 1,
      severity: 'warning',
      category: 'structure',
      message: 'This M11 section is heading-only; narrative text is not intended here.',
      source: 'm11Template',
      createdAt: new Date().toISOString(),
    });
  }

  for (const prompt of guidance.insertionPrompts) {
    if (trimmed && guidanceContainsInsertionPrompt(trimmed, context.sectionId)) {
      const index = trimmed.toLowerCase().indexOf(prompt.trim().toLowerCase());
      issues.push({
        id: `lint.guidance.promptRemaining.${context.sectionId}.${prompt.slice(0, 20)}`,
        sectionId: context.sectionId,
        lineNumber: 1,
        startOffset: index >= 0 ? index : undefined,
        endOffset: index >= 0 ? index + prompt.length : undefined,
        severity: 'warning',
        category: 'structure',
        message: 'Template insertion prompt text may still be present and should be replaced with final protocol content.',
        source: 'm11Template',
        createdAt: new Date().toISOString(),
      });
      break;
    }
  }

  return issues;
}

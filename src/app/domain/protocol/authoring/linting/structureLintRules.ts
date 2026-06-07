import type { ProtocolLintContext, ProtocolLintIssue } from './protocolLintTypes';
import { getSectionGuidance, shouldSkipRequiredMissingForEmptySection } from '../../../m11-template-guidance';

const PLACEHOLDER_PATTERNS = [
  /\[insert[^\]]*\]/gi,
  /\[placeholder[^\]]*\]/gi,
  /\bTBD\b/g,
  /\bTODO\b/g,
  /\bFIXME\b/g,
];

const INSTRUCTION_PATTERNS = [
  /\[instruction[^\]]*\]/gi,
  /describe (?:the )?objectives? here/gi,
  /enter (?:the )?text here/gi,
];

function lineNumberFromOffset(text: string, offset: number): number {
  return Math.max(1, text.slice(0, Math.max(0, offset)).split('\n').length);
}

function pushSpanIssues(
  context: ProtocolLintContext,
  issues: ProtocolLintIssue[],
  pattern: RegExp,
  message: string,
  severity: ProtocolLintIssue['severity'],
  prefix: string,
): void {
  const regex = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(context.plainText)) !== null) {
    issues.push({
      id: `lint.${prefix}.${match.index}`,
      sectionId: context.sectionId,
      lineNumber: lineNumberFromOffset(context.plainText, match.index),
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      severity,
      category: prefix === 'required' ? 'requiredContent' : 'structure',
      message,
      suggestedFix: undefined,
      source: 'm11Template',
      createdAt: new Date().toISOString(),
    });
  }
}

export function runStructureLintRules(context: ProtocolLintContext): ProtocolLintIssue[] {
  const issues: ProtocolLintIssue[] = [];
  const trimmed = context.plainText.trim();
  const guidance = getSectionGuidance(context.sectionId);
  const usesGuidanceLayer = Boolean(guidance && !guidance.excludedFromGuidanceUi);

  if (!trimmed) {
    if (!usesGuidanceLayer) {
      issues.push({
        id: `lint.structure.empty.${context.sectionId}`,
        sectionId: context.sectionId,
        lineNumber: 1,
        severity: 'error',
        category: 'requiredContent',
        message: 'Required section content is missing.',
        source: 'm11Template',
        createdAt: new Date().toISOString(),
      });
    } else if (!shouldSkipRequiredMissingForEmptySection(context.sectionId)) {
      // Guidance lint rules emit the required-content finding for applicable sections.
    }
    return issues;
  }

  if (trimmed.length < 40) {
    issues.push({
      id: `lint.structure.thin.${context.sectionId}`,
      sectionId: context.sectionId,
      lineNumber: 1,
      severity: 'warning',
      category: 'structure',
      message: 'Section content appears too thin for M11 narrative expectations.',
      source: 'localRule',
      createdAt: new Date().toISOString(),
    });
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    pushSpanIssues(
      context,
      issues,
      pattern,
      'Placeholder or incomplete authoring marker detected.',
      'warning',
      'structure',
    );
  }

  for (const pattern of INSTRUCTION_PATTERNS) {
    pushSpanIssues(
      context,
      issues,
      pattern,
      'Template instruction text may still be present.',
      'warning',
      'structure',
    );
  }

  return issues;
}

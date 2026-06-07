import type { LineDiagnostic } from '../lineDiagnostics';
import { stripHtmlToPlainText } from '../richTextContent';
import { runAllProtocolLintRules } from './protocolLintRules';
import type {
  ProtocolLintContext,
  ProtocolLintIssue,
  ProtocolLintRunResult,
  ProtocolQuickFix,
  ProtocolQuickFixActionType,
} from './protocolLintTypes';

export const MAX_LINT_TEXT_LENGTH = 100_000;
export const MAX_LINT_RUNTIME_MS = 2_000;

function normalizeMessage(message: string): string {
  return message.toLowerCase().replace(/\s+/g, ' ').trim();
}

function diagnosticKey(input: {
  sectionId: string;
  category: string;
  message: string;
  startOffset?: number;
  endOffset?: number;
}): string {
  return `${input.sectionId}:${input.category}:${normalizeMessage(input.message)}:${input.startOffset ?? -1}:${input.endOffset ?? -1}`;
}

export function buildQuickFixesForIssue(issue: ProtocolLintIssue): ProtocolQuickFix[] {
  if (!issue.suggestedFix && issue.category !== 'terminology') {
    if (issue.relatedSectionIds?.length) {
      return [
        {
          id: `quickfix.navigate.${issue.id}`,
          label: `Review section ${issue.relatedSectionIds[0]}`,
          issueId: issue.id,
          actionType: 'navigateSection',
          metadata: { targetSectionId: issue.relatedSectionIds[0] ?? '' },
        },
      ];
    }
    return [];
  }

  if (issue.category === 'terminology' && issue.suggestedFix && issue.startOffset != null && issue.endOffset != null) {
    return [
      {
        id: `quickfix.replace.${issue.id}`,
        label: `Replace with "${issue.suggestedFix}"`,
        issueId: issue.id,
        replacementText: issue.suggestedFix,
        range: { startOffset: issue.startOffset, endOffset: issue.endOffset },
        actionType: 'replaceText',
      },
      {
        id: `quickfix.intellisense.${issue.id}`,
        label: 'Open IntelliSense suggestions',
        issueId: issue.id,
        actionType: 'openIntellisense',
        metadata: { query: issue.suggestedFix },
      },
    ];
  }

  if (issue.suggestedFix) {
    return [
      {
        id: `quickfix.intellisense.${issue.id}`,
        label: 'Open IntelliSense suggestions',
        issueId: issue.id,
        actionType: 'openIntellisense',
        metadata: { query: issue.suggestedFix },
      },
    ];
  }

  return [];
}

export function lintIssueToLineDiagnostic(issue: ProtocolLintIssue): LineDiagnostic {
  return {
    id: issue.id,
    sectionId: issue.sectionId,
    lineNumber: issue.lineNumber ?? 1,
    startOffset: issue.startOffset,
    endOffset: issue.endOffset,
    severity: issue.severity,
    category: mapLintCategoryToDiagnosticCategory(issue.category),
    message: issue.message,
    source: `liveLint:${issue.source}`,
    suggestedFix: issue.suggestedFix,
    relatedEntityIds: issue.relatedEntityIds,
    relatedSectionIds: issue.relatedSectionIds,
  };
}

function mapLintCategoryToDiagnosticCategory(
  category: ProtocolLintIssue['category'],
): LineDiagnostic['category'] {
  switch (category) {
    case 'requiredContent':
      return 'missingContent';
    case 'grammar':
    case 'style':
      return 'grammar';
    default:
      return category as LineDiagnostic['category'];
  }
}

export function lintIssuesToLineDiagnostics(issues: ProtocolLintIssue[]): LineDiagnostic[] {
  return issues.map(lintIssueToLineDiagnostic);
}

export function mergeLineDiagnosticsWithLint(
  validationDiagnostics: LineDiagnostic[],
  lintIssues: ProtocolLintIssue[],
): LineDiagnostic[] {
  const seen = new Set(validationDiagnostics.map((entry) => diagnosticKey(entry)));
  const merged = [...validationDiagnostics];
  for (const issue of lintIssues) {
    const diagnostic = lintIssueToLineDiagnostic(issue);
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(diagnostic);
  }
  return merged;
}

export function runProtocolLint(input: {
  sectionId: string;
  sectionTitle?: string;
  content: string;
}): ProtocolLintRunResult {
  const started = Date.now();
  const plainText = stripHtmlToPlainText(input.content);
  if (plainText.length > MAX_LINT_TEXT_LENGTH) {
    return { issues: [], quickFixes: [], durationMs: Date.now() - started, truncated: true };
  }

  const context: ProtocolLintContext = {
    sectionId: input.sectionId,
    sectionTitle: input.sectionTitle,
    content: input.content,
    plainText,
  };

  let issues: ProtocolLintIssue[] = [];
  try {
    issues = runAllProtocolLintRules(context);
  } catch (error) {
    console.warn('[protocol-lint] failed', error);
    return { issues: [], quickFixes: [], durationMs: Date.now() - started, truncated: false };
  }

  if (Date.now() - started > MAX_LINT_RUNTIME_MS) {
    issues = issues.slice(0, 24);
  }

  const quickFixes = issues.flatMap(buildQuickFixesForIssue);
  return {
    issues,
    quickFixes,
    durationMs: Date.now() - started,
    truncated: plainText.length > MAX_LINT_TEXT_LENGTH,
  };
}

export function applyQuickFixToText(
  text: string,
  fix: ProtocolQuickFix,
): { nextText: string; applied: boolean } {
  if (fix.actionType !== 'replaceText' || !fix.replacementText || !fix.range) {
    return { nextText: text, applied: false };
  }
  const plain = stripHtmlToPlainText(text);
  if (fix.range.endOffset > plain.length) {
    return { nextText: text, applied: false };
  }
  const nextPlain = `${plain.slice(0, fix.range.startOffset)}${fix.replacementText}${plain.slice(fix.range.endOffset)}`;
  return { nextText: nextPlain, applied: true };
}

export function isActionableQuickFix(actionType: ProtocolQuickFixActionType): boolean {
  return actionType === 'replaceText' || actionType === 'openIntellisense';
}

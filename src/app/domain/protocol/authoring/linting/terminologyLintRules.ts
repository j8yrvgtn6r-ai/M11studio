import type { ProtocolLintContext, ProtocolLintIssue } from './protocolLintTypes';

interface TerminologyLintPattern {
  id: string;
  pattern: RegExp;
  suggestedFix: string | ((match: string) => string);
  message: string;
  severity: ProtocolLintIssue['severity'];
}

const TERMINOLOGY_PATTERNS: TerminologyLintPattern[] = [
  {
    id: 'subject-plural',
    pattern: /\bsubjects\b/gi,
    suggestedFix: 'participants',
    message: 'M11 prefers "participants" over "subjects"',
    severity: 'warning',
  },
  {
    id: 'subject-singular',
    pattern: /\bsubject\b/gi,
    suggestedFix: 'participant',
    message: 'M11 prefers "participant" over "subject"',
    severity: 'warning',
  },
  {
    id: 'investigational-product',
    pattern: /\binvestigational products?\b/gi,
    suggestedFix: 'investigational trial intervention',
    message: 'Use ICH M11 term "investigational trial intervention"',
    severity: 'warning',
  },
  {
    id: 'study-to-trial',
    pattern: /\b(the|this|a)\s+study\b/gi,
    suggestedFix: (match) => match.replace(/\bstudy\b/gi, 'trial'),
    message: 'M11 narrative prefers "trial" over "study" where appropriate',
    severity: 'info',
  },
];

function lineNumberFromOffset(text: string, offset: number): number {
  return Math.max(1, text.slice(0, Math.max(0, offset)).split('\n').length);
}

export function runTerminologyLintRules(context: ProtocolLintContext): ProtocolLintIssue[] {
  const issues: ProtocolLintIssue[] = [];
  const text = context.plainText;

  for (const rule of TERMINOLOGY_PATTERNS) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const matched = match[0];
      const startOffset = match.index;
      const endOffset = startOffset + matched.length;
      const suggestedFix =
        typeof rule.suggestedFix === 'function' ? rule.suggestedFix(matched) : rule.suggestedFix;
      issues.push({
        id: `lint.term.${rule.id}.${startOffset}`,
        sectionId: context.sectionId,
        lineNumber: lineNumberFromOffset(text, startOffset),
        startOffset,
        endOffset,
        severity: rule.severity,
        category: 'terminology',
        message: rule.message,
        suggestedFix,
        source: 'terminology',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return issues;
}

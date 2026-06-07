import type { ProtocolLintContext, ProtocolLintIssue } from './protocolLintTypes';
import { runConsistencyLintRules } from './consistencyLintRules';
import { runSoALintRules } from './soaLintRules';
import { runStructureLintRules } from './structureLintRules';
import { runTerminologyLintRules } from './terminologyLintRules';

const STYLE_RULES: Array<{
  id: string;
  test: (text: string) => RegExpMatchArray | null;
  message: string;
  severity: ProtocolLintIssue['severity'];
  category: ProtocolLintIssue['category'];
}> = [
  {
    id: 'double-punctuation',
    test: (text) => text.match(/[!?]{2,}|\.{4,}/),
    message: 'Repeated punctuation detected.',
    severity: 'info',
    category: 'grammar',
  },
  {
    id: 'double-space',
    test: (text) => text.match(/ {2,}/),
    message: 'Repeated whitespace detected.',
    severity: 'info',
    category: 'style',
  },
  {
    id: 'long-sentence',
    test: (text) => {
      const sentences = text.split(/[.!?]+\s+/);
      const long = sentences.find((sentence) => sentence.trim().split(/\s+/).length > 45);
      return long ? [long] as unknown as RegExpMatchArray : null;
    },
    message: 'Overly long sentence may reduce protocol readability.',
    severity: 'info',
    category: 'style',
  },
  {
    id: 'todo-marker',
    test: (text) => text.match(/\b(TBD|TODO|\[insert\]|\[placeholder\])\b/i),
    message: 'Placeholder marker detected in authored text.',
    severity: 'warning',
    category: 'style',
  },
];

function lineNumberFromOffset(text: string, offset: number): number {
  return Math.max(1, text.slice(0, Math.max(0, offset)).split('\n').length);
}

export function runStyleLintRules(context: ProtocolLintContext): ProtocolLintIssue[] {
  const issues: ProtocolLintIssue[] = [];
  for (const rule of STYLE_RULES) {
    const match = rule.test(context.plainText);
    if (!match) {
      continue;
    }
    const matched = typeof match[0] === 'string' ? match[0] : String(match[0] ?? '');
    const startOffset = context.plainText.indexOf(matched);
    issues.push({
      id: `lint.style.${rule.id}.${startOffset >= 0 ? startOffset : 0}`,
      sectionId: context.sectionId,
      lineNumber: lineNumberFromOffset(context.plainText, Math.max(0, startOffset)),
      startOffset: startOffset >= 0 ? startOffset : undefined,
      endOffset: startOffset >= 0 ? startOffset + matched.length : undefined,
      severity: rule.severity,
      category: rule.category,
      message: rule.message,
      source: 'localRule',
      createdAt: new Date().toISOString(),
    });
  }
  return issues;
}

export function runAllProtocolLintRules(context: ProtocolLintContext): ProtocolLintIssue[] {
  return [
    ...runTerminologyLintRules(context),
    ...runStructureLintRules(context),
    ...runConsistencyLintRules(context),
    ...runSoALintRules(context),
    ...runStyleLintRules(context),
  ];
}

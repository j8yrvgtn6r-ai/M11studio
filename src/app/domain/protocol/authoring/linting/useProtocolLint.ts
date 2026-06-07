import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LineDiagnostic } from '../editorIntegration';
import {
  formatLintStatusLabel,
  getLintIssues,
  getLintQuickFixes,
  getLintSummary,
  mergeLineDiagnosticsWithLint,
  scheduleSectionLint,
  subscribeLintIssues,
} from './index';

export function useProtocolLint(options: {
  sectionId?: string;
  sectionTitle?: string;
  content: string;
  validationDiagnostics: LineDiagnostic[];
  enabled?: boolean;
}): {
  lintStatusLabel: string;
  lintIssueCount: number;
  lintIssues: ReturnType<typeof getLintIssues>;
  lintQuickFixes: ReturnType<typeof getLintQuickFixes>;
  mergedDiagnostics: LineDiagnostic[];
  scheduleLint: (content?: string) => void;
  lastLintedAt: string | null;
} {
  const { sectionId, sectionTitle, content, validationDiagnostics, enabled = true } = options;
  const [, bump] = useState(0);

  useEffect(() => subscribeLintIssues(() => bump((value) => value + 1)), []);

  const scheduleLint = useCallback(
    (nextContent?: string) => {
      if (!enabled || !sectionId) {
        return;
      }
      scheduleSectionLint({
        sectionId,
        sectionTitle,
        content: nextContent ?? content,
      });
    },
    [content, enabled, sectionId, sectionTitle],
  );

  useEffect(() => {
    if (!enabled || !sectionId || !content.trim()) {
      return;
    }
    scheduleLint(content);
  }, [content, enabled, scheduleLint, sectionId]);

  const lintIssues = sectionId ? getLintIssues(sectionId) : [];
  const lintQuickFixes = sectionId ? getLintQuickFixes(sectionId) : [];
  const lintSummary = sectionId ? getLintSummary(sectionId) : {
    sectionId: sectionId ?? '',
    issueCount: 0,
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    lastLintedAt: null,
    schedulerState: 'idle' as const,
  };

  const mergedDiagnostics = useMemo(
    () => mergeLineDiagnosticsWithLint(validationDiagnostics, lintIssues),
    [lintIssues, validationDiagnostics],
  );

  return {
    lintStatusLabel: formatLintStatusLabel(lintSummary),
    lintIssueCount: lintSummary.issueCount,
    lintIssues,
    lintQuickFixes,
    mergedDiagnostics,
    scheduleLint,
    lastLintedAt: lintSummary.lastLintedAt,
  };
}

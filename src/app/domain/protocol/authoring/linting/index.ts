export type {
  ProtocolLintCategory,
  ProtocolLintContext,
  ProtocolLintIssue,
  ProtocolLintRunResult,
  ProtocolLintSchedulerState,
  ProtocolLintSeverity,
  ProtocolLintSource,
  ProtocolLintSummary,
  ProtocolQuickFix,
  ProtocolQuickFixActionType,
} from './protocolLintTypes';

export {
  applyQuickFixToText,
  buildQuickFixesForIssue,
  isActionableQuickFix,
  lintIssuesToLineDiagnostics,
  mergeLineDiagnosticsWithLint,
  runProtocolLint,
  MAX_LINT_RUNTIME_MS,
  MAX_LINT_TEXT_LENGTH,
} from './protocolLintEngine';

export { runAllProtocolLintRules, runStyleLintRules } from './protocolLintRules';
export { runTerminologyLintRules } from './terminologyLintRules';
export { runStructureLintRules } from './structureLintRules';
export { runConsistencyLintRules } from './consistencyLintRules';
export { runSoALintRules } from './soaLintRules';

export {
  clearLintIssues,
  getLintIssues,
  getLintQuickFixes,
  getLintSchedulerState,
  getLintSummary,
  applyProtocolQuickFix,
  registerProtocolQuickFixHandler,
  setLintIssues,
  subscribeLintIssues,
} from './protocolLintStore';

export {
  cancelSectionLint,
  getScheduledLintStatus,
  LINT_DEBOUNCE_MS,
  resetProtocolLintScheduler,
  scheduleImpactedSectionLint,
  scheduleSectionLint,
} from './protocolLintScheduler';

export { useProtocolLint } from './useProtocolLint';

export function formatLintStatusLabel(summary: {
  schedulerState: string;
  issueCount: number;
}): string {
  if (summary.schedulerState === 'scheduled' || summary.schedulerState === 'running') {
    return 'Linting…';
  }
  if (summary.issueCount === 0) {
    return 'No issues';
  }
  return `${summary.issueCount} issue${summary.issueCount === 1 ? '' : 's'}`;
}

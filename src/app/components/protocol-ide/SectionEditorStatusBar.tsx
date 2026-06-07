import { format } from 'date-fns';
import type { AutosaveStatus } from '../StatusBar';
import type { SectionValidationSummary } from '../../domain/protocol/authoring/editorIntegration';

interface SectionEditorStatusBarProps {
  sectionState: string;
  autosaveStatus?: AutosaveStatus;
  lastSaved?: Date | null;
  validationSummary: SectionValidationSummary;
  dependencyCount: number;
  lintStatusLabel?: string;
  lintIssueCount?: number;
}

export function SectionEditorStatusBar({
  sectionState,
  autosaveStatus = 'idle',
  lastSaved,
  validationSummary,
  dependencyCount,
  lintStatusLabel = 'No issues',
  lintIssueCount = 0,
}: SectionEditorStatusBarProps) {
  const autosaveLabel =
    autosaveStatus === 'saving'
      ? 'Saving…'
      : autosaveStatus === 'error'
        ? 'Save failed'
        : lastSaved
          ? `Autosaved ${format(lastSaved, 'HH:mm:ss')}`
          : 'Autosaved';

  const validationLabel = validationSummary.passes ? 'Validation OK' : 'Needs review';
  const terminologyWarnings = validationSummary.terminologyIssueCount;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/30 px-3 py-1.5 font-mono text-[11px] text-muted-foreground"
      data-testid="section-editor-status-bar"
    >
      <span data-testid="section-editor-state">State: {sectionState}</span>
      <span data-testid="section-editor-autosave">{autosaveLabel}</span>
      <span data-testid="section-editor-validation">{validationLabel}</span>
      <span data-testid="section-editor-dependencies">Deps: {dependencyCount}</span>
      <span data-testid="section-editor-terminology-warnings">Term warnings: {terminologyWarnings}</span>
      <span data-testid="section-editor-lint-status">Lint: {lintStatusLabel}</span>
      {lintIssueCount > 0 ? (
        <span data-testid="section-editor-lint-count">{lintIssueCount} lint issue{lintIssueCount === 1 ? '' : 's'}</span>
      ) : null}
    </div>
  );
}

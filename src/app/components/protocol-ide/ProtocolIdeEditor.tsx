import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorGutterIndicator, LineDiagnostic, SectionValidationSummary } from '../../domain/protocol/authoring/editorIntegration';
import { buildLineDiagnostics } from '../../domain/protocol/authoring/editorIntegration';
import type { DiagnosticScrollTarget } from '../../domain/protocol/authoring/lineDiagnostics';
import { offsetFromLineColumn } from '../../domain/protocol/authoring/lineDiagnostics';
import {
  applyQuickFixToText,
  registerProtocolQuickFixHandler,
  type ProtocolQuickFix,
  useProtocolLint,
} from '../../domain/protocol/authoring/linting';
import { recordIntellisenseAcceptance } from '../../domain/protocol/authoring/intellisense';
import { recordTerminologyAcceptance } from '../../domain/protocol/authoring/terminologyEditorIntegration';
import { normalizeEditorOutput, stripHtmlToPlainText } from '../../domain/protocol/authoring/richTextContent';
import { diagnosticsToGutterIndicators } from '../../domain/protocol/authoring/lineDiagnostics';
import type { AutosaveStatus } from '../StatusBar';
import { RichTextEditor } from '../authoring/RichTextEditor';
import { EditorGutter, countEditorLines } from './EditorGutter';
import { InsertImageReferenceDialog } from './InsertImageReferenceDialog';
import { ProtocolIdeToolbar } from './ProtocolIdeToolbar';
import { SectionEditorStatusBar } from './SectionEditorStatusBar';
import { cn } from '../ui/utils';

export interface ProtocolIdeEditorProps {
  value: string;
  onChange: (value: string) => void;
  editorKey?: string;
  placeholder?: string;
  readOnly?: boolean;
  sectionId?: string;
  sectionState: string;
  autosaveStatus?: AutosaveStatus;
  lastSaved?: Date | null;
  validationSummary: SectionValidationSummary;
  dependencyCount: number;
  gutterIndicators?: EditorGutterIndicator[];
  lineDiagnostics?: LineDiagnostic[];
  highlightQuery?: string;
  onValidate?: () => void;
  validateDisabled?: boolean;
  validateRunning?: boolean;
  onFind?: () => void;
  onReplace?: () => void;
  onTerminologyAccepted?: () => void;
  onIntellisenseAccepted?: () => void;
  sectionTitle?: string;
  explicitIntellisenseQuery?: string | null;
  onExplicitIntellisenseQueryChange?: (query: string | null) => void;
  diagnosticScrollTarget?: DiagnosticScrollTarget | null;
  onDiagnosticScrollComplete?: () => void;
  'data-testid'?: string;
}

export function ProtocolIdeEditor({
  value,
  onChange,
  editorKey,
  placeholder,
  readOnly = false,
  sectionId,
  sectionState,
  autosaveStatus,
  lastSaved,
  validationSummary,
  dependencyCount,
  gutterIndicators = [],
  lineDiagnostics: lineDiagnosticsProp,
  highlightQuery,
  onValidate,
  validateDisabled,
  validateRunning,
  onFind,
  onReplace,
  onTerminologyAccepted,
  onIntellisenseAccepted,
  sectionTitle,
  explicitIntellisenseQuery = null,
  onExplicitIntellisenseQueryChange,
  diagnosticScrollTarget = null,
  onDiagnosticScrollComplete,
  'data-testid': dataTestId = 'protocol-ide-editor',
}: ProtocolIdeEditorProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [scrollToOffset, setScrollToOffset] = useState<number | null>(null);

  useEffect(() => {
    if (!diagnosticScrollTarget || diagnosticScrollTarget.sectionId !== sectionId) {
      return;
    }
    const offset =
      typeof diagnosticScrollTarget.startOffset === 'number'
        ? diagnosticScrollTarget.startOffset
        : offsetFromLineColumn(value, diagnosticScrollTarget.lineNumber);
    setScrollToOffset(offset);
    onDiagnosticScrollComplete?.();
  }, [diagnosticScrollTarget, onDiagnosticScrollComplete, sectionId, value]);

  const validationDiagnostics = useMemo(() => {
    if (lineDiagnosticsProp) {
      return lineDiagnosticsProp;
    }
    if (!sectionId) {
      return [];
    }
    return buildLineDiagnostics({ sectionId, content: value });
  }, [lineDiagnosticsProp, sectionId, value]);

  const {
    mergedDiagnostics: lineDiagnostics,
    lintStatusLabel,
    lintIssueCount,
    scheduleLint,
  } = useProtocolLint({
    sectionId,
    sectionTitle,
    content: value,
    validationDiagnostics,
    enabled: !readOnly && Boolean(sectionId),
  });

  const handleEditorChange = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      scheduleLint(nextValue);
    },
    [onChange, scheduleLint],
  );

  const handleQuickFix = useCallback(
    (fix: ProtocolQuickFix) => {
      if (fix.actionType === 'openIntellisense') {
        onExplicitIntellisenseQueryChange?.(fix.metadata?.query ?? null);
        return;
      }
      if (fix.actionType !== 'replaceText' || !sectionId) {
        return;
      }
      const { nextText, applied } = applyQuickFixToText(value, fix);
      if (!applied) {
        return;
      }
      const plain = stripHtmlToPlainText(value);
      const originalText =
        fix.range != null ? plain.slice(fix.range.startOffset, fix.range.endOffset) : '';
      handleEditorChange(nextText);
      recordIntellisenseAcceptance({
        sectionId,
        suggestionId: fix.id,
        kind: 'terminology',
        source: 'm11Terminology',
        originalText,
        insertedText: fix.replacementText ?? '',
        metadata: fix.metadata,
      });
      recordTerminologyAcceptance(sectionId, {
        acceptedTerm: fix.replacementText ?? '',
        preferredTerm: fix.replacementText ?? '',
        codelistName: 'M11 Terminology',
        originalToken: originalText,
      });
      onTerminologyAccepted?.();
      onIntellisenseAccepted?.();
    },
    [
      handleEditorChange,
      onExplicitIntellisenseQueryChange,
      onIntellisenseAccepted,
      onTerminologyAccepted,
      sectionId,
      value,
    ],
  );

  useEffect(() => {
    if (!sectionId || readOnly) {
      return;
    }
    return registerProtocolQuickFixHandler(handleQuickFix);
  }, [handleQuickFix, readOnly, sectionId]);

  const resolvedGutterIndicators = useMemo(() => {
    if (lineDiagnostics.length > 0) {
      return diagnosticsToGutterIndicators(lineDiagnostics).map((entry) => ({
        lineNumber: entry.lineNumber,
        kind:
          entry.category === 'terminology'
            ? 'terminology'
            : entry.category === 'structure' || entry.category === 'missingContent'
              ? 'structure'
              : 'validation',
        severity: entry.severity,
        message: entry.message,
        diagnosticId: lineDiagnostics.find((diag) => diag.lineNumber === entry.lineNumber)?.id,
        startOffset: lineDiagnostics.find((diag) => diag.lineNumber === entry.lineNumber)?.startOffset,
      })) as EditorGutterIndicator[];
    }
    return gutterIndicators;
  }, [gutterIndicators, lineDiagnostics]);

  const runOnSurface = useCallback((fn: (surface: HTMLDivElement) => void) => {
    const surface = surfaceRef.current ?? document.querySelector<HTMLDivElement>(`[data-testid="${dataTestId}-inner-surface"]`);
    if (surface) {
      surface.focus();
      fn(surface);
      onChange(normalizeEditorOutput(surface.innerHTML));
    }
  }, [dataTestId, onChange]);

  const handleUndo = () => runOnSurface(() => document.execCommand('undo'));
  const handleRedo = () => runOnSurface(() => document.execCommand('redo'));
  const handleBulletedList = () => runOnSurface(() => document.execCommand('insertUnorderedList'));
  const handleNumberedList = () => runOnSurface(() => document.execCommand('insertOrderedList'));

  const handleInsertTable = () => {
    runOnSurface((surface) => {
      document.execCommand(
        'insertHTML',
        false,
        '<table><tbody><tr><td>Column A</td><td>Column B</td></tr><tr><td></td><td></td></tr></tbody></table>',
      );
      void surface;
    });
  };

  const handleInsertLink = () => {
    const url = window.prompt('Link URL');
    if (!url?.trim()) {
      return;
    }
    runOnSurface(() => document.execCommand('createLink', false, url.trim()));
  };

  const handleInsertImageReference = () => setImageDialogOpen(true);

  const handleGutterClick = (indicator: EditorGutterIndicator) => {
    if (typeof indicator.startOffset === 'number') {
      setScrollToOffset(indicator.startOffset);
    }
  };

  const lineCount = countEditorLines(value);

  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-card')} data-testid={dataTestId}>
      {!readOnly ? (
        <div className="border-b border-border p-1.5">
          <ProtocolIdeToolbar
            onUndo={handleUndo}
            onRedo={handleRedo}
            onBulletedList={handleBulletedList}
            onNumberedList={handleNumberedList}
            onInsertTable={handleInsertTable}
            onInsertLink={handleInsertLink}
            onInsertImageReference={handleInsertImageReference}
            onValidate={onValidate}
            validateDisabled={validateDisabled}
            validateRunning={validateRunning}
            onFind={onFind}
            onReplace={onReplace}
          />
        </div>
      ) : null}

      <InsertImageReferenceDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onInsert={(token) => {
          runOnSurface((surface) => {
            document.execCommand('insertText', false, token);
            void surface;
          });
        }}
      />

      <div className="flex min-h-[240px]">
        {!readOnly ? (
          <EditorGutter
            lineCount={lineCount}
            indicators={resolvedGutterIndicators}
            showLineNumbers
            onIndicatorClick={handleGutterClick}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <RichTextEditor
            value={value}
            onChange={handleEditorChange}
            editorKey={editorKey}
            placeholder={placeholder}
            readOnly={readOnly}
            ideMode
            highlightQuery={highlightQuery}
            hideToolbar
            surfaceRef={surfaceRef}
            lineDiagnostics={lineDiagnostics}
            sectionId={sectionId}
            sectionTitle={sectionTitle}
            onTerminologyAccepted={onTerminologyAccepted}
            onIntellisenseAccepted={onIntellisenseAccepted}
            explicitIntellisenseQuery={explicitIntellisenseQuery}
            scrollToOffset={scrollToOffset}
            data-testid={`${dataTestId}-inner`}
          />
        </div>
      </div>

      {!readOnly ? (
        <SectionEditorStatusBar
          sectionState={sectionState}
          autosaveStatus={autosaveStatus}
          lastSaved={lastSaved}
          validationSummary={validationSummary}
          dependencyCount={dependencyCount}
          lintStatusLabel={lintStatusLabel}
          lintIssueCount={lintIssueCount}
        />
      ) : null}
    </div>
  );
}
